from sqlalchemy.orm import Session
from . import models, schemas
from datetime import datetime
import uuid
import logging

logger = logging.getLogger("options_tracker")

def get_positions(db: Session, status: str = None):
    query = db.query(models.Position)
    if status:
        query = query.filter(models.Position.status == status)
    return query.all()

def recalculate_position(db: Session, position_id: int):
    logger.debug("Recalculating position ID %s", position_id)
    db_position = db.query(models.Position).filter(models.Position.id == position_id).first()
    if not db_position:
        logger.warning("Position ID %s not found for recalculation", position_id)
        return None
    
    transactions = db.query(models.Transaction).filter(models.Transaction.position_id == position_id).all()
    
    total_qty = 0
    total_usd = 0.0
    
    for t in transactions:
        total_usd += t.total_usd
        if t.transaction_type in ['BTO', 'STO']:
            total_qty += t.quantity
        else:
            total_qty -= t.quantity
            
    db_position.current_quantity = total_qty
    db_position.total_cost_usd = total_usd
    
    if total_qty <= 0:
        db_position.status = "Closed"
        db_position.realized_pnl_usd = total_usd
    else:
        db_position.status = "Open"
        db_position.realized_pnl_usd = 0.0
        
    db.commit()
    db.refresh(db_position)
    logger.info("Recalculated position ID %s successfully (status: %s, quantity: %s)", position_id, db_position.status, total_qty)
    return db_position

def create_positions_batch(db: Session, batch: schemas.PositionCreateBatch):
    logger.info("Batch creating positions: %s legs for symbol %s", len(batch.legs), batch.symbol)
    group_id = str(uuid.uuid4())
    created_positions = []
    
    for leg in batch.legs:
        ticker = batch.symbol.upper() if batch.symbol else ""
        exp_str = batch.expiration_date.strftime("%y%m%d") if batch.expiration_date else ""
        cp_char = leg.call_put[0].upper() if leg.call_put else ""
        strike_str = f"{int(leg.strike_price * 1000):08d}" if leg.strike_price is not None else ""
        occ = f"{ticker}{exp_str}{cp_char}{strike_str}" if (ticker and exp_str and cp_char and strike_str) else None

        db_position = models.Position(
            group_id=group_id,
            symbol=batch.symbol,
            date_opened=batch.date_opened,
            expiration_date=batch.expiration_date,
            contract_name=leg.contract_name,
            strike_price=leg.strike_price,
            call_put=leg.call_put,
            initial_type=leg.transaction_type,
            status="Open",
            multiplier=batch.multiplier,
            current_quantity=batch.quantity,
            total_cost_usd=leg.total_usd,
            max_loss=batch.max_loss,
            occ_symbol=occ
        )
        db.add(db_position)
        db.commit()
        db.refresh(db_position)

        # Create initial transaction
        db_transaction = models.Transaction(
            position_id=db_position.id,
            date=batch.date_opened,
            transaction_type=leg.transaction_type,
            quantity=batch.quantity,
            option_price=leg.option_price,
            commission=leg.commission,
            total_usd=leg.total_usd
        )
        db.add(db_transaction)
        db.commit()
        created_positions.append(db_position)
        
    return created_positions

def update_transaction(db: Session, transaction_id: int, trans_update: schemas.TransactionUpdate):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_transaction:
        return None
    
    update_data = trans_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_transaction, key, value)
    
    db.commit()
    db.refresh(db_transaction)
    
    # Sync parent position
    recalculate_position(db, db_transaction.position_id)
    
    return db_transaction

def update_position(db: Session, position_id: int, pos_update: schemas.PositionUpdate):
    logger.info("Updating position ID %s", position_id)
    db_position = db.query(models.Position).filter(models.Position.id == position_id).first()
    if not db_position:
        logger.warning("Position ID %s not found for update", position_id)
        return None
    
    update_data = pos_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_position, key, value)
        
    # Re-calculate occ_symbol if any relevant fields changed
    ticker = db_position.symbol.upper() if db_position.symbol else ""
    if db_position.expiration_date and db_position.call_put and db_position.strike_price is not None:
        exp_str = db_position.expiration_date.strftime("%y%m%d")
        cp_char = db_position.call_put[0].upper()
        strike_str = f"{int(db_position.strike_price * 1000):08d}"
        db_position.occ_symbol = f"{ticker}{exp_str}{cp_char}{strike_str}"
    
    db.commit()
    db.refresh(db_position)
    return db_position

def close_position(db: Session, position_id: int, close_req: schemas.ClosePositionRequest):
    db_position = db.query(models.Position).filter(models.Position.id == position_id).first()
    if not db_position:
        return None

    # Add transaction
    db_transaction = models.Transaction(
        position_id=position_id,
        date=close_req.date,
        transaction_type=close_req.transaction_type,
        quantity=close_req.quantity,
        option_price=close_req.option_price,
        commission=close_req.commission,
        total_usd=close_req.total_usd
    )
    db.add(db_transaction)
    db.commit()

    # Recalculate everything
    return recalculate_position(db, position_id)

def delete_position(db: Session, position_id: int):
    db.query(models.Transaction).filter(models.Transaction.position_id == position_id).delete()
    db.query(models.Position).filter(models.Position.id == position_id).delete()
    db.commit()

def delete_group(db: Session, group_id: str):
    positions = db.query(models.Position).filter(models.Position.group_id == group_id).all()
    for p in positions:
        db.query(models.Transaction).filter(models.Transaction.position_id == p.id).delete()
    db.query(models.Position).filter(models.Position.group_id == group_id).delete()
    db.commit()

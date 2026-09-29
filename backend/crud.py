from typing import Optional, List
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

def compute_occ_symbol(symbol: str, expiration_date: datetime, call_put: str, strike_price: float) -> Optional[str]:
    if not (symbol and expiration_date and call_put and strike_price is not None):
        return None
    ticker = symbol.upper()
    exp_str = expiration_date.strftime("%y%m%d")
    cp_char = call_put[0].upper()
    strike_str = f"{int(round(strike_price * 1000)):08d}"
    return f"{ticker}{exp_str}{cp_char}{strike_str}"

def format_contract_name(expiration_date: datetime, strike_price: float, call_put: str) -> str:
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    mmm = months[expiration_date.month - 1]
    dd = f"{expiration_date.day:02d}"
    yy = f"{expiration_date.year % 100:02d}"
    strike_display = f"{strike_price:g}"
    cp_display = "Call" if call_put.upper().startswith("C") else "Put"
    return f"{mmm} {dd} '{yy} {strike_display} {cp_display}"

def ingest_transaction_batch(db: Session, request: schemas.IngestRequest) -> schemas.IngestResponse:
    effective_date = request.date or request.date_opened or datetime.utcnow()
    effective_exp = request.expiration_date
    logger.info("Ingesting batch transactions for symbol=%s with %d legs", request.symbol, len(request.legs))
    results = []

    # First pass: classify each leg as OPEN or CLOSE
    legs_to_close = []
    legs_to_open = []

    for leg in request.legs:
        leg_symbol = (leg.symbol or request.symbol or "").upper()
        leg_exp = leg.expiration_date or effective_exp
        
        # Normalize call_put to title case ("Call", "Put")
        raw_cp = leg.call_put or ("Call" if "C" in (leg.contract_name or "").upper() else "Put")
        normalized_cp = "Call" if raw_cp.strip().upper().startswith("C") else "Put"

        occ = leg.occ_symbol
        if not occ and leg_symbol and leg_exp and leg.strike_price is not None:
            occ = compute_occ_symbol(leg_symbol, leg_exp, normalized_cp, leg.strike_price)
            
        action_clean = (leg.action or leg.transaction_type or "").upper().strip()
        is_buy = action_clean in ("BUY", "BOUGHT", "BTO", "BTC")
        is_sell = action_clean in ("SELL", "SOLD", "STO", "STC")

        # Check if caller explicitly gave close instruction (or realized_pnl provided)
        has_explicit_close = action_clean in ("BTC", "STC") or (leg.realized_pnl is not None and leg.realized_pnl != 0.0)

        # Lookup open position by OCC symbol (or contract / symbol match)
        open_pos = None
        if occ:
            open_pos = db.query(models.Position).filter(
                models.Position.occ_symbol == occ,
                models.Position.status == "Open",
                models.Position.current_quantity > 0
            ).first()
        
        if not open_pos and leg_symbol and leg_exp and leg.strike_price is not None:
            open_pos = db.query(models.Position).filter(
                models.Position.symbol == leg_symbol,
                models.Position.expiration_date == leg_exp,
                models.Position.strike_price == leg.strike_price,
                models.Position.call_put.ilike(normalized_cp),
                models.Position.status == "Open",
                models.Position.current_quantity > 0
            ).first()

        # Decision: Close vs Open
        # 1. Explicit close action (e.g. BTC, STC)
        # 2. Or matching open position exists and trade direction opposes current position
        is_close_trade = False
        if has_explicit_close:
            is_close_trade = True
        elif open_pos:
            if open_pos.initial_type in ("STO", "BTC") and is_buy:
                is_close_trade = True
            elif open_pos.initial_type in ("BTO", "STC") and is_sell:
                is_close_trade = True
        
        if is_close_trade and not open_pos:
            # Fallback search if open_pos wasn't found by exact strike/exp match: match by symbol & status
            fallback_pos = db.query(models.Position).filter(
                models.Position.symbol == leg_symbol,
                models.Position.status == "Open",
                models.Position.current_quantity > 0
            ).first()
            if fallback_pos:
                open_pos = fallback_pos

        if is_close_trade and open_pos:
            legs_to_close.append((leg, open_pos, is_buy, occ, leg_symbol, leg_exp, normalized_cp))
        else:
            legs_to_open.append((leg, is_buy, occ, leg_symbol, leg_exp, normalized_cp))

    # Process all closes
    for leg, pos, is_buy, occ, leg_symbol, leg_exp, norm_cp in legs_to_close:
        close_tx_type = "BTC" if is_buy else "STC"
        qty = leg.quantity or request.quantity or 1
        multiplier = pos.multiplier or request.multiplier or 100.0
        
        if leg.total_usd is not None:
            total_usd = leg.total_usd
        else:
            gross = qty * leg.option_price * multiplier
            total_usd = -(gross + leg.commission) if is_buy else (gross - leg.commission)

        close_req = schemas.ClosePositionRequest(
            date=effective_date,
            transaction_type=close_tx_type,
            quantity=qty,
            option_price=leg.option_price,
            commission=leg.commission,
            total_usd=total_usd
        )
        updated_pos = close_position(db, pos.id, close_req)
        results.append(schemas.IngestResultItem(
            action_taken="CLOSED",
            position_id=updated_pos.id,
            transaction_type=close_tx_type,
            occ_symbol=updated_pos.occ_symbol or occ,
            contract_name=updated_pos.contract_name,
            quantity=qty,
            position=updated_pos
        ))

    # Process all opens (grouped together under one group_id)
    if legs_to_open:
        group_id = str(uuid.uuid4())
        group_symbol = request.symbol or legs_to_open[0][3] or "UNKNOWN"
        group_exp = effective_exp or legs_to_open[0][4] or effective_date
        max_loss = request.max_loss if request.max_loss is not None else 0.0

        for leg, is_buy, occ, leg_symbol, leg_exp, norm_cp in legs_to_open:
            open_tx_type = "BTO" if is_buy else "STO"
            qty = leg.quantity or request.quantity or 1
            multiplier = request.multiplier or 100.0
            strike = leg.strike_price or 0.0
            cp = norm_cp
            exp_date = leg_exp or group_exp
            
            c_name = leg.contract_name
            if not c_name and exp_date and strike:
                c_name = format_contract_name(exp_date, strike, cp)
            elif not c_name:
                c_name = f"{leg_symbol} {strike} {cp}"

            if not occ and leg_symbol and exp_date and cp and strike:
                occ = compute_occ_symbol(leg_symbol, exp_date, cp, strike)

            if leg.total_usd is not None:
                total_usd = leg.total_usd
            else:
                gross = qty * leg.option_price * multiplier
                total_usd = -(gross + leg.commission) if is_buy else (gross - leg.commission)

            db_pos = models.Position(
                group_id=group_id,
                symbol=leg_symbol or group_symbol,
                date_opened=effective_date,
                expiration_date=exp_date,
                contract_name=c_name,
                strike_price=strike,
                call_put=cp,
                initial_type=open_tx_type,
                status="Open",
                multiplier=multiplier,
                current_quantity=qty,
                total_cost_usd=total_usd,
                max_loss=max_loss,
                occ_symbol=occ
            )
            db.add(db_pos)
            db.commit()
            db.refresh(db_pos)

            db_tx = models.Transaction(
                position_id=db_pos.id,
                date=effective_date,
                transaction_type=open_tx_type,
                quantity=qty,
                option_price=leg.option_price,
                commission=leg.commission,
                total_usd=total_usd
            )
            db.add(db_tx)
            db.commit()
            db.refresh(db_pos)


            results.append(schemas.IngestResultItem(
                action_taken="OPENED",
                position_id=db_pos.id,
                transaction_type=open_tx_type,
                occ_symbol=occ,
                contract_name=c_name,
                quantity=qty,
                position=db_pos
            ))

    msg = f"Processed {len(results)} transactions ({len(legs_to_close)} closed, {len(legs_to_open)} opened)"
    logger.info(msg)
    return schemas.IngestResponse(
        status="success",
        message=msg,
        results=results
    )


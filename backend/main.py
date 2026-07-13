from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
import os
import logging
from typing import List, Optional

import logging.config
import json
if os.path.exists("log_config.json"):
    with open("log_config.json", "r") as f:
        logging.config.dictConfig(json.load(f))
logger = logging.getLogger("options_tracker")

from . import crud, models, schemas, database
from .database import engine, get_db
from .migrations_runner import run_migrations
import yfinance as yf

# Create tables
models.Base.metadata.create_all(bind=engine)

# Run Alembic migrations
run_migrations()

# Defensive migration for multiplier column
try:
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE positions ADD COLUMN multiplier FLOAT DEFAULT 100.0"))
        conn.commit()
except Exception as e:
    # Column likely already exists
    pass

root_path = os.getenv("ROOT_PATH", "")
app = FastAPI(root_path=root_path)

@app.get("/api/prices")
def get_prices(symbols: str):
    """
    Fetch current prices for a list of comma-separated symbols using yfinance.
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        return {}
    
    # Mapping for common indices/futures that might not be standard yf tickers
    ticker_map = {
        "NQ": "NQ=F",
        "MNQ": "MNQ=F",
        "ES": "ES=F",
        "MES": "MES=F",
        "SPY": "SPY",
        "QQQ": "QQQ"
    }
    
    query_list = [ticker_map.get(s, s) for s in symbol_list]
    
    try:
        logger.debug(f"Fetching prices for {query_list}")
        data = yf.download(query_list, period="1d", progress=False)
        prices = {}
        
        if data.empty:
            logger.warning("yfinance returned empty data")
            return {}

        close_data = data['Close']
        
        # Determine if we have multiple symbols or one
        # If multiple, close_data is a DataFrame. If one, it might be a Series.
        is_df = hasattr(close_data, "columns")
        
        for i, original_symbol in enumerate(symbol_list):
            query_symbol = query_list[i]
            try:
                val = None
                if is_df:
                    if query_symbol in close_data.columns:
                        val = close_data[query_symbol].iloc[-1]
                else:
                    # Single symbol Series
                    val = close_data.iloc[-1]

                if val is not None:
                    import math
                    f_val = float(val)
                    if not math.isnan(f_val):
                        prices[original_symbol] = f_val
            except Exception as e:
                logger.error(f"Error extracting {original_symbol}: {e}")
                continue
        
        logger.debug(f"Returning prices: {prices}")
        return prices
    except Exception as e:
        logger.error(f"Error fetching prices: {e}")
        return {}

def get_occ_symbol(pos) -> Optional[str]:
    if not pos.symbol or not pos.expiration_date or not pos.call_put or pos.strike_price is None:
        return None
    ticker = f"{pos.symbol:<6}"
    exp_str = pos.expiration_date.strftime("%y%m%d")
    cp_char = pos.call_put[0].upper()
    strike_str = f"{int(pos.strike_price * 1000):08d}"
    return f"{ticker}{exp_str}{cp_char}{strike_str}"

def load_ib_options_data() -> dict:
    ib_data_path = os.path.join("data", "ib_data.json")
    if not os.path.exists(ib_data_path):
        return {}
    try:
        import json
        with open(ib_data_path, "r") as f:
            data = json.load(f)
        return {
            item["description"].strip(): {
                "current_price": item.get("current_price"),
                "unrealized_profits": item.get("unrealized_profits")
            }
            for item in data.get("portfolio", [])
            if item.get("type") == "OPT" and "description" in item
        }
    except Exception as e:
        logger.error(f"Error loading ib_data.json: {e}")
        return {}

# API routes
@app.get("/api/positions", response_model=schemas.PositionsResponse)
def read_positions(status: str = None, db: Session = Depends(get_db)):
    positions = crud.get_positions(db, status=status)
    ib_opt_data = load_ib_options_data()
    for pos in positions:
        occ_symbol = get_occ_symbol(pos)
        if occ_symbol and occ_symbol in ib_opt_data:
            pos.ib_current_price = ib_opt_data[occ_symbol]["current_price"]
            pos.ib_unrealized_profits = ib_opt_data[occ_symbol]["unrealized_profits"]
        else:
            pos.ib_current_price = None
            pos.ib_unrealized_profits = None

    ib_report_dt = None
    ib_data_path = os.path.join("data", "ib_data.json")
    if os.path.exists(ib_data_path):
        try:
            import json
            with open(ib_data_path, "r") as f:
                data = json.load(f)
            ib_report_dt = data.get("metadata", {}).get("generated_datetime")
        except Exception as e:
            logger.error(f"Error reading generated_datetime from ib_data.json: {e}")

    return {
        "metadata": {
            "ib_report_datetime": ib_report_dt
        },
        "positions": positions
    }

@app.post("/api/positions/batch", response_model=List[schemas.Position])
def create_positions_batch(batch: schemas.PositionCreateBatch, db: Session = Depends(get_db)):
    return crud.create_positions_batch(db=db, batch=batch)

@app.put("/api/positions/{position_id}", response_model=schemas.Position)
def update_position(position_id: int, pos_update: schemas.PositionUpdate, db: Session = Depends(get_db)):
    db_position = crud.update_position(db=db, position_id=position_id, pos_update=pos_update)
    if db_position is None:
        raise HTTPException(status_code=404, detail="Position not found")
    return db_position

@app.post("/api/positions/{position_id}/close", response_model=schemas.Position)
def close_position(position_id: int, close_req: schemas.ClosePositionRequest, db: Session = Depends(get_db)):
    db_position = crud.close_position(db=db, position_id=position_id, close_req=close_req)
    if db_position is None:
        raise HTTPException(status_code=404, detail="Position not found")
    return db_position

@app.get("/api/positions/{position_id}", response_model=schemas.Position)
def read_position(position_id: int, db: Session = Depends(get_db)):
    db_position = db.query(models.Position).filter(models.Position.id == position_id).first()
    if db_position is None:
        raise HTTPException(status_code=404, detail="Position not found")
    
    ib_opt_data = load_ib_options_data()
    occ_symbol = get_occ_symbol(db_position)
    if occ_symbol and occ_symbol in ib_opt_data:
        db_position.ib_current_price = ib_opt_data[occ_symbol]["current_price"]
        db_position.ib_unrealized_profits = ib_opt_data[occ_symbol]["unrealized_profits"]
    else:
        db_position.ib_current_price = None
        db_position.ib_unrealized_profits = None
        
    return db_position

@app.put("/api/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: int, trans_update: schemas.TransactionUpdate, db: Session = Depends(get_db)):
    db_transaction = crud.update_transaction(db=db, transaction_id=transaction_id, trans_update=trans_update)
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return db_transaction

@app.delete("/api/positions/{position_id}")
def delete_position(position_id: int, db: Session = Depends(get_db)):
    crud.delete_position(db, position_id)
    return {"message": "Position deleted"}

@app.delete("/api/positions/group/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db)):
    crud.delete_group(db, group_id)
    return {"message": "Group deleted"}

# Serve frontend
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    index_file = os.path.join(frontend_path, "index.html")
    with open(index_file, "r") as f:
        content = f.read()
    return content

@app.get("/details", response_class=HTMLResponse)
async def read_details(request: Request):
    details_file = os.path.join(frontend_path, "details.html")
    with open(details_file, "r") as f:
        content = f.read()
    return content

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_config="log_config.json")

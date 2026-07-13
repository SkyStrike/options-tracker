from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String, index=True) # To group legs of a spread
    date_opened = Column(DateTime, default=datetime.utcnow)
    symbol = Column(String, index=True) # e.g. AMD
    expiration_date = Column(DateTime) # Global to the group
    contract_name = Column(String) # e.g. MAY 08 '26 295 Put
    strike_price = Column(Float)
    call_put = Column(String) # Call, Put
    initial_type = Column(String)  # BTO, STO
    status = Column(String, default="Open")
    multiplier = Column(Float, default=100.0)
    
    current_quantity = Column(Integer)
    total_cost_usd = Column(Float, default=0.0)
    max_loss = Column(Float, default=0.0) # Theoretical Max Loss for the group
    realized_pnl_usd = Column(Float, default=0.0)
    occ_symbol = Column(String, nullable=True)

    transactions = relationship("Transaction", back_populates="position")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(Integer, ForeignKey("positions.id"))
    date = Column(DateTime, default=datetime.utcnow)
    transaction_type = Column(String)  # BTO, STO, BTC, STC
    quantity = Column(Integer)
    option_price = Column(Float) # Individual contract price, e.g. 1.15
    commission = Column(Float, default=0.0)
    total_usd = Column(Float) # Final net amount from IBKR (Quantity * Option Price * 100 +/- Commission)

    position = relationship("Position", back_populates="transactions")

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class TransactionBase(BaseModel):
    date: datetime
    transaction_type: str
    quantity: int
    option_price: float
    commission: float
    total_usd: float

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    date: Optional[datetime] = None
    transaction_type: Optional[str] = None
    quantity: Optional[int] = None
    option_price: Optional[float] = None
    commission: Optional[float] = None
    total_usd: Optional[float] = None

class Transaction(TransactionBase):
    id: int
    position_id: int

    class Config:
        from_attributes = True

class LegCreate(BaseModel):
    contract_name: str
    strike_price: float
    call_put: str
    transaction_type: str # BTO, STO
    option_price: float
    commission: float
    total_usd: float

class PositionCreateBatch(BaseModel):
    symbol: str
    date_opened: datetime
    expiration_date: datetime
    quantity: int
    max_loss: float
    multiplier: float = 100.0
    legs: List[LegCreate]

class PositionUpdate(BaseModel):
    symbol: Optional[str] = None
    date_opened: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    contract_name: Optional[str] = None
    strike_price: Optional[float] = None
    call_put: Optional[str] = None
    initial_type: Optional[str] = None
    current_quantity: Optional[int] = None
    total_cost_usd: Optional[float] = None
    max_loss: Optional[float] = None
    multiplier: Optional[float] = None
    status: Optional[str] = None
    realized_pnl_usd: Optional[float] = None

class Position(BaseModel):
    id: int
    group_id: str
    date_opened: datetime
    symbol: str
    expiration_date: Optional[datetime] = None
    contract_name: str
    strike_price: Optional[float] = None
    call_put: Optional[str] = None
    initial_type: str
    status: str
    multiplier: float = 100.0
    current_quantity: int
    total_cost_usd: float
    max_loss: Optional[float] = 0.0
    realized_pnl_usd: float
    transactions: List[Transaction] = []
    ib_current_price: Optional[float] = None
    ib_unrealized_profits: Optional[float] = None
    occ_symbol: Optional[str] = None

    class Config:
        from_attributes = True

class ClosePositionRequest(BaseModel):
    date: datetime
    transaction_type: str
    quantity: int
    option_price: float
    commission: float
    total_usd: float

class PositionsMetadata(BaseModel):
    ib_report_datetime: Optional[str] = None

class PositionsResponse(BaseModel):
    metadata: PositionsMetadata
    positions: List[Position]

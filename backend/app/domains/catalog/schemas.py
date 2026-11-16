"""Response models of the catalog endpoints."""

from pydantic import BaseModel


class ProductOut(BaseModel):
    product_id: int
    canonical_name: str
    family: str
    variety: str
    group: str
    comparable_group: str | None


class MarketOut(BaseModel):
    market_id: int
    market_name: str
    city: str
    department: str
    latitude: float | None
    longitude: float | None

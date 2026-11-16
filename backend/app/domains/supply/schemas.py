"""Response models of the supply endpoint. Kilograms rounded to whole kilograms, shares with one decimal."""

from datetime import date

from pydantic import BaseModel


class DepartmentShare(BaseModel):
    code: str | None
    name: str
    kg: int
    share_pct: float


class MunicipalityShare(BaseModel):
    code: str
    name: str | None
    department: str | None
    kg: int
    share_pct: float


class SupplyOriginsOut(BaseModel):
    product_id: int
    product_name: str
    market_id: int | None
    market_name: str
    first_week_start: date | None
    last_week_start: date | None
    total_kg: int
    departments: list[DepartmentShare]
    municipalities: list[MunicipalityShare]
    imported_kg: int
    imported_share_pct: float
    message: str | None

"""Response models of the recommendations endpoint. Prices in whole pesos per kilogram."""

from datetime import date
from typing import Literal

from pydantic import BaseModel


class MarketPick(BaseModel):
    market_id: int
    market_name: str
    city: str
    target_iso_year: int
    target_iso_week: int
    target_week_start: date
    predicted_price: int
    lower_price: int
    upper_price: int
    latest_price: int | None
    expected_change_percent: float | None


class GroupRecommendation(BaseModel):
    comparable_group: str
    markets_compared: int
    buy: MarketPick
    sell: MarketPick
    difference_per_kg: int
    difference_pct: float
    confidence: Literal["alta", "baja"]
    distance_km: int


class RecommendationsOut(BaseModel):
    product_id: int
    product_name: str
    horizon: int
    unit: str
    groups: list[GroupRecommendation]
    message: str | None
    note: str

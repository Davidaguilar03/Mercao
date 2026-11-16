"""Response models of the price endpoints. Prices in whole pesos per kilogram, percentages with one decimal."""

from datetime import date

from pydantic import BaseModel, Field


class LatestWeek(BaseModel):
    iso_year: int
    iso_week: int
    week_start: date
    week_end: date


class HealthOut(BaseModel):
    status: str
    latest_week: LatestWeek | None


class LatestMarketPrice(BaseModel):
    market_id: int
    market_name: str
    city: str
    comparable_group: str
    week_start: date
    iso_year: int
    iso_week: int
    mean_price: int
    min_price: int | None
    max_price: int | None
    change_4w_pct: float | None
    change_52w_pct: float | None


class LatestPricesOut(BaseModel):
    product_id: int
    product_name: str
    unit: str
    markets: list[LatestMarketPrice]


class WeeklyPrice(BaseModel):
    week_start: date
    mean_price: int
    min_price: int | None
    max_price: int | None


class PriceHistoryOut(BaseModel):
    product_id: int
    product_name: str
    market_id: int
    market_name: str
    unit: str
    from_: date = Field(alias="from")
    to: date
    series: list[WeeklyPrice]


class MonthIndex(BaseModel):
    month: int
    month_name: str
    index: float


class SeasonalityOut(BaseModel):
    product_id: int
    product_name: str
    market_id: int
    market_name: str
    years_used: list[int]
    months: list[MonthIndex]
    cheapest_month: str | None
    most_expensive_month: str | None
    message: str | None

"""Response models of the forecasting endpoints. Prices in whole pesos per kilogram, percentages with one decimal."""

from datetime import date

from pydantic import BaseModel


class HorizonForecast(BaseModel):
    horizon: int
    target_iso_year: int
    target_iso_week: int
    target_week_start: date
    predicted_price: int
    lower_price: int
    upper_price: int


class MarketForecast(BaseModel):
    market_id: int
    market_name: str
    city: str
    comparable_group: str | None
    origin_iso_year: int
    origin_iso_week: int
    origin_week_start: date
    last_observed_price: int | None
    forecasts: list[HorizonForecast]


class ForecastsOut(BaseModel):
    product_id: int
    product_name: str
    unit: str
    model_version: str | None
    markets: list[MarketForecast]
    message: str | None


class SplitRange(BaseModel):
    start: date
    end: date
    start_iso: str
    end_iso: str


class Metrics(BaseModel):
    mae: int
    mape_pct: float
    directional_accuracy_pct: float | None
    skill_mae_pct: float
    skill_mape_pct: float


class ModelMetrics(Metrics):
    model: str
    label: str


class HorizonComparison(BaseModel):
    horizon: int
    model: Metrics
    naive: Metrics


class HorizonCoverage(BaseModel):
    horizon: int
    coverage_pct: float


class FeatureImportance(BaseModel):
    feature: str
    label: str
    importance_pct: float
    permutation_mae_increase: float


class ModelSummaryOut(BaseModel):
    model_type: str
    model_label: str
    model_version: str
    created_at: str
    target: str
    horizons: list[int]
    splits: dict[str, SplitRange]
    fitted_on: str
    selection_rule: str
    overall: list[ModelMetrics]
    by_horizon: list[HorizonComparison]
    interval_nominal_pct: int
    interval_coverage: list[HorizonCoverage]
    interval_coverage_overall_pct: float
    importance_kind: str | None
    top_features: list[FeatureImportance]

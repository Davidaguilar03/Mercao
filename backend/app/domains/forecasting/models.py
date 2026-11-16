"""Forecast table: predicted weekly mean price of each usable pair, h weeks after the origin week."""

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base
from backend.app.domains.catalog import models as catalog_models  # noqa: F401  (registers the referenced tables)


class Forecast(Base):
    """Prediction made at origin week (origin_iso_year, origin_iso_week) for the week `horizon` weeks later (COP/kg).

    lower_price and upper_price are the 10th and 90th percentile interval.
    """

    __tablename__ = "forecasts"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.product_id"), primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.market_id"), primary_key=True)
    origin_iso_year: Mapped[int] = mapped_column(Integer, primary_key=True)
    origin_iso_week: Mapped[int] = mapped_column(Integer, primary_key=True)
    horizon: Mapped[int] = mapped_column(Integer, primary_key=True)
    predicted_price: Mapped[float] = mapped_column(Float, nullable=False)
    lower_price: Mapped[float] = mapped_column(Float, nullable=False)
    upper_price: Mapped[float] = mapped_column(Float, nullable=False)
    model_version: Mapped[str] = mapped_column(String, primary_key=True)

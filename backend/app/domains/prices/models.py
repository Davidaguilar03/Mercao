"""Price tables: weekly prices, excluded rows, processed files and product-market coverage."""

from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class PriceFile(Base):
    """One weekly annex with its published label and the ISO week it was assigned to."""

    __tablename__ = "price_files"

    file_name: Mapped[str] = mapped_column(String, primary_key=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    label_start: Mapped[date | None] = mapped_column(Date)
    label_end: Mapped[date | None] = mapped_column(Date)
    label_days: Mapped[int | None] = mapped_column(Integer)
    iso_year: Mapped[int | None] = mapped_column(Integer)
    iso_week: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, nullable=False)
    rows_read: Mapped[int] = mapped_column(Integer, nullable=False)
    layout: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str] = mapped_column(String, nullable=False, default="")


class _PriceColumns:
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    iso_year: Mapped[int] = mapped_column(Integer, nullable=False)
    iso_week: Mapped[int] = mapped_column(Integer, nullable=False)
    product_name: Mapped[str] = mapped_column(String, nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.product_id"))
    variety: Mapped[str | None] = mapped_column(String)
    market_name: Mapped[str] = mapped_column(String, nullable=False)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.market_id"))
    min_price: Mapped[float | None] = mapped_column(Float)
    max_price: Mapped[float | None] = mapped_column(Float)
    mean_price: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String, nullable=False)


class Price(_PriceColumns, Base):
    """Clean weekly wholesale price of one product in one market (COP per unit).

    Every ISO week comes from exactly one annex, so the source file is price_files joined on (iso_year, iso_week).
    """

    __tablename__ = "prices"
    __table_args__ = (Index("ix_prices_pair_week", "product_id", "market_id", "iso_year", "iso_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    range_inconsistent: Mapped[bool] = mapped_column(Boolean, nullable=False)


class PriceExclusion(_PriceColumns, Base):
    """Rows removed from prices, with the rule that removed them."""

    __tablename__ = "price_exclusions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_file: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False, index=True)
    detail: Mapped[str] = mapped_column(String, nullable=False, default="")


class Coverage(Base):
    """Weekly coverage of every product-market pair and whether the forecasting model may use it."""

    __tablename__ = "coverage"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.product_id"), primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.market_id"), primary_key=True)
    first_week: Mapped[date] = mapped_column(Date, nullable=False)
    last_week: Mapped[date] = mapped_column(Date, nullable=False)
    n_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    weeks_since_2016: Mapped[int] = mapped_column(Integer, nullable=False)
    missing_share_since_2016: Mapped[float] = mapped_column(Float, nullable=False)
    has_recent_data: Mapped[bool] = mapped_column(Boolean, nullable=False)
    usable_for_model: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True)
    comparable_group: Mapped[str] = mapped_column(String, nullable=False, index=True)

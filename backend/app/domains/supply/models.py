"""Supply tables: daily volumes by origin and the weekly aggregate that joins with prices."""

from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class Supply(Base):
    """Kilograms of one product entering one market on one day from one origin (DANE SIPSA microdata).

    Every published row is kept; market_id and product_id are empty outside the focus set.
    """

    __tablename__ = "supply"
    __table_args__ = (Index("ix_supply_market_product_date", "market_id", "product_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    market_name: Mapped[str] = mapped_column(String, nullable=False)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.market_id"))
    product_name: Mapped[str] = mapped_column(String, nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.product_id"))
    origin_department_code: Mapped[str | None] = mapped_column(String)
    origin_department_name: Mapped[str | None] = mapped_column(String)
    origin_municipality_code: Mapped[str | None] = mapped_column(String)
    origin_municipality_name: Mapped[str | None] = mapped_column(String)
    origin_country: Mapped[str | None] = mapped_column(String)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)


class SupplyWeekly(Base):
    """Supply of the focus products and markets summed by ISO week, to join with the weekly price table."""

    __tablename__ = "supply_weekly"

    iso_year: Mapped[int] = mapped_column(Integer, primary_key=True)
    iso_week: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.market_id"), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.product_id"), primary_key=True)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)

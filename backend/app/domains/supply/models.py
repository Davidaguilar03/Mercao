"""Supply tables: weekly volumes of the focus products by origin, weekly totals and origin lookups."""

from sqlalchemy import Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class OriginDepartment(Base):
    """Official DIVIPOLA department."""

    __tablename__ = "origin_departments"

    code: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)


class OriginMunicipality(Base):
    """Municipality of origin; the name is the most frequent spelling published for the code."""

    __tablename__ = "origin_municipalities"

    code: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    department_code: Mapped[str] = mapped_column(ForeignKey("origin_departments.code"), nullable=False)


class Supply(Base):
    """Kilograms of one focus product entering one focus market in one ISO week from one origin.

    Origin codes are empty for imported food (then origin_country is the country) and for unknown origins.
    """

    __tablename__ = "supply"
    __table_args__ = (Index("ix_supply_pair_week", "product_id", "market_id", "iso_year", "iso_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    iso_year: Mapped[int] = mapped_column(Integer, nullable=False)
    iso_week: Mapped[int] = mapped_column(Integer, nullable=False)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.market_id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.product_id"), nullable=False)
    origin_department_code: Mapped[str | None] = mapped_column(ForeignKey("origin_departments.code"))
    origin_municipality_code: Mapped[str | None] = mapped_column(ForeignKey("origin_municipalities.code"))
    origin_country: Mapped[str | None] = mapped_column(String)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)


class SupplyWeekly(Base):
    """Supply of the focus products and markets summed by ISO week (all origins), to join with prices."""

    __tablename__ = "supply_weekly"

    iso_year: Mapped[int] = mapped_column(Integer, primary_key=True)
    iso_week: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.market_id"), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.product_id"), primary_key=True)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)

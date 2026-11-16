"""Catalog tables: products, markets and the mappings from published names."""

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class Product(Base):
    """One focus product variety. Prices of different products are never compared with each other."""

    __tablename__ = "products"

    product_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    canonical_name: Mapped[str] = mapped_column(String, nullable=False)
    family: Mapped[str] = mapped_column(String, nullable=False, index=True)
    variety: Mapped[str] = mapped_column(String, nullable=False)
    group: Mapped[str] = mapped_column("group", String, nullable=False)


class ProductMapping(Base):
    """Published product name (prices or supply) -> product_id, with the rule that produced the match."""

    __tablename__ = "product_mapping"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String, nullable=False)
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.product_id"), nullable=False)
    method: Mapped[str] = mapped_column(String, nullable=False)
    cpc_code: Mapped[str] = mapped_column(String, nullable=False, default="")


class Market(Base):
    """Wholesale market. Coordinates are approximate (city centre) and only meant for a map."""

    __tablename__ = "markets"

    market_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_name: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)


class MarketMapping(Base):
    """Published market name -> market_id."""

    __tablename__ = "market_mapping"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String, nullable=False)
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.market_id"), nullable=False)
    method: Mapped[str] = mapped_column(String, nullable=False)

"""SQL queries of the catalog: focus products (with their comparable group) and markets."""

from sqlalchemy import RowMapping, text
from sqlalchemy.orm import Session

_PRODUCTS = """
    SELECT p.product_id, p.canonical_name, p.family, p.variety, p."group",
           (SELECT c.comparable_group FROM coverage c WHERE c.product_id = p.product_id LIMIT 1) AS comparable_group
    FROM products p
"""
_MARKETS = "SELECT market_id, market_name, city, department, latitude, longitude FROM markets"


def list_products(session: Session) -> list[RowMapping]:
    return list(session.execute(text(_PRODUCTS + " ORDER BY p.product_id")).mappings())


def find_product(session: Session, product_id: int) -> RowMapping | None:
    return session.execute(text(_PRODUCTS + " WHERE p.product_id = :id"), {"id": product_id}).mappings().first()


def list_markets(session: Session) -> list[RowMapping]:
    return list(session.execute(text(_MARKETS + " ORDER BY market_id")).mappings())


def find_market(session: Session, market_id: int) -> RowMapping | None:
    return session.execute(text(_MARKETS + " WHERE market_id = :id"), {"id": market_id}).mappings().first()

"""Catalog lookups shared by every domain: an unknown product or market is a 404 with a Spanish message."""

from sqlalchemy import RowMapping
from sqlalchemy.orm import Session

from backend.app.core.errors import NotFoundError
from backend.app.domains.catalog import repository


def list_products(session: Session) -> list[RowMapping]:
    return repository.list_products(session)


def list_markets(session: Session) -> list[RowMapping]:
    return repository.list_markets(session)


def get_product(session: Session, product_id: int) -> RowMapping:
    product = repository.find_product(session, product_id)
    if product is None:
        raise NotFoundError(f"No existe el producto {product_id}.")
    return product


def get_market(session: Session, market_id: int) -> RowMapping:
    market = repository.find_market(session, market_id)
    if market is None:
        raise NotFoundError(f"No existe el mercado {market_id}.")
    return market

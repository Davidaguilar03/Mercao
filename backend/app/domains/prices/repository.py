"""SQL queries of the price endpoints. Dates are stored as ISO text, so they are passed and compared as text."""

from datetime import date

from sqlalchemy import RowMapping, bindparam, text
from sqlalchemy.orm import Session


def latest_week(session: Session) -> RowMapping | None:
    """Latest ISO week with a processed weekly bulletin."""
    return session.execute(text(
        "SELECT iso_year, iso_week FROM price_files WHERE status = 'ok' ORDER BY iso_year DESC, iso_week DESC LIMIT 1"
    )).mappings().first()


def usable_markets(session: Session, product_id: int) -> list[RowMapping]:
    return list(session.execute(text("""
        SELECT c.market_id, m.market_name, m.city, c.comparable_group, c.last_week
        FROM coverage c JOIN markets m ON m.market_id = c.market_id
        WHERE c.product_id = :product_id AND c.usable_for_model = 1
        ORDER BY c.market_id
    """), {"product_id": product_id}).mappings())


def pair_last_week(session: Session, product_id: int, market_id: int) -> str | None:
    return session.execute(text(
        "SELECT last_week FROM coverage WHERE product_id = :product_id AND market_id = :market_id"
    ), {"product_id": product_id, "market_id": market_id}).scalar()


def weekly_prices(session: Session, product_id: int, market_ids: list[int], start: date, end: date
                  ) -> list[RowMapping]:
    """Weekly rows of a product in some markets between two week starts (inclusive), oldest first."""
    query = text("""
        SELECT market_id, week_start, iso_year, iso_week, mean_price, min_price, max_price
        FROM prices
        WHERE product_id = :product_id AND market_id IN :market_ids
          AND week_start >= :start AND week_start <= :end
        ORDER BY market_id, week_start
    """).bindparams(bindparam("market_ids", expanding=True))
    return list(session.execute(query, {"product_id": product_id, "market_ids": market_ids,
                                        "start": start.isoformat(), "end": end.isoformat()}).mappings())

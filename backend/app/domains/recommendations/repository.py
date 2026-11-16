"""SQL query of the recommendations endpoint: latest forecast of every market of a product for one horizon."""

from sqlalchemy import RowMapping, text
from sqlalchemy.orm import Session


def horizon_forecasts(session: Session, product_id: int, horizon: int) -> list[RowMapping]:
    return list(session.execute(text("""
        SELECT f.market_id, m.market_name, m.city, c.comparable_group, f.target_iso_year, f.target_iso_week,
               f.target_week_start, f.predicted_price, f.lower_price, f.upper_price
        FROM forecasts f
        JOIN markets m ON m.market_id = f.market_id
        JOIN coverage c ON c.product_id = f.product_id AND c.market_id = f.market_id
        WHERE f.product_id = :product_id AND f.horizon = :horizon
          AND f.origin_iso_year * 100 + f.origin_iso_week = (
              SELECT MAX(g.origin_iso_year * 100 + g.origin_iso_week) FROM forecasts g
              WHERE g.product_id = f.product_id AND g.market_id = f.market_id)
        ORDER BY c.comparable_group, f.market_id
    """), {"product_id": product_id, "horizon": horizon}).mappings())

"""SQL query of the recommendations endpoint: latest forecast of every market of a product for one horizon."""
# Each row also carries the market coordinates and the price observed in the origin week of the forecast.

from sqlalchemy import RowMapping, text
from sqlalchemy.orm import Session


def horizon_forecasts(session: Session, product_id: int, horizon: int) -> list[RowMapping]:
    return list(session.execute(text("""
        SELECT f.market_id, m.market_name, m.city, m.latitude, m.longitude, c.comparable_group, f.target_iso_year,
               f.target_iso_week, f.target_week_start, f.predicted_price, f.lower_price, f.upper_price,
               p.mean_price AS latest_price
        FROM forecasts f
        JOIN markets m ON m.market_id = f.market_id
        JOIN coverage c ON c.product_id = f.product_id AND c.market_id = f.market_id
        LEFT JOIN prices p ON p.product_id = f.product_id AND p.market_id = f.market_id
             AND p.iso_year = f.origin_iso_year AND p.iso_week = f.origin_iso_week
        WHERE f.product_id = :product_id AND f.horizon = :horizon
          AND f.origin_iso_year * 100 + f.origin_iso_week = (
              SELECT MAX(g.origin_iso_year * 100 + g.origin_iso_week) FROM forecasts g
              WHERE g.product_id = f.product_id AND g.market_id = f.market_id)
        ORDER BY c.comparable_group, f.market_id
    """), {"product_id": product_id, "horizon": horizon}).mappings())

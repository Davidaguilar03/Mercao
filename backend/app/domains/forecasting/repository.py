"""Data access of the forecasting endpoints: the forecasts table and the saved model metadata."""

import json
from pathlib import Path

from sqlalchemy import RowMapping, text
from sqlalchemy.orm import Session


def latest_forecasts(session: Session, product_id: int, market_id: int | None) -> list[RowMapping]:
    """Forecasts of the latest origin week of each pair, with the price observed in that week."""
    market_filter = "AND f.market_id = :market_id" if market_id is not None else ""
    return list(session.execute(text(f"""
        SELECT f.market_id, m.market_name, m.city, c.comparable_group, f.origin_iso_year, f.origin_iso_week,
               f.horizon, f.target_iso_year, f.target_iso_week, f.target_week_start, f.predicted_price,
               f.lower_price, f.upper_price, f.model_version, p.mean_price AS last_observed_price
        FROM forecasts f
        JOIN markets m ON m.market_id = f.market_id
        LEFT JOIN coverage c ON c.product_id = f.product_id AND c.market_id = f.market_id
        LEFT JOIN prices p ON p.product_id = f.product_id AND p.market_id = f.market_id
             AND p.iso_year = f.origin_iso_year AND p.iso_week = f.origin_iso_week
        WHERE f.product_id = :product_id {market_filter}
          AND f.origin_iso_year * 100 + f.origin_iso_week = (
              SELECT MAX(g.origin_iso_year * 100 + g.origin_iso_week) FROM forecasts g
              WHERE g.product_id = f.product_id AND g.market_id = f.market_id)
        ORDER BY f.market_id, f.horizon
    """), {"product_id": product_id, "market_id": market_id}).mappings())


def load_metadata(models_dir: Path) -> dict | None:
    path = models_dir / "metadata.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

"""Where to buy and where to sell: cheapest and most expensive forecast inside each comparable group."""

from itertools import groupby

from sqlalchemy.orm import Session

from backend.app.domains.catalog import service as catalog
from backend.app.domains.prices.service import round_price
from backend.app.domains.recommendations import repository

DEFAULT_HORIZON = 2
COSTS_NOTE = ("Las diferencias no incluyen costos de transporte ni de intermediación entre mercados. Los precios son "
              "pronósticos del precio mayorista medio con un intervalo del 80 %.")


def _market(row: dict) -> dict:
    return {"market_id": row["market_id"], "market_name": row["market_name"], "city": row["city"],
            "target_iso_year": row["target_iso_year"], "target_iso_week": row["target_iso_week"],
            "target_week_start": row["target_week_start"], "predicted_price": round_price(row["predicted_price"]),
            "lower_price": round_price(row["lower_price"]), "upper_price": round_price(row["upper_price"])}


def compare_group(rows: list[dict]) -> dict | None:
    """Lowest and highest forecast of one comparable group; None if fewer than two markets.

    Confidence is "alta" when the 80 % intervals of both markets do not overlap (the upper bound of the cheapest
    market is below the lower bound of the most expensive one) and "baja" otherwise.
    """
    if len(rows) < 2:
        return None
    buy = _market(min(rows, key=lambda r: r["predicted_price"]))
    sell = _market(max(rows, key=lambda r: r["predicted_price"]))
    difference = sell["predicted_price"] - buy["predicted_price"]
    return {
        "comparable_group": rows[0]["comparable_group"],
        "markets_compared": len(rows),
        "buy": buy,
        "sell": sell,
        "difference_per_kg": difference,
        "difference_pct": round(difference / buy["predicted_price"] * 100, 1),
        "confidence": "alta" if buy["upper_price"] < sell["lower_price"] else "baja",
    }


def recommendations(session: Session, product_id: int, horizon: int) -> dict:
    product = catalog.get_product(session, product_id)
    rows = [dict(r) for r in repository.horizon_forecasts(session, product_id, horizon)]
    groups = [compare_group(list(group)) for _, group in groupby(rows, key=lambda r: r["comparable_group"])]
    groups = [g for g in groups if g is not None]
    return {
        "product_id": product_id, "product_name": product["canonical_name"], "horizon": horizon, "unit": "kg",
        "groups": groups,
        "message": None if groups else "No hay al menos dos mercados comparables con pronóstico para este producto.",
        "note": COSTS_NOTE,
    }

"""Latest forecasts by market and the transparency summary of the trained model."""

import math
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from backend.app.core.errors import NotFoundError
from backend.app.domains.catalog import service as catalog
from backend.app.domains.forecasting import repository
from backend.app.domains.forecasting.labels import FEATURE_LABELS, MODEL_LABELS
from backend.app.domains.prices.service import round_price

TOP_FEATURES = 5
INTERVAL_NOMINAL_PCT = 80
NATIVE_IMPORTANCE_LABELS = {"gain": "Ganancia de LightGBM", "impurity": "Reducción de impureza",
                            "abs_coefficient": "Coeficiente absoluto"}


def forecasts(session: Session, product_id: int, market_id: int | None) -> dict:
    product = catalog.get_product(session, product_id)
    if market_id is not None:
        catalog.get_market(session, market_id)
    rows = repository.latest_forecasts(session, product_id, market_id)
    result = {"product_id": product_id, "product_name": product["canonical_name"], "unit": "kg",
              "model_version": rows[0]["model_version"] if rows else None, "markets": [], "message": None}
    if not rows:
        result["message"] = "No hay pronósticos para este producto en el mercado pedido."
        return result
    markets: dict[int, dict] = {}
    for row in rows:
        market = markets.setdefault(row["market_id"], {
            "market_id": row["market_id"], "market_name": row["market_name"], "city": row["city"],
            "comparable_group": row["comparable_group"], "origin_iso_year": row["origin_iso_year"],
            "origin_iso_week": row["origin_iso_week"],
            "origin_week_start": date.fromisocalendar(row["origin_iso_year"], row["origin_iso_week"], 1),
            "last_observed_price": round_price(row["last_observed_price"]), "forecasts": []})
        market["forecasts"].append({
            "horizon": row["horizon"], "target_iso_year": row["target_iso_year"],
            "target_iso_week": row["target_iso_week"], "target_week_start": row["target_week_start"],
            "predicted_price": round_price(row["predicted_price"]), "lower_price": round_price(row["lower_price"]),
            "upper_price": round_price(row["upper_price"])})
    result["markets"] = list(markets.values())
    return result


def _pct(value: float | None) -> float | None:
    return None if value is None or math.isnan(value) else round(value, 1)


def _metrics(row: dict) -> dict:
    return {"mae": round_price(row["mae"]), "mape_pct": _pct(row["mape"]),
            "directional_accuracy_pct": _pct(row["directional_accuracy"]),
            "skill_mae_pct": _pct(row["skill_mae"]), "skill_mape_pct": _pct(row["skill_mape"])}


def model_summary(models_dir: Path) -> dict:
    """Read from models/metadata.json, written by python -m backend.scripts.train_models."""
    metadata = repository.load_metadata(models_dir)
    if metadata is None:
        raise NotFoundError("El modelo todavía no se ha entrenado: no hay metadatos en la carpeta models/.")
    chosen = metadata["model_type"]
    tests = metadata["test_metrics"]
    by_horizon = {(r["model"], r["horizon"]): r for r in tests["by_horizon"]}
    coverage = metadata["interval_coverage_test"]
    importance = metadata.get("feature_importance")
    top_features = []
    if importance:
        native = importance["native_pct"]
        permutation = importance["permutation_mae_increase"]
        for name in sorted(native, key=native.get, reverse=True)[:TOP_FEATURES]:
            top_features.append({"feature": name, "label": FEATURE_LABELS.get(name, name),
                                 "importance_pct": round(native[name], 1),
                                 "permutation_mae_increase": round(permutation[name], 5)})
    return {
        "model_type": chosen,
        "model_label": MODEL_LABELS.get(chosen, chosen),
        "model_version": metadata["model_version"],
        "created_at": metadata["created_at"],
        "target": metadata["target"],
        "horizons": metadata["horizons"],
        "splits": {name: {"start": s["start"], "end": s["end"], "start_iso": s["start_iso"], "end_iso": s["end_iso"]}
                   for name, s in metadata["splits"].items()},
        "fitted_on": metadata["fitted_on"],
        "selection_rule": "Menor MAPE de validación promediado sobre los horizontes.",
        "overall": [{"model": r["model"], "label": MODEL_LABELS.get(r["model"], r["model"]), **_metrics(r)}
                    for r in sorted(tests["overall"], key=lambda r: r["mape"])],
        "by_horizon": [{"horizon": h, "model": _metrics(by_horizon[(chosen, h)]),
                        "naive": _metrics(by_horizon[("naive", h)])} for h in metadata["horizons"]],
        "interval_nominal_pct": INTERVAL_NOMINAL_PCT,
        "interval_coverage": [{"horizon": int(h), "coverage_pct": _pct(v)} for h, v in coverage.items()
                              if h != "overall"],
        "interval_coverage_overall_pct": _pct(coverage["overall"]),
        "importance_kind": NATIVE_IMPORTANCE_LABELS.get(importance["native_kind"]) if importance else None,
        "top_features": top_features,
    }

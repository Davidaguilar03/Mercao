"""Train, compare and evaluate the forecasting models; save the final model, its metadata and the report figures.

Usage: python -m backend.scripts.train_models

Writes models/forecast_h{1..4}.joblib, models/metadata.json, models/training.log and the figures in docs/figures.
"""

import logging
import time
from datetime import datetime

import pandas as pd

from backend.app.core.config import REPO_ROOT
from backend.app.core.database import create_db_engine
from backend.app.core.logging import configure_logging
from backend.app.domains.forecasting import figures
from backend.app.domains.forecasting.dataset import (
    FEATURES,
    HORIZONS,
    SINCE_YEAR,
    SUPPLY_LAG_WEEKS,
    build_features,
    load_series,
)
from backend.app.domains.forecasting.estimators import FIXED_PARAMS
from backend.app.domains.forecasting.forecasts import MODELS_DIR, save_models
from backend.app.domains.forecasting.training import interval_coverage, metric_tables, train_and_evaluate
from backend.app.domains.forecasting.validation import make_splits

FIGURES_DIR = REPO_ROOT / "docs" / "figures"
NATIVE_LABELS = {"lightgbm": "Ganancia (% del total)", "random_forest": "Reducción de impureza (% del total)",
                 "ridge": "|Coeficiente| estandarizado (% del total)"}
POTATO_ID, BOGOTA_ID = 1, 1


def main() -> None:
    configure_logging(MODELS_DIR / "training.log")
    log = logging.getLogger(__name__)
    started = time.perf_counter()
    engine = create_db_engine()

    frame = build_features(load_series(engine))
    splits = make_splits(frame)
    ranges = splits.date_ranges()
    log.info("Rows with features: %d, pairs: %d", len(frame), frame.groupby(["product_id", "market_id"]).ngroups)
    log.info("Splits: %s", ranges)

    result = train_and_evaluate(frame, splits)
    tables = metric_tables(result.test_predictions)
    coverage = interval_coverage(result.test_predictions, result.final_model)
    training_seconds = time.perf_counter() - started
    final = result.final_model
    log.info("Validation MAPE by model and horizon:\n%s", result.validation_mape.round(2).to_string())
    for name, table in tables.items():
        log.info("Test %s:\n%s", name, table.round(2).to_string())
    log.info("Final model: %s. Interval coverage on test:\n%s", final, coverage.round(1).to_string())
    if result.native_importance is not None:
        log.info("Native importance:\n%s", result.native_importance.sort_values(ascending=False).round(2).to_string())
        log.info("Permutation importance:\n%s",
                 result.permutation_importance.sort_values(ascending=False).round(5).to_string())

    products = pd.read_sql("SELECT product_id, canonical_name FROM products", engine)
    product_names = dict(zip(products["product_id"], products["canonical_name"]))
    figures.model_comparison(tables["by_horizon"], FIGURES_DIR / "forecast_model_comparison.png")
    figures.error_by_product(tables["by_product"], final, product_names, FIGURES_DIR / "forecast_error_by_product.png")
    potato = result.test_predictions[(result.test_predictions["model"] == final)
                                     & (result.test_predictions["product_id"] == POTATO_ID)
                                     & (result.test_predictions["market_id"] == BOGOTA_ID)]
    figures.predicted_vs_actual(potato, "Papa parda pastusa en Bogotá (Corabastos): pronóstico y precio observado",
                                FIGURES_DIR / "forecast_potato_bogota.png")
    if result.native_importance is not None:
        figures.feature_importance(result.native_importance, result.permutation_importance, NATIVE_LABELS[final],
                                   FIGURES_DIR / "forecast_feature_importance.png")

    created = datetime.now()
    metadata = {
        "model_type": final,
        "model_version": f"{final}-{created:%Y%m%d%H%M}",
        "created_at": created.isoformat(timespec="seconds"),
        "horizons": list(HORIZONS),
        "target": "log(price[t+h] / price[t])",
        "features": FEATURES,
        "data_since_year": SINCE_YEAR,
        "supply_lag_weeks": SUPPLY_LAG_WEEKS,
        "splits": ranges,
        "fitted_on": "train + validation",
        "row_counts": result.row_counts,
        "hyperparameters": {str(h): {**FIXED_PARAMS.get(final, {}), **p} for h, p in result.best_params[final].items()},
        "selected_hyperparameters_all_models": {m: {str(h): p for h, p in ps.items()}
                                                for m, ps in result.best_params.items()},
        "interval_offsets": {str(h): list(v) for h, v in result.interval_offsets.items()},
        "interval_coverage_test": coverage.round(2).to_dict(),
        "validation_mape": result.validation_mape.round(3).to_dict(),
        "test_metrics": {name: table.round(3).to_dict("records") for name, table in tables.items()},
        "fit_seconds_by_model": {m: round(s, 1) for m, s in result.seconds.items()},
        "training_seconds": round(training_seconds, 1),
    }
    save_models(result.final_models, metadata)
    log.info("Saved %s to %s in %.0f s", metadata["model_version"], MODELS_DIR, training_seconds)


if __name__ == "__main__":
    main()

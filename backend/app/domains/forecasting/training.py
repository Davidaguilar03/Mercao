"""Model selection on the validation year, evaluation on the test set, intervals and feature importance.

Every model and horizon follows the same steps (direct strategy, one model per horizon):
1. Fit each hyperparameter set on the training split and keep the one with the lowest validation MAPE.
2. Refit that set on training + validation and predict the test set.
The final model is the one with the lowest validation MAPE averaged over horizons. Its prediction intervals come
from the 10th and 90th percentiles of its validation residuals (model fitted on training only), per horizon.
"""

import logging
import time
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

from backend.app.domains.forecasting.dataset import FEATURES, HORIZONS, horizon_rows, target_column
from backend.app.domains.forecasting.estimators import MODEL_NAMES, PARAM_GRIDS, make_model, native_importance
from backend.app.domains.forecasting.metrics import (
    coverage,
    directional_accuracy,
    interval_offsets,
    interval_prices,
    mae,
    mape,
    skill,
)
from backend.app.domains.forecasting.validation import Splits

logger = logging.getLogger(__name__)


@dataclass
class TrainingResult:
    final_model: str
    best_params: dict[str, dict[int, dict]]
    validation_mape: pd.DataFrame
    test_predictions: pd.DataFrame
    interval_offsets: dict[int, tuple[float, float]]
    final_models: dict[int, object]
    native_importance: pd.Series | None
    permutation_importance: pd.Series | None
    row_counts: dict[int, dict[str, int]]
    seconds: dict[str, float] = field(default_factory=dict)


def _predictions(rows: pd.DataFrame, log_ratio: np.ndarray, model: str, h: int) -> pd.DataFrame:
    current = rows["mean_price"].to_numpy()
    return pd.DataFrame({
        "model": model, "horizon": h, "product_id": rows["product_id"].to_numpy(),
        "market_id": rows["market_id"].to_numpy(), "week_index": rows["week_index"].to_numpy(),
        "current_price": current, "actual_price": current * np.exp(rows[target_column(h)].to_numpy()),
        "predicted_log_ratio": log_ratio, "predicted_price": current * np.exp(log_ratio),
    })


def train_and_evaluate(frame: pd.DataFrame, splits: Splits) -> TrainingResult:
    best_params: dict[str, dict[int, dict]] = {name: {} for name in MODEL_NAMES}
    validation_mape = pd.DataFrame(index=MODEL_NAMES, columns=list(HORIZONS), dtype=float)
    validation_residuals: dict[tuple[str, int], np.ndarray] = {}
    test_parts, fitted, row_counts, seconds = [], {}, {}, {name: 0.0 for name in MODEL_NAMES}

    for h in HORIZONS:
        rows = horizon_rows(frame, h)
        masks = splits.masks(rows)
        train, valid, test = (rows[masks[s]] for s in ("train", "validation", "test"))
        train_valid = rows[masks["train"] | masks["validation"]]
        row_counts[h] = {"train": len(train), "validation": len(valid), "test": len(test)}
        y_col = target_column(h)
        valid_current = valid["mean_price"].to_numpy()
        valid_actual = valid_current * np.exp(valid[y_col].to_numpy())

        for name in MODEL_NAMES:
            start = time.perf_counter()
            best = None
            for params in PARAM_GRIDS[name]:
                model = make_model(name, h, params).fit(train, train[y_col].to_numpy())
                predicted = model.predict(valid)
                score = mape(valid_actual, valid_current * np.exp(predicted))
                logger.info("h=%d %s %s validation MAPE %.2f", h, name, params, score)
                if best is None or score < best[0]:
                    best = (score, params, valid[y_col].to_numpy() - predicted)
            score, params, residuals = best
            best_params[name][h] = params
            validation_mape.loc[name, h] = score
            validation_residuals[(name, h)] = residuals

            model = make_model(name, h, params).fit(train_valid, train_valid[y_col].to_numpy())
            fitted[(name, h)] = model
            test_parts.append(_predictions(test, model.predict(test), name, h))
            seconds[name] += time.perf_counter() - start

    final_model = validation_mape.mean(axis=1).idxmin()
    offsets = {h: interval_offsets(validation_residuals[(final_model, h)]) for h in HORIZONS}
    test_predictions = pd.concat(test_parts, ignore_index=True)
    final_rows = test_predictions["model"] == final_model
    for h in HORIZONS:
        rows = final_rows & (test_predictions["horizon"] == h)
        lower, upper = interval_prices(test_predictions.loc[rows, "current_price"].to_numpy(),
                                       test_predictions.loc[rows, "predicted_log_ratio"].to_numpy(), offsets[h])
        test_predictions.loc[rows, "lower_price"] = lower
        test_predictions.loc[rows, "upper_price"] = upper

    final_models = {h: fitted[(final_model, h)] for h in HORIZONS}
    native, permutation = _importances(final_model, final_models, frame, splits)
    return TrainingResult(final_model, best_params, validation_mape, test_predictions, offsets, final_models,
                          native, permutation, row_counts, seconds)


def _importances(name: str, models: dict[int, object], frame: pd.DataFrame, splits: Splits
                 ) -> tuple[pd.Series | None, pd.Series | None]:
    """Native importance and test-set permutation importance (increase in MAE of the log ratio), mean over horizons."""
    if name in ("naive", "seasonal_naive"):
        return None, None
    native_parts, permutation_parts = [], []
    for h, model in models.items():
        rows = horizon_rows(frame, h)
        test = rows[splits.masks(rows)["test"]]
        native_parts.append(native_importance(name, model))
        result = permutation_importance(
            model, test[FEATURES], test[target_column(h)].to_numpy(), n_repeats=5, random_state=0,
            scoring=lambda est, X, y: -np.mean(np.abs(y - est.predict(X))))  # noqa: N803
        permutation_parts.append(pd.Series(result.importances_mean, index=FEATURES))
    native = pd.concat(native_parts, axis=1).mean(axis=1)
    return native / native.sum() * 100, pd.concat(permutation_parts, axis=1).mean(axis=1)


def _scores(group: pd.DataFrame) -> pd.Series:
    current, actual, predicted = (group[c].to_numpy() for c in ("current_price", "actual_price", "predicted_price"))
    return pd.Series({"mae": mae(actual, predicted), "mape": mape(actual, predicted),
                      "directional_accuracy": directional_accuracy(current, actual, predicted), "n": len(group)})


def metric_tables(predictions: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Test metrics overall, by horizon and by product, with skill over naive on MAE and MAPE."""
    tables = {}
    for name, keys in (("overall", []), ("by_horizon", ["horizon"]), ("by_product", ["product_id"])):
        scores = predictions.groupby(["model"] + keys).apply(_scores, include_groups=False).reset_index()
        naive = scores.loc[scores["model"] == "naive", keys + ["mae", "mape"]]
        if keys:
            scores = scores.merge(naive, on=keys, suffixes=("", "_naive"))
        else:
            scores = scores.merge(naive, how="cross", suffixes=("", "_naive"))
        for metric in ("mae", "mape"):
            scores[f"skill_{metric}"] = [skill(e, r) for e, r in zip(scores[metric], scores[f"{metric}_naive"])]
        tables[name] = scores.drop(columns=["mae_naive", "mape_naive"])
    return tables


def interval_coverage(predictions: pd.DataFrame, final_model: str) -> pd.Series:
    """Share (%) of test prices inside the final model's interval, per horizon and overall."""
    rows = predictions[predictions["model"] == final_model]
    by_horizon = rows.groupby("horizon").apply(
        lambda g: coverage(g["actual_price"], g["lower_price"], g["upper_price"]), include_groups=False)
    by_horizon.loc["overall"] = coverage(rows["actual_price"], rows["lower_price"], rows["upper_price"])
    return by_horizon

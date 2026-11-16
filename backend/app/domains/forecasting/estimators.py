"""The five models compared. Every model predicts the log ratio log(price[t+h] / price[t]) for one horizon.

Baselines read the columns they need from the feature frame and ignore training data. Ridge and Random Forest
receive product and market one-hot encoded and an unknown supply as 0 (no deviation from its average) next to the
supply_available flag. LightGBM receives product and market as native categories and the empty supply as missing.
"""

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

from backend.app.domains.forecasting.dataset import (
    CATEGORICAL_FEATURES,
    FEATURES,
    REQUIRED_FEATURES,
    SUPPLY_FEATURES,
    seasonal_column,
)

RANDOM_STATE = 42
NUMERIC_FEATURES = REQUIRED_FEATURES + SUPPLY_FEATURES

# Small grids, searched on the validation year for each horizon.
PARAM_GRIDS: dict[str, list[dict]] = {
    "naive": [{}],
    "seasonal_naive": [{}],
    "ridge": [{"alpha": a} for a in (0.1, 1.0, 10.0, 100.0)],
    "random_forest": [{"max_depth": d, "min_samples_leaf": leaf} for d in (8, 16) for leaf in (20, 100)],
    "lightgbm": [{"num_leaves": leaves, "n_estimators": n} for leaves in (15, 63) for n in (200, 600)],
}
FIXED_PARAMS: dict[str, dict] = {
    "random_forest": {"n_estimators": 200, "max_features": 0.5, "n_jobs": -1, "random_state": RANDOM_STATE},
    "lightgbm": {"learning_rate": 0.03, "min_child_samples": 50, "subsample": 0.8, "subsample_freq": 1,
                 "colsample_bytree": 0.8, "reg_lambda": 1.0, "random_state": RANDOM_STATE, "verbose": -1},
}
MODEL_NAMES = list(PARAM_GRIDS)


class NaiveModel:
    """The price stays as this week: log ratio 0."""

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> "NaiveModel":  # noqa: N803
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:  # noqa: N803
        return np.zeros(len(X))


class SeasonalNaiveModel:
    """The price changes by the ratio it changed in the same weeks last year; 0 when last year is missing."""

    def __init__(self, horizon: int) -> None:
        self.horizon = horizon

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> "SeasonalNaiveModel":  # noqa: N803
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:  # noqa: N803
        return X[seasonal_column(self.horizon)].fillna(0.0).to_numpy()


def _fill_supply(X: pd.DataFrame) -> pd.DataFrame:  # noqa: N803
    return X.fillna({"supply_vs_avg_52w": 0.0})


def _sklearn_pipeline(regressor, scale: bool) -> Pipeline:  # noqa: ANN001
    columns = ColumnTransformer([
        ("numeric", StandardScaler() if scale else "passthrough", NUMERIC_FEATURES),
        ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
    ])
    return Pipeline([("fill_supply", FunctionTransformer(_fill_supply)), ("columns", columns),
                     ("regressor", regressor)])


class LightGBMModel:
    """LGBMRegressor with product and market as pandas categories."""

    def __init__(self, **params) -> None:  # noqa: ANN003
        self.regressor = LGBMRegressor(**params)

    @staticmethod
    def _prepare(X: pd.DataFrame) -> pd.DataFrame:  # noqa: N803
        X = X[FEATURES].copy()  # noqa: N806
        for column in CATEGORICAL_FEATURES:
            X[column] = pd.Categorical(X[column], categories=range(1, 100))
        return X

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> "LightGBMModel":  # noqa: N803
        self.regressor.fit(self._prepare(X), y)
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:  # noqa: N803
        return self.regressor.predict(self._prepare(X))


def make_model(name: str, horizon: int, params: dict):  # noqa: ANN201
    """New unfitted model; every model has fit(X, y) and predict(X) on the feature frame."""
    if name == "naive":
        return NaiveModel()
    if name == "seasonal_naive":
        return SeasonalNaiveModel(horizon)
    if name == "ridge":
        return _sklearn_pipeline(Ridge(**params), scale=True)
    if name == "random_forest":
        return _sklearn_pipeline(RandomForestRegressor(**FIXED_PARAMS["random_forest"], **params), scale=False)
    if name == "lightgbm":
        return LightGBMModel(**FIXED_PARAMS["lightgbm"], **params)
    raise ValueError(f"Unknown model {name}")


def native_importance(name: str, model) -> pd.Series | None:  # noqa: ANN001
    """Gain for LightGBM, impurity decrease for Random Forest, |coefficient| for Ridge, summed per input feature."""
    if name == "lightgbm":
        booster = model.regressor.booster_
        return pd.Series(booster.feature_importance("gain"), index=booster.feature_name())
    if name not in ("ridge", "random_forest"):
        return None
    regressor = model.named_steps["regressor"]
    values = regressor.feature_importances_ if name == "random_forest" else np.abs(regressor.coef_)
    encoded = model.named_steps["columns"].get_feature_names_out()
    source = [n.split("__", 1)[1] for n in encoded]
    source = [next((c for c in CATEGORICAL_FEATURES if s.startswith(c + "_")), s) for s in source]
    return pd.Series(values, index=source).groupby(level=0).sum()

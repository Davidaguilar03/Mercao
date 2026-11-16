from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from backend.app.domains.forecasting.dataset import (
    FEATURES,
    HORIZONS,
    SUPPLY_LAG_WEEKS,
    build_features,
    horizon_rows,
    seasonal_column,
    target_column,
)
from backend.app.domains.forecasting.estimators import NaiveModel, SeasonalNaiveModel
from backend.app.domains.forecasting.forecasts import latest_forecasts
from backend.app.domains.forecasting.metrics import (
    coverage,
    directional_accuracy,
    interval_offsets,
    interval_prices,
    mape,
    skill,
)
from backend.app.domains.forecasting.validation import make_splits

N_WEEKS = 160
FIRST_MONDAY = date(2016, 1, 4)


def make_series(prices: np.ndarray, supply: np.ndarray | None = None, product_id: int = 1, market_id: int = 1
                ) -> pd.DataFrame:
    weeks = [(FIRST_MONDAY + timedelta(weeks=i)).isocalendar() for i in range(len(prices))]
    return pd.DataFrame({
        "product_id": product_id, "market_id": market_id,
        "iso_year": [w[0] for w in weeks], "iso_week": [w[1] for w in weeks],
        "mean_price": prices, "quantity_kg": supply if supply is not None else np.nan,
    })


@pytest.fixture
def series() -> pd.DataFrame:
    rng = np.random.default_rng(0)
    prices = 1000 * np.exp(np.cumsum(rng.normal(0, 0.05, N_WEEKS)))
    supply = rng.uniform(5e4, 1e5, N_WEEKS)
    return make_series(prices, supply)


def features_at(frame: pd.DataFrame, position: int) -> pd.Series:
    week_index = frame["week_index"].min() + position
    return frame.loc[frame["week_index"] == week_index, FEATURES].iloc[0]


def test_features_only_use_past_prices(series):
    t = 100
    base = build_features(series)
    changed = series.copy()
    changed.loc[t + 1:, "mean_price"] *= 3
    pd.testing.assert_series_equal(features_at(build_features(changed), t - 52), features_at(base, t - 52))


def test_supply_feature_respects_publication_lag(series):
    t = 120
    position = t - 52  # build_features drops the first 52 weeks (return_52w needs them)
    base = features_at(build_features(series), position)

    recent = series.copy()
    recent.loc[t - SUPPLY_LAG_WEEKS + 1:t, "quantity_kg"] *= 10
    assert features_at(build_features(recent), position)["supply_vs_avg_52w"] == base["supply_vs_avg_52w"]

    lagged = series.copy()
    lagged.loc[t - SUPPLY_LAG_WEEKS, "quantity_kg"] *= 10
    assert features_at(build_features(lagged), position)["supply_vs_avg_52w"] != base["supply_vs_avg_52w"]


def test_target_is_log_ratio_without_forward_fill(series):
    series = series.copy()
    series.loc[110, "mean_price"] = np.nan
    frame = build_features(series).set_index("week_index")
    start = frame.index.min() - 52
    for h in HORIZONS:
        t = start + 100
        expected = np.log(series.loc[100 + h, "mean_price"] / series.loc[100, "mean_price"])
        assert frame.loc[t, target_column(h)] == pytest.approx(expected)
        assert np.isnan(frame.loc[start + 110 - h, target_column(h)])
    assert start + 110 not in frame.index


def test_missing_supply_keeps_row_with_flag():
    prices = 1000 * np.exp(np.linspace(0, 0.5, N_WEEKS))
    frame = build_features(make_series(prices))
    assert len(frame) == N_WEEKS - 52
    assert frame["supply_available"].eq(0).all()
    assert frame["supply_vs_avg_52w"].isna().all()


def test_time_split_has_no_overlap(series):
    frame = build_features(series)
    splits = make_splits(frame, split_weeks=20)
    for h in HORIZONS:
        rows = horizon_rows(frame, h)
        masks = splits.masks(rows)
        train, valid, test = (rows[masks[s]] for s in ("train", "validation", "test"))
        assert train["target_week_index"].max() < valid["week_index"].min()
        assert valid["target_week_index"].max() < test["week_index"].min()
        assert not (masks["train"] & masks["validation"]).any()
        assert not (masks["validation"] & masks["test"]).any()
    ranges = splits.date_ranges()
    assert ranges["train"]["end"] < ranges["validation"]["start"] < ranges["validation"]["end"]
    assert ranges["validation"]["end"] < ranges["test"]["start"]


def test_baselines_on_seasonal_series():
    weeks = np.arange(N_WEEKS)
    prices = 1000 * (1.5 + np.sin(2 * np.pi * weeks / 52))
    frame = build_features(make_series(prices))
    for h in HORIZONS:
        rows = horizon_rows(frame, h)
        assert np.all(NaiveModel().predict(rows) == 0)
        predicted = SeasonalNaiveModel(h).predict(rows)
        np.testing.assert_allclose(predicted, rows[target_column(h)], atol=1e-9)
    rows = horizon_rows(frame, 1).copy()
    rows[seasonal_column(1)] = np.nan
    assert np.all(SeasonalNaiveModel(1).predict(rows) == 0)


def test_metrics():
    current = np.array([100.0, 100.0, 100.0, 100.0])
    actual = np.array([110.0, 90.0, 100.5, 120.0])
    predicted = np.array([105.0, 95.0, 101.0, 90.0])
    assert mape(actual, predicted) == pytest.approx(np.mean([5 / 110, 5 / 90, 0.5 / 100.5, 30 / 120]) * 100)
    assert directional_accuracy(current, actual, predicted) == pytest.approx(200 / 3)
    assert np.isnan(directional_accuracy(current, actual, current))
    assert skill(8.0, 10.0) == pytest.approx(20.0)


def test_interval_computation():
    residuals = np.linspace(-1, 1, 101)
    low, high = interval_offsets(residuals)
    assert low == pytest.approx(-0.8)
    assert high == pytest.approx(0.8)
    lower, upper = interval_prices(np.array([100.0]), np.array([0.1]), (low, high))
    assert lower[0] == pytest.approx(100 * np.exp(-0.7))
    assert upper[0] == pytest.approx(100 * np.exp(0.9))
    assert coverage(np.array([1.0, 2.0, 3.0, 4.0]), np.array([0.0, 2.5, 2.0, 5.0]),
                    np.array([2.0, 3.0, 3.0, 6.0])) == pytest.approx(50.0)


def test_forecast_target_week_is_origin_plus_horizon():
    weeks = np.arange(N_WEEKS)
    prices = 1000 * (1.5 + np.sin(2 * np.pi * weeks / 52))
    frame = build_features(make_series(prices))
    models = {h: NaiveModel() for h in HORIZONS}
    metadata = {"model_version": "test", "interval_offsets": {str(h): [-0.1, 0.1] for h in HORIZONS}}
    forecasts = latest_forecasts(frame, models, metadata).set_index("horizon")
    origin = FIRST_MONDAY + timedelta(weeks=N_WEEKS - 1)
    assert forecasts["origin_iso_year"].eq(origin.isocalendar()[0]).all()
    assert forecasts["origin_iso_week"].eq(origin.isocalendar()[1]).all()
    for h in HORIZONS:
        target = origin + timedelta(weeks=h)
        assert forecasts.loc[h, "target_week_start"] == target
        assert forecasts.loc[h, "target_iso_year"] == target.isocalendar()[0]
        assert forecasts.loc[h, "target_iso_week"] == target.isocalendar()[1]

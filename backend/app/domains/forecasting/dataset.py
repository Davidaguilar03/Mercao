"""Weekly dataset for the price forecasting model: one row per product-market pair and origin week.

Rows are placed on a complete grid of consecutive ISO weeks per pair, so a shift of k rows is always a lag of k
weeks. Missing weeks stay empty (no forward fill): any feature or target that needs them is missing too.

Supply leakage rule: DANE publishes supply monthly, around the 10th of the following month. At week t the most
recent supply week that is surely published is t - SUPPLY_LAG_WEEKS, so the supply feature only reads weeks up to
that one. Six weeks cover the worst case: a week that starts a 31 day month is published about 40 days later.
"""

import numpy as np
import pandas as pd
from sqlalchemy import Engine

from backend.app.domains.ingestion.weeks import iso_week_index

HORIZONS = (1, 2, 3, 4)
SINCE_YEAR = 2016
RETURN_LAGS = (1, 2, 4, 8, 12, 52)
MA_WINDOWS = (12, 52)
VOLATILITY_WINDOW = 8
SUPPLY_LAG_WEEKS = 6
SUPPLY_WINDOW = 52
SEASONAL_LAG = 52

CATEGORICAL_FEATURES = ["product_id", "market_id"]
REQUIRED_FEATURES = (
    [f"return_{k}w" for k in RETURN_LAGS]
    + [f"price_vs_ma_{w}w" for w in MA_WINDOWS]
    + [f"volatility_{VOLATILITY_WINDOW}w", "week_sin", "week_cos", "month"]
)
SUPPLY_FEATURES = ["supply_vs_avg_52w", "supply_available"]
FEATURES = REQUIRED_FEATURES + SUPPLY_FEATURES + CATEGORICAL_FEATURES


def target_column(h: int) -> str:
    return f"target_{h}w"


def seasonal_column(h: int) -> str:
    return f"seasonal_ratio_{h}w"


def load_series(engine: Engine, since_year: int = SINCE_YEAR) -> pd.DataFrame:
    """Weekly mean price and total supply of every usable pair from `since_year` on."""
    prices = pd.read_sql(
        """
        SELECT p.product_id, p.market_id, p.iso_year, p.iso_week, p.mean_price
        FROM prices p
        JOIN coverage c ON c.product_id = p.product_id AND c.market_id = p.market_id
        WHERE c.usable_for_model = 1 AND p.iso_year >= :since AND p.mean_price > 0
        """,
        engine, params={"since": since_year},
    )
    supply = pd.read_sql(
        "SELECT product_id, market_id, iso_year, iso_week, quantity_kg FROM supply_weekly WHERE iso_year >= :since",
        engine, params={"since": since_year},
    )
    return prices.merge(supply, on=["product_id", "market_id", "iso_year", "iso_week"], how="outer")


def _complete_grid(series: pd.DataFrame) -> pd.DataFrame:
    """One row per pair and ISO week between the pair's first and last price, empty where nothing was published."""
    series = series.copy()
    series["week_index"] = [iso_week_index(y, w) for y, w in zip(series["iso_year"], series["iso_week"])]
    priced = series[series["mean_price"].notna()]
    bounds = priced.groupby(["product_id", "market_id"])["week_index"].agg(["min", "max"])
    grid = pd.concat([
        pd.DataFrame({"product_id": p, "market_id": m, "week_index": np.arange(lo, hi + 1)})
        for (p, m), (lo, hi) in bounds.iterrows()
    ], ignore_index=True)
    grid = grid.merge(series.drop(columns=["iso_year", "iso_week"]), on=["product_id", "market_id", "week_index"],
                      how="left")
    # Inverse of iso_week_index: the Monday ordinal is week_index * 7 + 1 (ordinal 1 is a Monday).
    mondays = pd.to_datetime([pd.Timestamp.fromordinal(int(i) * 7 + 1) for i in np.unique(grid["week_index"])])
    calendar = pd.DataFrame({"week_index": np.unique(grid["week_index"]), "week_start": mondays})
    iso = calendar["week_start"].dt.isocalendar()
    calendar["iso_year"] = iso["year"].astype(int)
    calendar["iso_week"] = iso["week"].astype(int)
    grid = grid.merge(calendar, on="week_index", how="left")
    return grid.sort_values(["product_id", "market_id", "week_index"]).reset_index(drop=True)


def _pair_features(pair: pd.DataFrame) -> pd.DataFrame:
    log_price = np.log(pair["mean_price"])
    weekly_return = log_price.diff()
    out = pd.DataFrame(index=pair.index)
    for k in RETURN_LAGS:
        out[f"return_{k}w"] = log_price - log_price.shift(k)
    for w in MA_WINDOWS:
        moving_average = pair["mean_price"].rolling(w, min_periods=int(w * 0.75)).mean()
        out[f"price_vs_ma_{w}w"] = log_price - np.log(moving_average)
    out[f"volatility_{VOLATILITY_WINDOW}w"] = weekly_return.rolling(
        VOLATILITY_WINDOW, min_periods=VOLATILITY_WINDOW - 2).std()

    known_supply = np.log(pair["quantity_kg"].where(pair["quantity_kg"] > 0)).shift(SUPPLY_LAG_WEEKS)
    supply_average = known_supply.rolling(SUPPLY_WINDOW, min_periods=SUPPLY_WINDOW // 2).mean()
    out["supply_vs_avg_52w"] = known_supply - supply_average

    for h in HORIZONS:
        out[target_column(h)] = log_price.shift(-h) - log_price
        # Change between the same weeks one year earlier: only past data, since h < SEASONAL_LAG.
        out[seasonal_column(h)] = log_price.shift(SEASONAL_LAG - h) - log_price.shift(SEASONAL_LAG)
    return out


def build_features(series: pd.DataFrame) -> pd.DataFrame:
    """Features, targets and seasonal ratios for every week with a price.

    Targets are log(price[t+h] / price[t]); they are missing when week t+h has no price. Rows missing a required
    feature are dropped; rows without a known supply keep supply_vs_avg_52w empty and supply_available = 0.
    """
    grid = _complete_grid(series)
    features = grid.groupby(["product_id", "market_id"], group_keys=False)[["mean_price", "quantity_kg"]].apply(
        _pair_features)
    frame = pd.concat([grid, features], axis=1)

    iso_week = frame["iso_week"]
    frame["week_sin"] = np.sin(2 * np.pi * iso_week / 52.18)
    frame["week_cos"] = np.cos(2 * np.pi * iso_week / 52.18)
    frame["month"] = (frame["week_start"] + pd.Timedelta(days=3)).dt.month
    frame["supply_available"] = frame["supply_vs_avg_52w"].notna().astype(int)

    frame = frame[frame["mean_price"].notna()]
    frame = frame.dropna(subset=REQUIRED_FEATURES)
    frame["product_id"] = frame["product_id"].astype(int)
    frame["market_id"] = frame["market_id"].astype(int)
    return frame.reset_index(drop=True)


def horizon_rows(frame: pd.DataFrame, h: int) -> pd.DataFrame:
    """Rows that have a target for horizon h, with the week the target refers to."""
    rows = frame[frame[target_column(h)].notna()].copy()
    rows["target_week_index"] = rows["week_index"] + h
    return rows

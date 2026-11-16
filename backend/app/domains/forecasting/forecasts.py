"""Saved models (models/ at the repository root) and the forecasts written to the database."""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import Engine

from backend.app.core.config import REPO_ROOT
from backend.app.domains.forecasting.dataset import build_features, load_series
from backend.app.domains.forecasting.metrics import interval_prices
from backend.app.domains.forecasting.models import Forecast

MODELS_DIR = REPO_ROOT / "models"


def save_models(models: dict[int, object], metadata: dict, models_dir: Path = MODELS_DIR) -> None:
    """One joblib file per horizon plus metadata.json."""
    models_dir.mkdir(parents=True, exist_ok=True)
    for h, model in models.items():
        joblib.dump(model, models_dir / f"forecast_h{h}.joblib")
    (models_dir / "metadata.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False, default=str),
                                              encoding="utf-8")


def models_available(models_dir: Path = MODELS_DIR) -> bool:
    return (models_dir / "metadata.json").exists()


def load_models(models_dir: Path = MODELS_DIR) -> tuple[dict[int, object], dict]:
    metadata = json.loads((models_dir / "metadata.json").read_text(encoding="utf-8"))
    models = {h: joblib.load(models_dir / f"forecast_h{h}.joblib") for h in metadata["horizons"]}
    return models, metadata


def latest_forecasts(frame: pd.DataFrame, models: dict[int, object], metadata: dict) -> pd.DataFrame:
    """Forecasts from the latest week with complete features of every pair."""
    latest = frame.sort_values("week_index").groupby(["product_id", "market_id"]).tail(1)
    current = latest["mean_price"].to_numpy()
    parts = []
    for h, model in models.items():
        log_ratio = model.predict(latest)
        lower, upper = interval_prices(current, log_ratio, tuple(metadata["interval_offsets"][str(h)]))
        target_start = latest["week_start"] + pd.Timedelta(weeks=h)
        target_iso = target_start.dt.isocalendar()
        parts.append(pd.DataFrame({
            "product_id": latest["product_id"].to_numpy(), "market_id": latest["market_id"].to_numpy(),
            "origin_iso_year": latest["iso_year"].to_numpy(), "origin_iso_week": latest["iso_week"].to_numpy(),
            "horizon": h, "target_iso_year": target_iso["year"].astype(int).to_numpy(),
            "target_iso_week": target_iso["week"].astype(int).to_numpy(),
            "target_week_start": target_start.dt.date.to_numpy(),
            "predicted_price": current * np.exp(log_ratio), "lower_price": lower, "upper_price": upper,
            "model_version": metadata["model_version"],
        }))
    return pd.concat(parts, ignore_index=True)


def write_forecasts(engine: Engine, models_dir: Path = MODELS_DIR) -> pd.DataFrame:
    """Replace the forecasts table (dropped and recreated, so its schema is always current) with new forecasts."""
    models, metadata = load_models(models_dir)
    forecasts = latest_forecasts(build_features(load_series(engine)), models, metadata)
    Forecast.__table__.drop(engine, checkfirst=True)
    Forecast.__table__.create(engine)
    with engine.begin() as connection:
        connection.execute(Forecast.__table__.insert(), forecasts.to_dict("records"))
    return forecasts

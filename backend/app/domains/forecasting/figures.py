"""Figures of the forecasting report (labels in Spanish), saved as PNG in docs/figures."""

from datetime import date, timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from backend.app.domains.forecasting.labels import FEATURE_LABELS, MODEL_LABELS  # noqa: E402

MODEL_COLORS = {"naive": "#52514e", "seasonal_naive": "#eda100", "ridge": "#1baf7a",
                "random_forest": "#eb6834", "lightgbm": "#2a78d6"}
TEXT = "#0b0b0b"
MUTED = "#52514e"
GRID = "#e4e3df"


def _style(ax) -> None:  # noqa: ANN001
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(MUTED)
    ax.tick_params(colors=MUTED)


def _save(fig, path: Path) -> None:  # noqa: ANN001
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(path, dpi=150, facecolor="white")
    plt.close(fig)


def model_comparison(by_horizon: pd.DataFrame, path: Path) -> None:
    """Test MAPE by horizon, one line per model."""
    fig, ax = plt.subplots(figsize=(8, 4.8))
    for model in MODEL_LABELS:
        rows = by_horizon[by_horizon["model"] == model].sort_values("horizon")
        ax.plot(rows["horizon"], rows["mape"], marker="o", markersize=6, linewidth=2, color=MODEL_COLORS[model],
                label=MODEL_LABELS[model])
    ax.set_xticks([1, 2, 3, 4])
    ax.set_xlabel("Horizonte (semanas)")
    ax.set_ylabel("MAPE en prueba (%)")
    ax.set_title("Error de pronóstico por horizonte y modelo (conjunto de prueba)", color=TEXT)
    ax.legend(frameon=False, fontsize=9, loc="upper left")
    _style(ax)
    _save(fig, path)


def predicted_vs_actual(predictions: pd.DataFrame, title: str, path: Path, horizons: tuple[int, ...] = (1, 4)) -> None:
    """Actual price, prediction and interval by target week, one panel per horizon."""
    fig, axes = plt.subplots(len(horizons), 1, figsize=(9, 3.4 * len(horizons)), sharex=True)
    for ax, h in zip(axes, horizons):
        rows = predictions[predictions["horizon"] == h].sort_values("week_index")
        weeks = [date.fromordinal(int(i + h) * 7 + 1) + timedelta(days=3) for i in rows["week_index"]]
        ax.fill_between(weeks, rows["lower_price"], rows["upper_price"], color="#2a78d6", alpha=0.15, linewidth=0,
                        label="Intervalo 10 %–90 %")
        ax.plot(weeks, rows["actual_price"], color=TEXT, linewidth=2, label="Precio observado")
        ax.plot(weeks, rows["predicted_price"], color="#2a78d6", linewidth=2, label="Pronóstico")
        ax.set_ylabel("Pesos por kg")
        ax.set_title(f"Horizonte de {h} semana{'s' if h > 1 else ''}", color=TEXT, fontsize=10)
        ax.legend(frameon=False, fontsize=9, loc="upper left")
        _style(ax)
    axes[-1].set_xlabel("Semana pronosticada")
    fig.suptitle(title, color=TEXT)
    _save(fig, path)


def feature_importance(native: pd.Series, permutation: pd.Series, native_label: str, path: Path) -> None:
    """Native importance and permutation importance side by side, sorted by the native one."""
    order = native.sort_values().index
    labels = [FEATURE_LABELS.get(f, f) for f in order]
    fig, (left, right) = plt.subplots(1, 2, figsize=(11, 5.5), sharey=True)
    left.barh(labels, native[order], color="#2a78d6", height=0.6)
    left.set_xlabel(native_label)
    right.barh(labels, permutation[order] * 100, color="#eb6834", height=0.6)
    right.set_xlabel("Aumento del MAE del log-cambio al permutar (×100)")
    for ax in (left, right):
        _style(ax)
        ax.grid(axis="x", color=GRID, linewidth=0.8)
        ax.grid(axis="y", visible=False)
    fig.suptitle("Importancia de las variables del modelo final (promedio de los 4 horizontes)", color=TEXT)
    _save(fig, path)


def error_by_product(by_product: pd.DataFrame, final_model: str, product_names: dict[int, str], path: Path) -> None:
    """Test MAPE per product for the naive baseline and the final model."""
    final = by_product[by_product["model"] == final_model].set_index("product_id")["mape"].sort_values()
    naive = by_product[by_product["model"] == "naive"].set_index("product_id")["mape"].reindex(final.index)
    positions = range(len(final))
    fig, ax = plt.subplots(figsize=(9, 6))
    ax.barh([p + 0.2 for p in positions], naive, height=0.38, color=MODEL_COLORS["naive"], label="Ingenuo")
    ax.barh([p - 0.2 for p in positions], final, height=0.38, color=MODEL_COLORS[final_model],
            label=MODEL_LABELS[final_model])
    ax.set_yticks(list(positions), [product_names[p] for p in final.index])
    ax.set_xlabel("MAPE en prueba (%), promedio de los 4 horizontes")
    ax.set_title("Error por producto: modelo final frente al ingenuo", color=TEXT)
    ax.legend(frameon=False, fontsize=9, loc="lower right")
    _style(ax)
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.grid(axis="y", visible=False)
    _save(fig, path)

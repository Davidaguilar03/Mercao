"""Error metrics in pesos, directional accuracy and empirical prediction intervals."""

import numpy as np

DIRECTION_THRESHOLD = 0.01
INTERVAL_QUANTILES = (0.10, 0.90)


def mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)))


def mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted) / actual) * 100)


def directional_accuracy(current: np.ndarray, actual: np.ndarray, predicted: np.ndarray,
                         threshold: float = DIRECTION_THRESHOLD) -> float:
    """Share (%) of weeks whose rise or fall was predicted with the right sign.

    Weeks whose actual change is under `threshold` are ignored. A predicted change of exactly zero counts as wrong,
    so the naive baseline, which never predicts a change, is not scored (returns nan).
    """
    actual_change = actual / current - 1
    predicted_change = predicted / current - 1
    moved = np.abs(actual_change) >= threshold
    if not moved.any() or np.all(predicted_change[moved] == 0):
        return float("nan")
    return float(np.mean(np.sign(actual_change[moved]) == np.sign(predicted_change[moved])) * 100)


def skill(model_error: float, naive_error: float) -> float:
    """Improvement (%) over the naive baseline: 100 * (1 - model / naive). Positive means better than naive."""
    return float(100 * (1 - model_error / naive_error))


def interval_offsets(log_residuals: np.ndarray, quantiles: tuple[float, float] = INTERVAL_QUANTILES
                     ) -> tuple[float, float]:
    """Empirical quantiles of the log residuals (actual - predicted log ratio) of the validation year."""
    low, high = np.quantile(log_residuals, quantiles)
    return float(low), float(high)


def interval_prices(current: np.ndarray, predicted_log_ratio: np.ndarray, offsets: tuple[float, float]
                    ) -> tuple[np.ndarray, np.ndarray]:
    """Lower and upper prices: current price times exp(predicted log ratio + residual quantile)."""
    low, high = offsets
    return current * np.exp(predicted_log_ratio + low), current * np.exp(predicted_log_ratio + high)


def coverage(actual: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> float:
    """Share (%) of actual prices inside [lower, upper]."""
    return float(np.mean((actual >= lower) & (actual <= upper)) * 100)

"""Cleaning rules for the weekly price table. Every excluded row is kept in price_exclusions with its reason."""

import numpy as np
import pandas as pd

from backend.app.domains.ingestion.text import name_key

UNIT_JUMP_THRESHOLD = 20.0
"""A mean price more than 20 times larger (or smaller) than the previous accepted price of the same product and
market is not a market movement: it is a unit change (price per tonne or per bulk sack instead of per kg) or a typing
error. In the exploration 655 such jumps were found, mostly for milled products (arroz granza, harina de arroz)."""

HEADER_ARTIFACT_PRODUCTS = {"producto", "c"}

# Units written in the footnotes of the annexes; everything else is pesos per kilogram.
_UNIT_RULES = (
    (lambda k: k.startswith("huevo"), "unidad"),
    (lambda k: k.startswith("bocadillo"), "unidad"),
    (lambda k: k.startswith("aceite"), "litro"),
    (lambda k: k in ("jugo de frutas", "vinagre"), "litro"),
)


def price_unit(product_name: str) -> str:
    """Unit of the published price: 'kg', 'unidad' (eggs, bocadillo) or 'litro' (oils, fruit juice, vinegar)."""
    key = name_key(product_name)
    return next((unit for test, unit in _UNIT_RULES if test(key)), "kg")


def is_header_artifact(product_name: str, market_name: str) -> bool:
    """Rows produced by a repeated header or a footnote ('Producto' | 'Fuente')."""
    product, market = name_key(product_name), name_key(market_name)
    return product in HEADER_ARTIFACT_PRODUCTS or len(product) <= 1 or market.startswith("fuente")


def flag_unit_jumps_in_series(prices: np.ndarray,
                              threshold: float = UNIT_JUMP_THRESHOLD) -> tuple[np.ndarray, np.ndarray]:
    """Flag the points of one chronological series that jump more than `threshold` times from the reference price.

    The reference starts at the first price within `threshold` of the series median (so a series that opens in the
    wrong unit is handled) and moves to each accepted point. A flagged point never becomes the reference, so a
    block of weeks published in the wrong unit is flagged as a whole and the series resumes when the unit returns.
    Returns (flags, ratio to the reference) per point.
    """
    flags = np.zeros(len(prices), dtype=bool)
    ratios = np.ones(len(prices), dtype=float)
    if len(prices) == 0:
        return flags, ratios
    median = float(np.median(prices))
    reference = None
    for i, price in enumerate(prices):
        if reference is None:
            ratio = price / median
            if 1 / threshold <= ratio <= threshold:
                reference = price
            else:
                flags[i], ratios[i] = True, ratio
            continue
        ratio = price / reference
        if ratio > threshold or ratio < 1 / threshold:
            flags[i], ratios[i] = True, ratio
        else:
            reference = price
    return flags, ratios


def flag_unit_jumps(frame: pd.DataFrame, keys: list[str], order: str, price: str = "mean_price",
                    threshold: float = UNIT_JUMP_THRESHOLD) -> tuple[pd.Series, pd.Series]:
    """Apply flag_unit_jumps_in_series to every (product, market) series. Returns (flag, ratio) aligned to frame."""
    flags = pd.Series(False, index=frame.index)
    ratios = pd.Series(1.0, index=frame.index)
    ordered = frame.sort_values(order)
    for _, positions in ordered.groupby(keys, sort=False, dropna=False).indices.items():
        index = ordered.index[positions]
        series_flags, series_ratios = flag_unit_jumps_in_series(ordered[price].to_numpy()[positions], threshold)
        if series_flags.any():
            flags.loc[index] = series_flags
            ratios.loc[index] = series_ratios
    return flags, ratios

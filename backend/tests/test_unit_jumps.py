import numpy as np
import pandas as pd

from backend.app.domains.prices.cleaning import flag_unit_jumps, flag_unit_jumps_in_series, price_unit


def test_single_spike_is_flagged() -> None:
    flags, ratios = flag_unit_jumps_in_series(np.array([1000, 1100, 1_200_000, 1050, 990.0]))
    assert flags.tolist() == [False, False, True, False, False]
    assert ratios[2] > 1000


def test_block_in_wrong_unit_is_flagged_until_the_unit_returns() -> None:
    prices = np.array([1500, 1520, 1_800_000, 1_810_000, 1_790_000, 1490, 1510.0])
    flags, _ = flag_unit_jumps_in_series(prices)
    assert flags.tolist() == [False, False, True, True, True, False, False]


def test_reverse_jump_is_flagged() -> None:
    flags, _ = flag_unit_jumps_in_series(np.array([90_000, 91_000, 3, 92_000.0]))
    assert flags.tolist() == [False, False, True, False]


def test_series_opening_in_the_wrong_unit() -> None:
    flags, _ = flag_unit_jumps_in_series(np.array([2_000_000, 2000, 2100, 1900, 2050.0]))
    assert flags.tolist() == [True, False, False, False, False]


def test_large_but_real_moves_are_kept() -> None:
    flags, _ = flag_unit_jumps_in_series(np.array([1000, 3000, 9000, 18_000, 900.0]))
    assert not flags.any()


def test_flags_are_computed_per_product_and_market() -> None:
    frame = pd.DataFrame({
        "product_id": [1, 1, 1, 2, 2, 2],
        "market_id": [1, 1, 1, 1, 1, 1],
        "week": [3, 1, 2, 1, 2, 3],
        "mean_price": [1000, 1000, 50_000, 40_000, 41_000, 39_000],
    })
    flags, _ = flag_unit_jumps(frame, ["product_id", "market_id"], "week")
    assert flags.tolist() == [False, False, True, False, False, False]


def test_price_units() -> None:
    assert price_unit("Huevo rojo AA") == "unidad"
    assert price_unit("Aceite vegetal mezcla") == "litro"
    assert price_unit("Jugo de frutas") == "litro"
    assert price_unit("Papa parda pastusa") == "kg"

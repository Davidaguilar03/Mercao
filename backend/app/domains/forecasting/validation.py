"""Time-based split: training up to a cutoff, one validation year for model selection, the last 52 weeks for test.

The split is made on the origin week t. A row of horizon h also uses the price of week t + h, so training rows whose
target week falls inside the validation period are dropped, and the same for validation rows whose target week falls
inside the test period. That way no split ever sees a price that belongs to a later split.
"""

from dataclasses import dataclass
from datetime import date, timedelta

import pandas as pd

SPLIT_WEEKS = 52


@dataclass(frozen=True)
class Splits:
    """First week index of the validation and test periods and last week index with data."""

    first_week: int
    validation_start: int
    test_start: int
    last_week: int

    def masks(self, rows: pd.DataFrame) -> dict[str, pd.Series]:
        """Boolean masks over rows with week_index and target_week_index (see dataset.horizon_rows)."""
        origin, target = rows["week_index"], rows["target_week_index"]
        return {
            "train": target < self.validation_start,
            "validation": (origin >= self.validation_start) & (target < self.test_start),
            "test": origin >= self.test_start,
        }

    def date_ranges(self) -> dict[str, dict[str, str]]:
        """Monday of the first origin week and Sunday of the last origin week of each split."""
        def monday(index: int) -> date:
            return date.fromordinal(index * 7 + 1)

        bounds = {
            "train": (self.first_week, self.validation_start - 1),
            "validation": (self.validation_start, self.test_start - 1),
            "test": (self.test_start, self.last_week),
        }
        return {
            name: {"start": monday(lo).isoformat(), "end": (monday(hi) + timedelta(days=6)).isoformat(),
                   "start_iso": "%d-W%02d" % monday(lo).isocalendar()[:2],
                   "end_iso": "%d-W%02d" % monday(hi).isocalendar()[:2]}
            for name, (lo, hi) in bounds.items()
        }


def make_splits(frame: pd.DataFrame, split_weeks: int = SPLIT_WEEKS) -> Splits:
    """Test = the last `split_weeks` weeks with a price; validation = the `split_weeks` weeks before them."""
    last_week = int(frame["week_index"].max())
    test_start = last_week - split_weeks + 1
    return Splits(first_week=int(frame["week_index"].min()), validation_start=test_start - split_weeks,
                  test_start=test_start, last_week=last_week)

"""Coverage of every product-market pair and the rule that decides which pairs the forecasting model uses."""

import pandas as pd

from backend.app.domains.ingestion.text import slugify
from backend.app.domains.ingestion.weeks import iso_week_bounds, iso_week_index

COVERAGE_SINCE = (2016, 1)
MIN_COVERAGE = 0.8
RECENT_WEEKS = 8


def comparable_group(canonical_name: str, unit: str) -> str:
    """Pairs share a group only when they are the same product variety priced in the same unit."""
    return f"{slugify(canonical_name)}|{unit}"


def compute_coverage(prices: pd.DataFrame, products: pd.DataFrame, since: tuple[int, int] = COVERAGE_SINCE,
                     min_coverage: float = MIN_COVERAGE, recent_weeks: int = RECENT_WEEKS) -> pd.DataFrame:
    """One row per (product_id, market_id) with data.

    usable_for_model = weeks with data since `since` cover at least `min_coverage` of the weeks from `since` to the
    last week of the dataset, and the pair has data in the last `recent_weeks` weeks of the dataset.
    """
    data = prices[prices["product_id"].notna() & prices["market_id"].notna()]
    week_ids = {wk: iso_week_index(*wk) for wk in set(zip(data["iso_year"], data["iso_week"]))}
    data = data.assign(week_index=[week_ids[w] for w in zip(data["iso_year"], data["iso_week"])])
    last_index = data["week_index"].max()
    since_index = iso_week_index(*since)
    total_since = last_index - since_index + 1
    grouped = data.groupby(["product_id", "market_id"])
    coverage = grouped.agg(first_index=("week_index", "min"), last_index=("week_index", "max"),
                           n_weeks=("week_index", "nunique"), unit=("unit", "first")).reset_index()
    coverage["weeks_since_2016"] = (data[data["week_index"] >= since_index].groupby(["product_id", "market_id"])
                                    ["week_index"].nunique().reindex(
                                        pd.MultiIndex.from_frame(coverage[["product_id", "market_id"]]),
                                        fill_value=0).to_numpy())
    coverage["missing_share_since_2016"] = 1 - coverage["weeks_since_2016"] / total_since
    coverage["has_recent_data"] = coverage["last_index"] > last_index - recent_weeks
    enough = 1 - coverage["missing_share_since_2016"] >= min_coverage
    coverage["usable_for_model"] = enough & coverage["has_recent_data"]
    index_to_monday = {i: iso_week_bounds(*wk)[0] for wk, i in week_ids.items()}
    coverage["first_week"] = coverage["first_index"].map(index_to_monday)
    coverage["last_week"] = coverage["last_index"].map(index_to_monday)
    names = products.set_index("product_id")["canonical_name"]
    coverage["comparable_group"] = [comparable_group(names[int(p)], u)
                                    for p, u in zip(coverage["product_id"], coverage["unit"])]
    columns = ["product_id", "market_id", "first_week", "last_week", "n_weeks", "weeks_since_2016",
               "missing_share_since_2016", "has_recent_data", "usable_for_model", "comparable_group"]
    return coverage[columns].astype({"product_id": int, "market_id": int})

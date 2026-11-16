"""Business logic of the price endpoints: latest prices with their changes, history and seasonality."""

from datetime import date, timedelta

import pandas as pd
from sqlalchemy.orm import Session

from backend.app.core.errors import InvalidParameterError
from backend.app.domains.catalog import service as catalog
from backend.app.domains.prices import repository

HISTORY_YEARS = 3
SEASONALITY_SINCE = date(2016, 1, 1)
MONTH_NAMES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
               "noviembre", "diciembre")


def round_price(value: float | None) -> int | None:
    """Prices are returned in whole pesos per kilogram."""
    return None if value is None else round(value)


def pct_change(current: float | None, previous: float | None) -> float | None:
    """Percentage change with one decimal, or None when a price is missing."""
    if current is None or previous is None:
        return None
    return round((current / previous - 1) * 100, 1)


def health(session: Session) -> dict:
    week = repository.latest_week(session)
    if week is None:
        return {"status": "sin_datos", "latest_week": None}
    monday = date.fromisocalendar(week["iso_year"], week["iso_week"], 1)
    return {"status": "ok", "latest_week": {"iso_year": week["iso_year"], "iso_week": week["iso_week"],
                                            "week_start": monday, "week_end": monday + timedelta(days=6)}}


def latest_prices(session: Session, product_id: int) -> dict:
    """Latest week of every usable market of the product and its change versus 4 and 52 weeks before."""
    product = catalog.get_product(session, product_id)
    markets = repository.usable_markets(session, product_id)
    result = {"product_id": product_id, "product_name": product["canonical_name"], "unit": "kg", "markets": []}
    if not markets:
        return result
    last = max(date.fromisoformat(m["last_week"]) for m in markets)
    rows = repository.weekly_prices(session, product_id, [m["market_id"] for m in markets],
                                    last - timedelta(weeks=60), last)
    by_week = {(r["market_id"], date.fromisoformat(r["week_start"])): r for r in rows}
    for market in markets:
        week = date.fromisoformat(market["last_week"])
        current = by_week.get((market["market_id"], week))
        if current is None:
            continue
        before_4 = by_week.get((market["market_id"], week - timedelta(weeks=4)))
        before_52 = by_week.get((market["market_id"], week - timedelta(weeks=52)))
        result["markets"].append({
            "market_id": market["market_id"], "market_name": market["market_name"], "city": market["city"],
            "comparable_group": market["comparable_group"], "week_start": week,
            "iso_year": current["iso_year"], "iso_week": current["iso_week"],
            "mean_price": round_price(current["mean_price"]), "min_price": round_price(current["min_price"]),
            "max_price": round_price(current["max_price"]),
            "change_4w_pct": pct_change(current["mean_price"], before_4["mean_price"] if before_4 else None),
            "change_52w_pct": pct_change(current["mean_price"], before_52["mean_price"] if before_52 else None),
        })
    result["markets"].sort(key=lambda m: m["mean_price"])
    return result


def price_history(session: Session, product_id: int, market_id: int, start: date | None, end: date | None) -> dict:
    """Weekly series of one pair. Without dates: the last HISTORY_YEARS years up to the latest week of the pair."""
    product = catalog.get_product(session, product_id)
    market = catalog.get_market(session, market_id)
    if end is None:
        last_week = repository.pair_last_week(session, product_id, market_id)
        end = date.fromisoformat(last_week) if last_week else date.today()
    if start is None:
        start = end - timedelta(weeks=52 * HISTORY_YEARS)
    if start > end:
        raise InvalidParameterError("La fecha inicial (from) no puede ser posterior a la final (to).")
    rows = repository.weekly_prices(session, product_id, [market_id], start, end)
    return {
        "product_id": product_id, "product_name": product["canonical_name"], "market_id": market_id,
        "market_name": market["market_name"], "unit": "kg", "from": start, "to": end,
        "series": [{"week_start": r["week_start"], "mean_price": round_price(r["mean_price"]),
                    "min_price": round_price(r["min_price"]), "max_price": round_price(r["max_price"])}
                   for r in rows],
    }


def seasonality_index(weekly: pd.DataFrame) -> tuple[pd.Series, list[int]]:
    """Average monthly price index (100 = annual mean) over the complete years, and the years used.

    Each week belongs to the month of its Thursday. For each year with the 12 months, every monthly mean is divided
    by the mean of the 12 monthly means of that year; the index of a month is the average of those ratios times 100.
    Incomplete years are left out because the missing months would bias their annual mean.
    """
    thursday = pd.to_datetime(weekly["week_start"]) + pd.Timedelta(days=3)
    monthly = (weekly.assign(year=thursday.dt.year, month=thursday.dt.month)
               .groupby(["year", "month"])["mean_price"].mean())
    months_per_year = monthly.groupby(level="year").size()
    years = [int(y) for y in months_per_year[months_per_year == 12].index]
    if not years:
        return pd.Series(dtype=float), []
    monthly = monthly.loc[years]
    ratio = monthly / monthly.groupby(level="year").transform("mean")
    return ratio.groupby(level="month").mean() * 100, years


def seasonality(session: Session, product_id: int, market_id: int) -> dict:
    product = catalog.get_product(session, product_id)
    market = catalog.get_market(session, market_id)
    rows = repository.weekly_prices(session, product_id, [market_id], SEASONALITY_SINCE, date.today())
    result = {"product_id": product_id, "product_name": product["canonical_name"], "market_id": market_id,
              "market_name": market["market_name"], "years_used": [], "months": [], "cheapest_month": None,
              "most_expensive_month": None, "message": None}
    index, years = seasonality_index(pd.DataFrame([dict(r) for r in rows], columns=["week_start", "mean_price"]))
    if not years:
        result["message"] = "No hay ningún año completo con precios desde 2016 para este producto en este mercado."
        return result
    result["years_used"] = years
    result["months"] = [{"month": int(m), "month_name": MONTH_NAMES[int(m) - 1], "index": round(float(v), 1)}
                        for m, v in index.items()]
    result["cheapest_month"] = MONTH_NAMES[int(index.idxmin()) - 1]
    result["most_expensive_month"] = MONTH_NAMES[int(index.idxmax()) - 1]
    return result

"""Builds the supply tables from the cached microdata, one file at a time to keep memory low.

Only focus products in focus markets are stored, aggregated by ISO week and origin. The full parsed microdata stays
in the parquet cache (data/interim/pipeline/supply), so the database can be rebuilt with a wider focus later.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from backend.app.domains.catalog.generator import market_key
from backend.app.domains.catalog.loader import Catalog
from backend.app.domains.ingestion.cache import ParseCache
from backend.app.domains.ingestion.text import name_key
from backend.app.domains.supply.divipola import DEPARTMENTS, is_municipality_code, resolve_origin

log = logging.getLogger(__name__)

ORIGIN_COLUMNS = ["origin_department_code", "origin_municipality_code", "origin_country"]
SUPPLY_KEYS = ["iso_year", "iso_week", "market_id", "product_id", *ORIGIN_COLUMNS]
WEEKLY_KEYS = ["iso_year", "iso_week", "market_id", "product_id"]
_PUBLISHED_ORIGIN = ["dept_code", "dept_name", "muni_code", "muni_name"]


@dataclass
class SupplyResult:
    supply: pd.DataFrame
    weekly: pd.DataFrame
    departments: pd.DataFrame
    municipalities: pd.DataFrame
    stats: dict[str, Any] = field(default_factory=dict)


def municipality_names(cache: ParseCache, paths: list[Path]) -> dict[str, str]:
    """Most frequent published name of every municipality code across all years."""
    counts: dict[tuple[str, str], int] = {}
    for path in paths:
        frame = cache.load_frame(path, columns=["muni_code", "muni_name"])
        for (code, name), n in frame.value_counts(["muni_code", "muni_name"]).items():
            counts[(code, name)] = counts.get((code, name), 0) + int(n)
    best: dict[str, tuple[int, str]] = {}
    for (code, name), n in counts.items():
        if n > best.get(code, (0, ""))[0]:
            best[code] = (n, name)
    return {code: name for code, (_, name) in best.items()}


def origin_lookups(muni_names: dict[str, str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """origin_departments (official DIVIPOLA names) and origin_municipalities (every valid code seen in the data)."""
    departments = pd.DataFrame(sorted(DEPARTMENTS.items()), columns=["code", "name"])
    municipalities = pd.DataFrame(
        [(code, name, code[:2]) for code, name in sorted(muni_names.items()) if is_municipality_code(code)],
        columns=["code", "name", "department_code"])
    return departments, municipalities


def resolve_origins(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Resolve the origin codes once per distinct published combination and broadcast them to the rows.

    Also counts the rows whose published department name or code differs from the official DIVIPOLA code.
    """
    columns = [frame[c] if isinstance(frame[c].dtype, pd.CategoricalDtype) else frame[c].astype("category")
               for c in _PUBLISHED_ORIGIN]
    codes, uniques = pd.MultiIndex.from_arrays(columns).factorize()
    resolved, fixes = [], {"department_name_fixed": 0, "department_code_fixed": 0, "foreign": 0}
    rows_per_combo = pd.Series(codes).value_counts()
    for position, (dept_code, dept_name, muni_code, muni_name) in enumerate(uniques):
        code, muni, country = resolve_origin(dept_code, muni_code, muni_name)
        n = int(rows_per_combo.get(position, 0))
        if code and name_key(DEPARTMENTS[code]) != name_key(dept_name):
            fixes["department_name_fixed"] += n
        if code and dept_code.zfill(2) != code:
            fixes["department_code_fixed"] += n
        if country and country != "COLOMBIA":
            fixes["foreign"] += n
        resolved.append((code, muni, country))
    table = pd.DataFrame(resolved, columns=ORIGIN_COLUMNS)
    return table.iloc[codes].reset_index(drop=True), fixes


def aggregate_supply(rows: pd.DataFrame) -> pd.DataFrame:
    """Sum daily rows (date, market_id, product_id, origin columns, quantity_kg) by ISO week and origin."""
    iso = rows["date"].dt.isocalendar()
    frame = rows.assign(iso_year=iso["year"].astype(int), iso_week=iso["week"].astype(int))
    frame = frame.astype({"market_id": int, "product_id": int})
    return frame.groupby(SUPPLY_KEYS, as_index=False, dropna=False, sort=True)["quantity_kg"].sum()


def weekly_totals(supply: pd.DataFrame) -> pd.DataFrame:
    """Total kilograms per ISO week, market and product (all origins)."""
    return supply.groupby(WEEKLY_KEYS, as_index=False)["quantity_kg"].sum()


def build_supply(cache: ParseCache, paths: list[Path], catalog: Catalog) -> SupplyResult:
    """Aggregate the focus supply of every cached file and collect statistics over all published rows."""
    muni_names = municipality_names(cache, paths)
    parts, per_file = [], []
    totals = {"department_name_fixed": 0, "department_code_fixed": 0, "foreign": 0}
    markets_by_year: dict[int, set[str]] = {}
    out_of_scope = {"rows_without_product_id": 0, "rows_without_market_id": 0, "focus_rows": 0}
    out_names: dict[str, set[str]] = {"products": set(), "markets": set()}
    for path in paths:
        frame = cache.load_frame(path)
        meta = cache.load_meta(path)
        market_ids = catalog.resolve_markets(pd.Series(frame["market_name"].cat.categories))
        product_ids = catalog.resolve_products("supply", pd.Series(frame["product_name"].cat.categories))
        market_id = market_ids.take(frame["market_name"].cat.codes).reset_index(drop=True)
        product_id = product_ids.take(frame["product_name"].cat.codes).reset_index(drop=True)
        origins, fixes = resolve_origins(frame)
        for key, value in fixes.items():
            totals[key] += value
        focus = (market_id.notna() & product_id.notna()).to_numpy()
        out_of_scope["rows_without_product_id"] += int(product_id.isna().sum())
        out_of_scope["rows_without_market_id"] += int(market_id.isna().sum())
        out_of_scope["focus_rows"] += int(focus.sum())
        other_products = frame.loc[product_id.isna().to_numpy(), "product_name"].unique()
        other_markets = frame.loc[market_id.isna().to_numpy(), "market_name"].unique()
        out_names["products"].update(name_key(n) for n in other_products)
        out_names["markets"].update(market_key(n) for n in other_markets)
        parts.append(aggregate_supply(pd.DataFrame({
            "date": frame["date"][focus], "market_id": market_id[focus], "product_id": product_id[focus],
            **{column: origins[column][focus] for column in ORIGIN_COLUMNS},
            "quantity_kg": frame["quantity_kg"][focus],
        })))
        keys = {n: market_key(n) for n in frame["market_name"].cat.categories}
        markets = frame["market_name"].map(keys).astype(str)  # maps the categories, not every row
        for year, names in markets.groupby(frame["date"].dt.year).unique().items():
            markets_by_year.setdefault(int(year), set()).update(names)
        per_file.append({"file": path.name, "rows_read": meta["rows_read"], "rows_kept": int(len(frame)),
                         "focus_rows": int(focus.sum()),
                         "text_date_rows": meta["text_date_rows"], "bad_date_rows": meta["bad_date_rows"],
                         "non_positive_qty_rows": meta["non_positive_qty_rows"],
                         "non_numeric_qty_rows": meta["non_numeric_qty_rows"],
                         "date_min": meta["date_min"], "date_max": meta["date_max"],
                         "tonnes": round(float(frame["quantity_kg"].sum()) / 1000, 1),
                         "markets": int(markets.nunique())})
        log.info("Supply: %s -> %d rows read, %d in focus", path.name, len(frame), int(focus.sum()))
        del frame, origins
    # A week can span two yearly files (late December / early January), so aggregate once more.
    supply = (pd.concat(parts, ignore_index=True)
              .groupby(SUPPLY_KEYS, as_index=False, dropna=False, sort=True)["quantity_kg"].sum())
    departments, municipalities = origin_lookups(muni_names)
    years = sorted(markets_by_year)
    joined = {year: sorted(markets_by_year[year] - markets_by_year[prev]) for prev, year in zip(years, years[1:])}
    out_of_scope.update(products_without_id=len(out_names["products"]), markets_without_id=len(out_names["markets"]))
    stats = {"files": per_file, "origin_fixes": totals, "out_of_scope": out_of_scope,
             "markets_by_year": {y: len(m) for y, m in markets_by_year.items()},
             "markets_joined_by_year": {y: m for y, m in joined.items() if m},
             "rows_total": sum(f["rows_kept"] for f in per_file)}
    return SupplyResult(supply, weekly_totals(supply), departments, municipalities, stats)

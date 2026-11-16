"""Builds the supply tables from the cached microdata, one file at a time to keep memory low."""

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from backend.app.domains.catalog.generator import market_key
from backend.app.domains.catalog.loader import Catalog
from backend.app.domains.ingestion.cache import ParseCache
from backend.app.domains.ingestion.text import name_key
from backend.app.domains.supply.divipola import DEPARTMENTS, resolve_origin

log = logging.getLogger(__name__)

SUPPLY_COLUMNS = ["date", "market_name", "market_id", "product_name", "product_id",
                  "origin_department_code", "origin_department_name",
                  "origin_municipality_code", "origin_municipality_name", "origin_country", "quantity_kg"]
_ORIGIN_COLUMNS = ["dept_code", "dept_name", "muni_code", "muni_name"]


@dataclass
class SupplyResult:
    weekly: pd.DataFrame
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


def resolve_origins(frame: pd.DataFrame, muni_names: dict[str, str]) -> tuple[pd.DataFrame, dict[str, int]]:
    """Resolve the origin columns once per distinct published combination and broadcast them to the rows."""
    combos = frame[_ORIGIN_COLUMNS].astype(str)
    codes, uniques = pd.MultiIndex.from_frame(combos).factorize()
    resolved, fixes = [], {"department_name_fixed": 0, "department_code_fixed": 0, "foreign": 0}
    rows_per_combo = pd.Series(codes).value_counts()
    for position, (dept_code, dept_name, muni_code, muni_name) in enumerate(uniques):
        code, muni, country = resolve_origin(dept_code, muni_code, muni_name)
        official = DEPARTMENTS.get(code) if code else None
        n = int(rows_per_combo.get(position, 0))
        if official and name_key(official) != name_key(dept_name):
            fixes["department_name_fixed"] += n
        if code and dept_code.zfill(2) != code:
            fixes["department_code_fixed"] += n
        if country and country != "COLOMBIA":
            fixes["foreign"] += n
        resolved.append((code, official, muni, muni_names.get(muni) if muni else None, country))
    table = pd.DataFrame(resolved, columns=SUPPLY_COLUMNS[5:10])
    out = table.iloc[codes].reset_index(drop=True)
    return out, fixes


def build_supply(cache: ParseCache, paths: list[Path], catalog: Catalog,
                 write: Callable[[pd.DataFrame], None]) -> SupplyResult:
    """Write the tidy supply rows through `write` file by file and return the weekly aggregate and statistics."""
    muni_names = municipality_names(cache, paths)
    weekly_parts, per_file, totals = [], [], {"department_name_fixed": 0, "department_code_fixed": 0, "foreign": 0}
    markets_by_year: dict[int, set[str]] = {}
    out_of_scope = {"rows_without_product_id": 0, "rows_without_market_id": 0, "focus_rows": 0}
    out_names: dict[str, set[str]] = {"products": set(), "markets": set()}
    for path in paths:
        frame = cache.load_frame(path)
        meta = cache.load_meta(path)
        market_ids = catalog.resolve_markets(pd.Series(frame["market_name"].cat.categories))
        product_ids = catalog.resolve_products("supply", pd.Series(frame["product_name"].cat.categories))
        out = pd.DataFrame({
            "date": frame["date"],
            "market_name": frame["market_name"],
            "market_id": market_ids.take(frame["market_name"].cat.codes).reset_index(drop=True),
            "product_name": frame["product_name"],
            "product_id": product_ids.take(frame["product_name"].cat.codes).reset_index(drop=True),
        })
        origins, fixes = resolve_origins(frame, muni_names)
        for key, value in fixes.items():
            totals[key] += value
        out = pd.concat([out, origins], axis=1)
        out["quantity_kg"] = frame["quantity_kg"].to_numpy()
        out_of_scope["rows_without_product_id"] += int(out["product_id"].isna().sum())
        out_of_scope["rows_without_market_id"] += int(out["market_id"].isna().sum())
        out_of_scope["focus_rows"] += int((out["product_id"].notna() & out["market_id"].notna()).sum())
        out_names["products"].update(name_key(n) for n in out.loc[out["product_id"].isna(), "product_name"].unique())
        out_names["markets"].update(name_key(n) for n in out.loc[out["market_id"].isna(), "market_name"].unique())
        write(out[SUPPLY_COLUMNS])
        iso = out["date"].dt.isocalendar()
        mapped = out["product_id"].notna() & out["market_id"].notna()
        weekly_parts.append(pd.DataFrame({
            "iso_year": iso["year"][mapped].astype(int), "iso_week": iso["week"][mapped].astype(int),
            "market_id": out["market_id"][mapped].astype(int), "product_id": out["product_id"][mapped].astype(int),
            "quantity_kg": out["quantity_kg"][mapped],
        }).groupby(["iso_year", "iso_week", "market_id", "product_id"], as_index=False)["quantity_kg"].sum())
        row_years = out["date"].dt.year
        for year, markets in out["market_name"].astype(str).groupby(row_years).unique().items():
            markets_by_year.setdefault(int(year), set()).update(market_key(m) for m in markets)
        per_file.append({"file": path.name, "rows_read": meta["rows_read"], "rows_kept": int(len(out)),
                         "text_date_rows": meta["text_date_rows"], "bad_date_rows": meta["bad_date_rows"],
                         "non_positive_qty_rows": meta["non_positive_qty_rows"],
                         "non_numeric_qty_rows": meta["non_numeric_qty_rows"],
                         "date_min": meta["date_min"], "date_max": meta["date_max"],
                         "tonnes": round(float(out["quantity_kg"].sum()) / 1000, 1),
                         "markets": int(out["market_name"].astype(str).map(market_key).nunique())})
        log.info("Supply: %s -> %d rows", path.name, len(out))
        del frame, out, origins
    weekly = (pd.concat(weekly_parts, ignore_index=True)
              .groupby(["iso_year", "iso_week", "market_id", "product_id"], as_index=False)["quantity_kg"].sum())
    years = sorted(markets_by_year)
    joined = {year: sorted(markets_by_year[year] - markets_by_year[prev]) for prev, year in zip(years, years[1:])}
    out_of_scope.update(products_without_id=len(out_names["products"]), markets_without_id=len(out_names["markets"]))
    stats = {"files": per_file, "origin_fixes": totals, "out_of_scope": out_of_scope,
             "markets_by_year": {y: len(m) for y, m in markets_by_year.items()},
             "markets_joined_by_year": {y: m for y, m in joined.items() if m},
             "rows_total": sum(f["rows_kept"] for f in per_file)}
    return SupplyResult(weekly, stats)

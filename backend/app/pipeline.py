"""Orchestrates the data pipeline: raw DANE files -> parse cache -> catalog mapping -> SQLite database."""

import json
import logging
import sqlite3
import time
from dataclasses import dataclass
from datetime import date
from typing import Any

import pandas as pd

from backend.app.core.config import Settings
from backend.app.core.database import Base, create_db_engine
from backend.app.domains.catalog import models as catalog_models  # noqa: F401  (registers tables)
from backend.app.domains.catalog.focus import FOCUS_MARKETS, FOCUS_PRODUCTS
from backend.app.domains.catalog.generator import build_market_catalog, build_product_catalog
from backend.app.domains.catalog.loader import Catalog, load_catalog
from backend.app.domains.ingestion import models as ingestion_models  # noqa: F401
from backend.app.domains.ingestion.manifest import ManifestEntry, load_manifest
from backend.app.domains.ingestion.runner import ensure_supply_parsed, ensure_weekly_parsed, load_weekly, supply_cache
from backend.app.domains.prices import models as price_models  # noqa: F401
from backend.app.domains.prices.builder import build_price_tables
from backend.app.domains.prices.cleaning import is_header_artifact
from backend.app.domains.prices.coverage import compute_coverage
from backend.app.domains.supply import models as supply_models  # noqa: F401
from backend.app.domains.supply.builder import build_supply

log = logging.getLogger(__name__)


@dataclass
class Sources:
    weekly: list[ManifestEntry]
    supply: list[ManifestEntry]
    skipped: list[ManifestEntry]


def select_sources(settings: Settings) -> Sources:
    """Weekly annexes and yearly supply microdata from the manifest. Monthly series and the aggregated supply series
    are reference files described in docs/data_exploration.md and are not loaded."""
    weekly, supply, skipped = [], [], []
    for entry in load_manifest(settings.raw_dir):
        if not entry.path(settings.raw_dir).exists():
            log.warning("Manifest file missing on disk: %s", entry.file)
            skipped.append(entry)
        elif entry.source == "prices_weekly":
            weekly.append(entry)
        elif entry.source == "supply" and "microdato" in entry.file_name.lower():
            supply.append(entry)
        else:
            skipped.append(entry)
    supply.sort(key=lambda e: e.file_name[-9:])
    return Sources(weekly, supply, skipped)


def parse_sources(settings: Settings, sources: Sources) -> None:
    ensure_weekly_parsed(sources.weekly, settings.raw_dir, settings.pipeline_cache_dir, settings.prices_workers)
    ensure_supply_parsed(sources.supply, settings.raw_dir, settings.pipeline_cache_dir, settings.supply_workers)


def collect_names(settings: Settings, sources: Sources) -> dict[str, pd.DataFrame]:
    """Distinct published names with row counts, as input for the catalog generator."""
    price_rows = []
    for _, frame, _ in load_weekly(sources.weekly, settings.raw_dir, settings.pipeline_cache_dir):
        if frame.empty:
            continue
        counts = frame.value_counts(["product_name", "market_name", "group_label"], sort=False).reset_index(name="rows")
        price_rows.append(counts[counts["rows"] > 0])
    prices = pd.concat(price_rows).astype({c: str for c in ("product_name", "market_name", "group_label")})
    prices = prices[[not is_header_artifact(p, m) for p, m in zip(prices["product_name"], prices["market_name"])]]
    cache = supply_cache(settings.pipeline_cache_dir)
    supply_rows = []
    for entry in sources.supply:
        frame = cache.load_frame(entry.path(settings.raw_dir), columns=["market_name", "product_name", "group_label",
                                                                        "cpc_code"])
        counts = frame.value_counts(sort=False).reset_index(name="rows")
        supply_rows.append(counts[counts["rows"] > 0])  # categorical value_counts lists unobserved combinations
    supply = pd.concat(supply_rows).astype({c: str for c in ("market_name", "product_name", "group_label", "cpc_code")})
    return {
        "price_products": prices.groupby(["product_name", "group_label"], as_index=False)["rows"].sum()
        .rename(columns={"product_name": "name"}),
        "price_markets": prices.groupby("market_name", as_index=False)["rows"].sum()
        .rename(columns={"market_name": "name"}),
        "supply_products": supply.groupby(["product_name", "group_label", "cpc_code"], as_index=False)["rows"].sum()
        .rename(columns={"product_name": "name"}),
        "supply_markets": supply.groupby("market_name", as_index=False)["rows"].sum()
        .rename(columns={"market_name": "name"}),
    }


def generate_catalog(settings: Settings) -> dict[str, int]:
    """Parse the sources (cached) and write the four catalog CSV files for the focus set, keeping existing ids."""
    sources = select_sources(settings)
    parse_sources(settings, sources)
    names = collect_names(settings, sources)
    directory = settings.catalog_dir
    read = lambda n: pd.read_csv(directory / n, dtype=str, keep_default_na=False) if (directory / n).exists() else None  # noqa: E731
    products, mapping = build_product_catalog(names["price_products"], names["supply_products"], FOCUS_PRODUCTS,
                                              read("products.csv"))
    cities = pd.read_csv(directory / "cities.csv", encoding="utf-8")
    markets, market_mapping = build_market_catalog(names["price_markets"], names["supply_markets"], cities,
                                                   FOCUS_MARKETS, read("markets.csv"))
    products.to_csv(directory / "products.csv", index=False, encoding="utf-8")
    mapping.to_csv(directory / "product_mapping.csv", index=False, encoding="utf-8")
    markets.to_csv(directory / "markets.csv", index=False, encoding="utf-8")
    market_mapping.to_csv(directory / "market_mapping.csv", index=False, encoding="utf-8")
    summary = {"products": len(products), "product_names_mapped": len(mapping),
               "product_names_by_method": mapping["method"].value_counts().to_dict(),
               "markets": len(markets), "market_names_mapped": len(market_mapping),
               "markets_without_coordinates": int(markets["latitude"].isna().sum())}
    log.info("Catalog written to %s: %s", directory, summary)
    return summary


def _as_sql_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Dates as ISO text (the format SQLAlchemy reads back for Date columns) and nullable ints as objects."""
    out = frame.copy()
    for column in out.columns:
        series = out[column]
        sample = series.dropna()
        if pd.api.types.is_datetime64_any_dtype(series):
            out[column] = series.dt.strftime("%Y-%m-%d")
        elif series.dtype == object and len(sample) and isinstance(sample.iloc[0], date):
            out[column] = series.map(lambda d: d.isoformat() if isinstance(d, date) else None)
        elif isinstance(series.dtype, pd.CategoricalDtype):
            out[column] = series.astype(object).where(series.notna(), None)
        elif str(series.dtype) == "Int64":
            out[column] = series.astype(object).where(series.notna(), None)
    return out


class DatabaseWriter:
    """Appends DataFrames to tables created from the SQLAlchemy models, through the raw sqlite3 connection."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection
        self.counts: dict[str, int] = {}

    def write(self, table: str, frame: pd.DataFrame, chunksize: int = 200_000) -> None:
        _as_sql_frame(frame).to_sql(table, self.connection, if_exists="append", index=False, chunksize=chunksize)
        self.counts[table] = self.counts.get(table, 0) + len(frame)


def _events(price_stats: dict[str, Any], supply_stats: dict[str, Any], files: pd.DataFrame) -> pd.DataFrame:
    rows = [("prices", "warning", f"Archivo excluido ({r.status}): {r.file_name}", r.label)
            for r in files[files["status"] != "ok"].itertuples()]
    for reason, count in price_stats["rows_excluded_by_reason"].items():
        rows.append(("prices", "info", f"Filas excluidas: {reason}", str(count)))
    for product, count in price_stats["unit_jump_rows_by_product"].items():
        rows.append(("prices", "info", f"Saltos de unidad (>20x) excluidos: {product}", str(count)))
    for key, value in supply_stats["origin_fixes"].items():
        rows.append(("supply", "info", f"Origen corregido: {key}", str(value)))
    for year, markets in supply_stats["markets_joined_by_year"].items():
        rows.append(("supply", "info", f"Mercados que entran en {year}", json.dumps(markets)))
    return pd.DataFrame(rows, columns=["step", "level", "message", "value"])


def build_database(settings: Settings) -> dict[str, Any]:
    """Rebuild data/processed/mercao.db from the raw files. The new database replaces the old one only on success."""
    started = time.perf_counter()
    sources = select_sources(settings)
    log.info("Sources: %d weekly annexes, %d supply microdata files, %d reference files skipped",
             len(sources.weekly), len(sources.supply), len(sources.skipped))
    parse_sources(settings, sources)
    catalog: Catalog = load_catalog(settings.catalog_dir)

    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    target = settings.database_path
    tmp = target.with_suffix(".db.tmp")
    tmp.unlink(missing_ok=True)
    engine = create_db_engine(f"sqlite:///{tmp.as_posix()}", bulk_load=True)
    Base.metadata.create_all(engine)
    raw = engine.raw_connection()
    writer = DatabaseWriter(raw.driver_connection)
    try:
        writer.write("products", catalog.products)
        writer.write("product_mapping", catalog.product_mapping)
        writer.write("markets", catalog.markets)
        writer.write("market_mapping", catalog.market_mapping)

        log.info("Building prices")
        price_tables = build_price_tables(load_weekly(sources.weekly, settings.raw_dir, settings.pipeline_cache_dir),
                                          catalog)
        writer.write("price_files", price_tables.files)
        writer.write("prices", price_tables.prices)
        writer.write("price_exclusions", price_tables.exclusions)
        coverage = compute_coverage(price_tables.prices, catalog.products)
        writer.write("coverage", coverage)

        log.info("Building supply")
        cache = supply_cache(settings.pipeline_cache_dir)
        paths = [e.path(settings.raw_dir) for e in sources.supply]
        supply = build_supply(cache, paths, catalog)
        writer.write("origin_departments", supply.departments)
        writer.write("origin_municipalities", supply.municipalities)
        writer.write("supply", supply.supply)
        writer.write("supply_weekly", supply.weekly)
        writer.write("pipeline_log", _events(price_tables.stats, supply.stats, price_tables.files))
        raw.driver_connection.commit()
    finally:
        raw.close()
        engine.dispose()
    target.unlink(missing_ok=True)
    tmp.replace(target)

    usable = coverage[coverage["usable_for_model"]]
    group_sizes = usable.groupby("comparable_group")["market_id"].nunique()
    summary = {
        "table_rows": writer.counts,
        "prices": price_tables.stats,
        "supply": supply.stats,
        "coverage": {"pairs": len(coverage), "usable_pairs": len(usable),
                     "comparable_groups_usable": int(len(group_sizes)),
                     "comparable_groups_2plus_markets": int((group_sizes >= 2).sum())},
        "catalog": {"products": len(catalog.products), "markets": len(catalog.markets),
                    "product_names_mapped": len(catalog.product_mapping),
                    "product_names_by_method": catalog.product_mapping["method"].value_counts().to_dict(),
                    "market_names_mapped": len(catalog.market_mapping)},
        "out_of_scope": {"prices": price_tables.stats["out_of_scope"], "supply": supply.stats["out_of_scope"]},
        "runtime_seconds": round(time.perf_counter() - started, 1),
    }
    (settings.processed_dir / "build_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    log.info("Database written to %s in %.1f s", target, summary["runtime_seconds"])
    return summary

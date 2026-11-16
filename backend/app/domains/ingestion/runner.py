"""Parses every raw file once, in parallel, and keeps the results in the per-file cache under data/interim/pipeline."""

import logging
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import pandas as pd

from backend.app.domains.ingestion import supply_microdata, weekly_prices
from backend.app.domains.ingestion.cache import ParseCache
from backend.app.domains.ingestion.manifest import ManifestEntry

log = logging.getLogger(__name__)


def weekly_cache(cache_root: Path) -> ParseCache:
    return ParseCache(cache_root / "prices_weekly", weekly_prices.PARSER_VERSION, fmt="pickle")


def supply_cache(cache_root: Path) -> ParseCache:
    return ParseCache(cache_root / "supply", supply_microdata.PARSER_VERSION, fmt="parquet")


def _parse_weekly_to_cache(path: str, cache_root: str) -> str:
    source = Path(path)
    try:
        frame, meta = weekly_prices.parse_weekly_file(source)
    except Exception as exc:  # a broken file is reported, not fatal
        frame = pd.DataFrame(columns=weekly_prices.WEEKLY_COLUMNS)
        meta = {"error": f"{type(exc).__name__}: {exc}", "rows": 0}
    for column in ("product_name", "market_name", "group_label"):
        frame[column] = frame[column].astype("category")
    weekly_cache(Path(cache_root)).store(source, frame, meta)
    return source.name


def _parse_supply_to_cache(path: str, cache_root: str) -> str:
    source = Path(path)
    frame, meta = supply_microdata.parse_supply_file(source)
    supply_cache(Path(cache_root)).store(source, frame, meta)
    return source.name


def _run_pending(pending: list[Path], worker, cache_root: Path, workers: int, label: str) -> None:  # noqa: ANN001
    if not pending:
        log.info("%s: all %s files cached", label, "parsed")
        return
    log.info("%s: parsing %d files with %d workers", label, len(pending), workers)
    if workers <= 1:
        for i, path in enumerate(pending, 1):
            worker(str(path), str(cache_root))
            log.info("%s: parsed %d/%d %s", label, i, len(pending), path.name)
        return
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(worker, str(p), str(cache_root)): p for p in pending}
        for i, future in enumerate(as_completed(futures), 1):
            name = future.result()
            if i % 50 == 0 or i == len(pending) or label == "supply":
                log.info("%s: parsed %d/%d (last: %s)", label, i, len(pending), name)


def ensure_weekly_parsed(entries: list[ManifestEntry], raw_dir: Path, cache_root: Path, workers: int) -> None:
    cache = weekly_cache(cache_root)
    paths = [e.path(raw_dir) for e in entries]
    _run_pending([p for p in paths if not cache.is_fresh(p)], _parse_weekly_to_cache, cache_root, workers, "weekly")


def ensure_supply_parsed(entries: list[ManifestEntry], raw_dir: Path, cache_root: Path, workers: int) -> None:
    cache = supply_cache(cache_root)
    paths = [e.path(raw_dir) for e in entries]
    _run_pending([p for p in paths if not cache.is_fresh(p)], _parse_supply_to_cache, cache_root, workers, "supply")


WeeklyItem = tuple[ManifestEntry, pd.DataFrame, dict[str, Any]]


def load_weekly(entries: list[ManifestEntry], raw_dir: Path, cache_root: Path) -> list[WeeklyItem]:
    """Cached weekly frames in manifest order."""
    cache = weekly_cache(cache_root)
    return [(e, cache.load_frame(e.path(raw_dir)), cache.load_meta(e.path(raw_dir))) for e in entries]

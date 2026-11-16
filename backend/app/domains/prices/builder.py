"""Builds the tidy weekly price table from the parsed annexes."""

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from backend.app.domains.catalog.generator import market_key
from backend.app.domains.catalog.loader import Catalog
from backend.app.domains.ingestion.manifest import ManifestEntry
from backend.app.domains.ingestion.text import name_key
from backend.app.domains.ingestion.weeks import complete_label, iso_week_bounds, iso_week_of_interval, parse_week_label
from backend.app.domains.prices.cleaning import flag_unit_jumps, is_header_artifact, price_unit

log = logging.getLogger(__name__)

PRICE_COLUMNS = ["week_start", "week_end", "iso_year", "iso_week", "product_name", "product_id", "variety",
                 "market_name", "market_id", "min_price", "max_price", "mean_price", "unit", "source_file"]


@dataclass
class PriceTables:
    prices: pd.DataFrame
    exclusions: pd.DataFrame
    files: pd.DataFrame
    stats: dict[str, Any] = field(default_factory=dict)


def describe_files(items: list[tuple[ManifestEntry, pd.DataFrame, dict[str, Any]]]) -> pd.DataFrame:
    """One row per annex: published label, parsed dates, assigned ISO week and status."""
    records = []
    for entry, frame, meta in items:
        start, end = parse_week_label(complete_label(entry.label, entry.file_name))
        record = {"file_name": entry.file_name, "label": entry.label, "label_start": start, "label_end": end,
                  "label_days": (end - start).days + 1 if start and end else None, "iso_year": None,
                  "iso_week": None, "rows_read": int(len(frame)), "layout": meta.get("layout", "unknown"), "note": ""}
        if meta.get("error"):
            record.update(status="error", note=meta["error"])
        elif end is None:
            record.update(status="excluded_undated", note="La etiqueta publicada no tiene fecha")
        elif frame.empty:
            record.update(status="empty")
        else:
            iso_year, iso_week = iso_week_of_interval(start, end)
            record.update(status="ok", iso_year=iso_year, iso_week=iso_week)
        records.append(record)
    files = pd.DataFrame(records)
    for _, row in files[files["status"] != "ok"].iterrows():
        log.warning("Weekly file %s excluded (%s): %s %s", row["file_name"], row["status"], row["label"], row["note"])
    return files


def build_price_tables(items: list[tuple[ManifestEntry, pd.DataFrame, dict[str, Any]]],
                       catalog: Catalog) -> PriceTables:
    """Combine every dated annex, map names to the catalog and apply the cleaning rules in a fixed order:
    header artifacts, missing prices, duplicates, unit jumps. Excluded rows go to the exclusions frame."""
    files = describe_files(items)
    ok_files = files.set_index("file_name")
    frames = []
    for entry, frame, _ in items:
        if entry.file_name not in ok_files.index or ok_files.at[entry.file_name, "status"] != "ok":
            continue
        info = ok_files.loc[entry.file_name]
        frames.append(frame.astype({c: str for c in ("product_name", "market_name", "group_label")}).assign(
            source_file=entry.file_name, iso_year=int(info["iso_year"]), iso_week=int(info["iso_week"]),
            label_end=info["label_end"]))
    data = pd.concat(frames, ignore_index=True)
    stats: dict[str, Any] = {"files_total": len(files), "files_by_status": files["status"].value_counts().to_dict(),
                             "rows_read": int(len(data))}
    log.info("Prices: %d rows read from %d dated files", len(data), len(frames))

    bounds = {wk: iso_week_bounds(*wk) for wk in set(zip(data["iso_year"], data["iso_week"]))}
    weeks = list(zip(data["iso_year"], data["iso_week"]))
    data["week_start"] = [bounds[w][0] for w in weeks]
    data["week_end"] = [bounds[w][1] for w in weeks]
    data["product_id"] = catalog.resolve_products("prices", data["product_name"])
    data["market_id"] = catalog.resolve_markets(data["market_name"])
    products = catalog.products.set_index("product_id")
    data["variety"] = data["product_id"].map(products["variety"]).astype(object)
    unit_by_name = {n: price_unit(n) for n in data["product_name"].unique()}
    data["unit"] = data["product_name"].map(unit_by_name)
    data["reason"] = ""
    data["detail"] = ""

    artifacts = [is_header_artifact(p, m) for p, m in zip(data["product_name"], data["market_name"])]
    data.loc[artifacts, "reason"] = "header_artifact"
    missing = (data["reason"] == "") & ~(data["mean_price"] > 0)
    data.loc[missing, "reason"] = "missing_price"
    # Series keys: the catalog id for focus products and markets, the normalized published name for the rest, so
    # the duplicate and unit-jump rules also apply to products and markets outside the focus set.
    product_keys = {n: "name:" + name_key(n) for n in data["product_name"].unique()}
    market_keys = {n: "name:" + market_key(n) for n in data["market_name"].unique()}
    data["_p"] = data["product_id"].astype(str).where(data["product_id"].notna(),
                                                      data["product_name"].map(product_keys))
    data["_m"] = data["market_id"].astype(str).where(data["market_id"].notna(), data["market_name"].map(market_keys))

    # Duplicates: the same product and market twice in one ISO week. The row from the latest label is kept.
    valid = data[data["reason"] == ""].sort_values(["label_end", "source_file"], ascending=[False, True])
    keys = ["_p", "_m", "iso_year", "iso_week"]
    value_columns = ["min_price", "max_price", "mean_price"]
    rank = valid.groupby(keys, sort=False).cumcount()
    firsts = valid[rank == 0].set_index(keys)
    dups = valid[rank > 0]
    reference = firsts.loc[pd.MultiIndex.from_frame(dups[keys])]
    same = (np.nan_to_num(dups[value_columns].to_numpy(), nan=-1)
            == np.nan_to_num(reference[value_columns].to_numpy(), nan=-1)).all(axis=1)
    data.loc[dups.index[same], "reason"] = "duplicate_exact"
    data.loc[dups.index[~same], "reason"] = "duplicate_conflict"
    data.loc[dups.index[~same], "detail"] = ("kept " + reference["source_file"].to_numpy()[~same]).tolist()

    # Unit jumps, on the remaining rows of every product-market series (focus or not).
    candidates = data[data["reason"] == ""].copy()
    candidates["week_order"] = candidates["iso_year"] * 100 + candidates["iso_week"]
    flags, ratios = flag_unit_jumps(candidates, ["_p", "_m"], "week_order")
    jumped = flags[flags].index
    data.loc[jumped, "reason"] = "unit_jump"
    data.loc[jumped, "detail"] = [f"ratio {r:.4g}" for r in ratios.loc[jumped]]

    data["range_inconsistent"] = ((data["min_price"] > data["max_price"])
                                  | (data["mean_price"] < data["min_price"] - 1)
                                  | (data["mean_price"] > data["max_price"] + 1))
    prices = data[data["reason"] == ""][PRICE_COLUMNS + ["range_inconsistent"]].sort_values(
        ["product_id", "market_id", "iso_year", "iso_week"]).reset_index(drop=True)
    exclusions = data[data["reason"] != ""][PRICE_COLUMNS + ["reason", "detail"]].reset_index(drop=True)

    stats["rows_excluded_by_reason"] = exclusions["reason"].value_counts().to_dict()
    stats["rows_kept"] = int(len(prices))
    stats["rows_range_inconsistent_kept"] = int(prices["range_inconsistent"].sum())
    jumps = exclusions[exclusions["reason"] == "unit_jump"]
    stats["unit_jump_rows_by_product"] = jumps.groupby("product_name").size().sort_values(ascending=False).to_dict()
    stats["unit_jump_pairs"] = int(data.loc[jumped].groupby(["_p", "_m"]).ngroups)
    out_product = prices["product_id"].isna()
    out_market = prices["market_id"].isna()
    stats["out_of_scope"] = {
        "rows_without_product_id": int(out_product.sum()),
        "product_names_without_id": int(prices.loc[out_product, "product_name"].nunique()),
        "products_without_id": int(prices.loc[out_product, "product_name"].map(product_keys).nunique()),
        "rows_without_market_id": int(out_market.sum()),
        "markets_without_id": int(prices.loc[out_market, "market_name"].map(market_keys).nunique()),
        "focus_rows": int((~out_product & ~out_market).sum()),
        "focus_product_rows_in_other_markets": int((~out_product & out_market).sum()),
    }
    stats["holiday_files"] = int((files["label_days"].notna() & (files["label_days"] != 7)).sum())
    stats["label_days"] = files["label_days"].dropna().astype(int).value_counts().sort_index().to_dict()
    log.info("Prices: kept %d rows, excluded %s", len(prices), stats["rows_excluded_by_reason"])
    return PriceTables(prices, exclusions, files, stats)

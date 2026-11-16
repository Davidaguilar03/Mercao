"""Parser for the weekly wholesale price annexes (2012-2026).

Two layouts exist (see docs/data_exploration.md, section 2.1):
- flat: one sheet per food group with columns Producto | Mercado mayorista | min | max | medio (2018 onwards).
- nested: one sheet with several "Cuadro N" blocks; a product row is followed by one row per market (older files).
"""

import math
import re
from pathlib import Path
from typing import Any

import pandas as pd

from backend.app.domains.ingestion.excel import Row, read_sheets
from backend.app.domains.ingestion.text import clean_text, name_key, to_number

PARSER_VERSION = "weekly-2"
WEEKLY_COLUMNS = ["product_name", "market_name", "group_label", "min_price", "max_price", "mean_price"]
_GROUP_TITLE_RE = re.compile(r"^\s*(?:cuadro\s+)?\d+(?:\.\d+)*\.?\s+(.+)$", re.IGNORECASE)


def _is_min(key: str) -> bool:
    return "minimo" in key or bool(re.match(r"^min( \d)?$", key))


def _is_max(key: str) -> bool:
    return "maximo" in key or bool(re.match(r"^max( \d)?$", key))


def _is_mean(key: str) -> bool:
    return "medio" in key or "promedio" in key or bool(re.match(r"^p( \d)?$", key))


def _is_footnote(text: str) -> bool:
    lowered = text.lower()
    return text.startswith("*") or lowered.startswith("fuente")


def _group_label(values: list[Row], header_i: int) -> str:
    """Food group title written a few rows above a header ('1.1. Verduras y hortalizas', 'Cuadro 2. ... de frutas')."""
    for i in range(header_i - 1, max(-1, header_i - 8), -1):
        for cell in values[i][:2]:
            text = clean_text(cell)
            if not text:
                continue
            if "de venta de " in text.lower():
                return text.lower().split("de venta de ", 1)[1].strip()
            match = _GROUP_TITLE_RE.match(text)
            if match:
                return match.group(1).strip()
    return ""


def parse_weekly_sheets(sheets: dict[str, list[Row]]) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Parse every sheet of an annex into rows of WEEKLY_COLUMNS plus a meta dict describing the file."""
    rows: list[tuple[str, str, str, float, float, float]] = []
    layouts: set[str] = set()
    header_rows: list[str] = []
    footnotes: set[str] = set()
    skipped_rows = 0
    for sheet_name, values in sheets.items():
        width = max((len(r) for r in values), default=0)
        values = [list(r) + [""] * (width - len(r)) for r in values]
        price_rows = [
            i for i, row in enumerate(values)
            if any(_is_min(k) for k in map(name_key, row)) and any(_is_max(k) for k in map(name_key, row))
        ]
        for block_index, header_i in enumerate(price_rows):
            header = [name_key(c) for c in values[header_i]]
            col_min = next(j for j, k in enumerate(header) if _is_min(k))
            col_max = next(j for j, k in enumerate(header) if _is_max(k))
            col_mean = next((j for j, k in enumerate(header) if _is_mean(k)), None)
            if col_mean is None:
                continue
            above = [name_key(c) for c in values[header_i - 1]] if header_i > 0 else []
            product_col = market_col = None
            for candidate in (header, above):
                if "producto" in candidate and any("mercado" in k for k in candidate):
                    product_col = candidate.index("producto")
                    market_col = next(j for j, k in enumerate(candidate) if "mercado" in k)
                    break
            layout = "flat" if product_col is not None else "nested"
            layouts.add(layout)
            if block_index == 0:
                header_rows.append(f"{sheet_name}:{header_i + 1}")
            group = _group_label(values, header_i)
            end_i = price_rows[block_index + 1] if block_index + 1 < len(price_rows) else len(values)
            current_product = ""
            for row in values[header_i + 1:end_i]:
                label = clean_text(row[0])
                mean = to_number(row[col_mean])
                if _is_footnote(label):
                    footnotes.add(label[:200])
                    continue
                if layout == "flat":
                    product, market = clean_text(row[product_col]), clean_text(row[market_col])
                    if not product or not market:
                        continue
                    if _is_footnote(product) or _is_footnote(market):
                        skipped_rows += 1
                        continue
                else:
                    if math.isnan(mean) and math.isnan(to_number(row[col_min])):
                        if label and not label.lower().startswith("cuadro") and len(label) < 80:
                            current_product = label
                        continue
                    product, market = current_product, label
                    if not product or not market:
                        continue
                rows.append((product, market, group, to_number(row[col_min]), to_number(row[col_max]), mean))
    frame = pd.DataFrame(rows, columns=WEEKLY_COLUMNS)
    meta = {
        "sheets": list(sheets),
        "layout": "/".join(sorted(layouts)) or "unknown",
        "header_rows": header_rows,
        "footnotes": sorted(footnotes),
        "rows": len(frame),
        "skipped_footnote_rows": skipped_rows,
    }
    return frame, meta


def parse_weekly_file(path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Read and parse one weekly annex (.xls or .xlsx)."""
    return parse_weekly_sheets(read_sheets(path))

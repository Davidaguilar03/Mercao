"""Parser for the yearly supply microdata files (2013-2026, about 2 million daily records each).

The files are streamed row by row and text columns are dictionary-encoded on the fly, so a file never needs more
than a few hundred MB of memory. Column names change across years (see docs/data_exploration.md, section 4.2):
'Código Departamento' became 'Divipola Depto Proc.', 'Municipio Proc.' became 'Municipio de Colombia / País Proc.'
and 'Código CPC' was added in 2024. The 2020 file stores dates as text ('02/01/20').
"""

from array import array
from collections.abc import Callable
from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from backend.app.domains.ingestion.excel import iter_sheet_rows
from backend.app.domains.ingestion.text import clean_text, name_key

PARSER_VERSION = "supply-1"
TEXT_COLUMNS = ["market_name", "dept_code", "dept_name", "muni_code", "muni_name", "group_label", "cpc_code",
                "product_name"]
HEADER_TESTS: dict[str, Callable[[str], bool]] = {
    "market_name": lambda k: "mercado" in k,
    "date": lambda k: k == "fecha",
    "dept_code": lambda k: ("codigo" in k or "divipola" in k) and "dep" in k,
    "muni_code": lambda k: ("codigo" in k or "divipola" in k) and "munic" in k,
    "dept_name": lambda k: k.startswith("departamento"),
    "muni_name": lambda k: k.startswith("municipio"),
    "group_label": lambda k: k == "grupo",
    "cpc_code": lambda k: "cpc" in k,
    "product_name": lambda k: k == "alimento",
    "quantity_kg": lambda k: k.startswith("cant"),
}
CODE_COLUMNS = {"dept_code", "muni_code", "cpc_code"}
TEXT_DATE_FORMATS = ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d")


class _Encoder:
    """Incremental dictionary encoder: raw cell value -> int code. Values are cleaned once per distinct value."""

    def __init__(self, cleaner: Callable[[Any], str]) -> None:
        self.cleaner = cleaner
        self.codes: dict[Any, int] = {}
        self.values: list[Any] = []
        self.data = array("i")

    def add(self, value: Any) -> None:
        code = self.codes.get(value)
        if code is None:
            code = len(self.values)
            self.codes[value] = code
            self.values.append(value)
        self.data.append(code)

    def categorical(self) -> pd.Categorical:
        codes = np.frombuffer(self.data, dtype=np.int32) if self.data else np.array([], dtype=np.int32)
        cleaned = [self.cleaner(v) for v in self.values]
        categories = list(dict.fromkeys(cleaned))
        position = {v: i for i, v in enumerate(categories)}
        remap = np.array([position[v] for v in cleaned], dtype=np.int32)
        return pd.Categorical.from_codes(remap[codes] if len(codes) else codes, categories=categories)


def parse_text_date(text: str) -> date | None:
    """'02/01/20' -> 2020-01-02 (day first). None when the text is not a date."""
    for fmt in TEXT_DATE_FORMATS:
        try:
            return datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _code(value: Any) -> str:
    """DIVIPOLA codes are published as text with a leading apostrophe ('05) or as numbers."""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return clean_text(value).lstrip("'")


def _find_header(rows) -> tuple[dict[str, int | None], int] | None:  # noqa: ANN001
    for i, row in enumerate(rows):
        keys = [name_key(c) for c in row]
        if "fecha" in keys and "alimento" in keys:
            return {field: next((j for j, k in enumerate(keys) if test(k)), None)
                    for field, test in HEADER_TESTS.items()}, i
        if i > 15:
            return None
    return None


def parse_supply_rows(sheets) -> tuple[pd.DataFrame, dict[str, Any]]:  # noqa: ANN001
    """Parse (sheet name, row iterator) pairs into one frame with TEXT_COLUMNS (categorical), date, quantity_kg."""
    encoders = {column: _Encoder(_code if column in CODE_COLUMNS else clean_text) for column in TEXT_COLUMNS}
    text_dates: dict[str, date | None] = {}
    dates = array("i")
    quantities = array("d")
    meta: dict[str, Any] = {"data_sheets": [], "header_rows": [], "rows_read": 0, "rows_kept": 0,
                            "text_date_rows": 0, "bad_date_rows": 0, "non_numeric_qty_rows": 0,
                            "non_positive_qty_rows": 0, "date_min": None, "date_max": None}
    for sheet_name, sheet_rows in sheets:
        rows = iter(sheet_rows)
        found = _find_header(rows)
        if found is None:
            continue
        index, header_i = found
        meta["data_sheets"].append(sheet_name)
        meta["header_rows"].append(f"{sheet_name}:{header_i + 1}")
        qty_i, date_i = index["quantity_kg"], index["date"]
        positions = [(column, index[column]) for column in TEXT_COLUMNS]
        for row in rows:
            if len(row) <= qty_i or all(c in ("", None) for c in row[:qty_i + 1]):
                continue
            meta["rows_read"] += 1
            when = row[date_i]
            if isinstance(when, str):
                if when not in text_dates:
                    text_dates[when] = parse_text_date(when) if when.strip() else None
                when = text_dates[when]
                if when is not None:
                    meta["text_date_rows"] += 1
            if isinstance(when, datetime):
                when = when.date()
            if not isinstance(when, date):
                meta["bad_date_rows"] += 1
                continue
            qty = row[qty_i]
            if isinstance(qty, str):
                try:
                    qty = float(qty.replace(",", ""))
                except ValueError:
                    qty = None
            if not isinstance(qty, (int, float)) or isinstance(qty, bool):
                meta["non_numeric_qty_rows"] += 1
                continue
            if qty <= 0:
                meta["non_positive_qty_rows"] += 1
                continue
            for column, position in positions:
                encoders[column].add(row[position] if position is not None else "")
            dates.append(when.toordinal())
            quantities.append(float(qty))
    frame = pd.DataFrame({column: encoder.categorical() for column, encoder in encoders.items()})
    ordinals = pd.Series(dates, dtype="int64")
    frame["date"] = pd.to_datetime(ordinals - date(1970, 1, 1).toordinal(), unit="D")
    frame["quantity_kg"] = pd.Series(quantities, dtype="float64")
    meta["rows_kept"] = len(frame)
    if len(frame):
        meta["date_min"], meta["date_max"] = str(frame["date"].min().date()), str(frame["date"].max().date())
    return frame, meta


def parse_supply_file(path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Stream and parse one microdata workbook."""
    return parse_supply_rows(iter_sheet_rows(path))

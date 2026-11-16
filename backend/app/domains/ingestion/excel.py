"""Spreadsheet reading for both the old .xls and the newer .xlsx files, using the calamine engine."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

from python_calamine import CalamineWorkbook

Row = list[Any]


def read_sheets(path: Path) -> dict[str, list[Row]]:
    """Every sheet as a list of rows, keeping empty leading rows and columns so positions match Excel.

    The format is detected from the content, not the extension: 27 annexes are .xlsx files published as .xls.
    """
    with open(path, "rb") as handle:
        workbook = CalamineWorkbook.from_filelike(handle)
    try:
        return {
            name: workbook.get_sheet_by_name(name).to_python(skip_empty_area=False)
            for name in workbook.sheet_names
        }
    finally:
        workbook.close()


def iter_sheet_rows(path: Path) -> Iterator[tuple[str, Iterator[Row]]]:
    """Stream (sheet name, row iterator) pairs without materializing whole sheets (for the large supply files)."""
    workbook = CalamineWorkbook.from_path(str(path))
    try:
        for name in workbook.sheet_names:
            yield name, workbook.get_sheet_by_name(name).iter_rows()
    finally:
        workbook.close()

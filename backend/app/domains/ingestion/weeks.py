"""Week labels published by DANE and their normalization to ISO weeks."""

import re
from collections import Counter
from datetime import date, timedelta

from backend.app.domains.ingestion.text import strip_accents

MONTHS_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7, "ago": 8, "sept": 9, "sep": 9,
    "oct": 10, "nov": 11, "dic": 12,
}
_MONTH_RE = "(?<![a-z])(?:" + "|".join(MONTHS_ES) + ")(?![a-z])"


def parse_week_label(label: str) -> tuple[date | None, date | None]:
    """Parse a bulletin label into (start, end).

    Handles '20 al 26 de diciembre de 2014', '28 de marzo al 5 de abril de 2013' and
    '20 de diciembre de 2025 - 26 de diciembre de 2025'. Returns (None, None) when no date is found.
    """
    text = strip_accents(label).lower()
    parts = re.findall(rf"(\d{{1,2}})\s*(?:de\s+)?({_MONTH_RE})?\s*(?:de\s+|del\s+)?(\d{{4}})?", text)
    parts = [p for p in parts if 1 <= int(p[0]) <= 31]
    years = re.findall(r"(20\d{2})", text)
    months = re.findall(rf"({_MONTH_RE})", text)
    if not parts or not years or not months:
        return None, None
    end_day, end_month, end_year = parts[-1]
    end_month_num = MONTHS_ES[end_month or months[-1]]
    end_year_num = int(end_year or years[-1])
    try:
        end = date(end_year_num, end_month_num, int(end_day))
    except ValueError:
        return None, None
    start_day, start_month, start_year = parts[0]
    try:
        start_month_num = MONTHS_ES[start_month] if start_month else end_month_num
        if start_year:
            start_year_num = int(start_year)
        else:
            start_year_num = end_year_num - 1 if start_month_num > end_month_num else end_year_num
        start = date(start_year_num, start_month_num, int(start_day))
    except ValueError:
        start = end - timedelta(days=6)
    if start > end or (end - start).days > 10:
        start = end - timedelta(days=6)
    return start, end


def complete_label(label: str, file_name: str) -> str:
    """Some 2012-2014 labels omit or truncate the year; take it from the file name."""
    if re.search(r"20\d{2}", label):
        return label
    fixed = re.sub(r"\s+(de\s+)?\d{1,3}$", "", label)
    file_year = re.search(r"(20\d{2})", file_name)
    return f"{fixed} de {file_year.group(1)}" if file_year else label


def iso_week_of_interval(start: date, end: date) -> tuple[int, int]:
    """ISO (year, week) holding most days of the published interval; ties go to the week of the end date.

    Regular bulletins run Saturday to Friday, so six of their seven days fall in the ISO week of the Friday.
    Holiday bulletins (4 to 9 days) are assigned with the same rule.
    """
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    counts = Counter(d.isocalendar()[:2] for d in days)
    end_week = end.isocalendar()[:2]
    best = max(counts.values())
    if counts[end_week] == best:
        return end_week[0], end_week[1]
    winner = max((week for week, n in counts.items() if n == best))
    return winner[0], winner[1]


def iso_week_bounds(iso_year: int, iso_week: int) -> tuple[date, date]:
    """Monday and Sunday of an ISO week."""
    monday = date.fromisocalendar(iso_year, iso_week, 1)
    return monday, monday + timedelta(days=6)


def iso_week_index(iso_year: int, iso_week: int) -> int:
    """Consecutive integer for an ISO week (Monday ordinal / 7), so differences count weeks."""
    return date.fromisocalendar(iso_year, iso_week, 1).toordinal() // 7

"""Text and number normalization shared by every parser."""

import math
import re
import unicodedata
from typing import Any


def strip_accents(text: Any) -> str:
    """Remove diacritics: 'Bogotá' -> 'Bogota'."""
    return "".join(c for c in unicodedata.normalize("NFKD", str(text)) if not unicodedata.combining(c))


def name_key(text: Any) -> str:
    """Normalized key used to match names across files: lowercase, no accents, alphanumerics separated by one space."""
    text = strip_accents(text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def clean_text(value: Any) -> str:
    """Cell value as a trimmed single-spaced string; empty for None or NaN."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def to_number(value: Any) -> float:
    """Cell value as float, NaN when it is not numeric."""
    if isinstance(value, bool):
        return math.nan
    if isinstance(value, (int, float)):
        return float(value)
    text = clean_text(value).replace(",", "")
    try:
        return float(text)
    except ValueError:
        return math.nan


def slugify(text: Any) -> str:
    """'Papa parda pastusa' -> 'papa-parda-pastusa'."""
    return name_key(text).replace(" ", "-")

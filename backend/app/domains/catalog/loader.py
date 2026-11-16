"""Reads the curated catalog CSV files and resolves published names to ids."""

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from backend.app.domains.catalog.generator import market_key
from backend.app.domains.ingestion.text import name_key

CATALOG_FILES = ("products.csv", "product_mapping.csv", "markets.csv", "market_mapping.csv")


@dataclass
class Catalog:
    products: pd.DataFrame
    product_mapping: pd.DataFrame
    markets: pd.DataFrame
    market_mapping: pd.DataFrame

    def product_lookup(self, source: str) -> dict[str, int]:
        """Published name -> product_id for one source. Unknown spellings fall back to their name_key."""
        rows = self.product_mapping[self.product_mapping["source"] == source]
        return dict(zip(rows["source_name"], rows["product_id"].astype(int)))

    def resolve_products(self, source: str, names: pd.Series) -> pd.Series:
        """Map names to product ids (nullable Int64). New spellings match on name_key within the same source."""
        exact = self.product_lookup(source)
        by_key = {name_key(n): i for n, i in exact.items()}
        return names.map(lambda n: exact.get(n, by_key.get(name_key(n)))).astype("Int64")

    def resolve_markets(self, names: pd.Series) -> pd.Series:
        """Map market names (any source) to market ids (nullable Int64)."""
        exact = dict(zip(self.market_mapping["source_name"], self.market_mapping["market_id"].astype(int)))
        by_key = {market_key(n): i for n, i in exact.items()}
        return names.map(lambda n: exact.get(n, by_key.get(market_key(n)))).astype("Int64")


def catalog_exists(catalog_dir: Path) -> bool:
    return all((catalog_dir / name).exists() for name in CATALOG_FILES)


def load_catalog(catalog_dir: Path) -> Catalog:
    """Load the four CSV files; codes are read as text to keep leading zeros."""
    if not catalog_exists(catalog_dir):
        raise FileNotFoundError(
            f"Catalog CSV files missing in {catalog_dir}: run python -m backend.scripts.generate_catalog")
    read = lambda name: pd.read_csv(catalog_dir / name, dtype=str, keep_default_na=False, encoding="utf-8")  # noqa: E731
    products = read("products.csv").astype({"product_id": int})
    mapping = read("product_mapping.csv").astype({"product_id": int})
    markets = read("markets.csv").astype({"market_id": int})
    for column in ("latitude", "longitude"):
        markets[column] = pd.to_numeric(markets[column], errors="coerce")
    market_mapping = read("market_mapping.csv").astype({"market_id": int})
    return Catalog(products, mapping, markets, market_mapping)

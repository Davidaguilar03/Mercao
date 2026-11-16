"""Regenerate the catalog CSV files (products, product_mapping, markets, market_mapping) from the raw data.

Usage: python -m backend.scripts.generate_catalog

Existing ids are kept and rows with method=manual in product_mapping.csv are never overwritten.
"""

from backend.app.core.config import get_settings
from backend.app.core.logging import configure_logging
from backend.app.pipeline import generate_catalog


def main() -> None:
    settings = get_settings()
    configure_logging(settings.processed_dir / "generate_catalog.log")
    generate_catalog(settings)


if __name__ == "__main__":
    main()

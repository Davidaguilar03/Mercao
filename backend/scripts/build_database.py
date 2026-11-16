"""Rebuild data/processed/mercao.db from the raw DANE files.

Usage: python -m backend.scripts.build_database

Parsed raw files are cached in data/interim/pipeline; a rebuild only re-reads files whose size or modification time
changed. Delete that folder to force a full re-parse.
"""

import json
import logging

from backend.app.core.config import get_settings
from backend.app.core.logging import configure_logging
from backend.app.pipeline import build_database


def main() -> None:
    settings = get_settings()
    configure_logging(settings.processed_dir / "pipeline.log")
    summary = build_database(settings)
    logging.getLogger(__name__).info("Summary:\n%s", json.dumps(
        {k: summary[k] for k in ("table_rows", "coverage", "catalog", "runtime_seconds")}, indent=1, default=str))


if __name__ == "__main__":
    main()

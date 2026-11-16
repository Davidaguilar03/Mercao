"""Download the DANE SIPSA files into data/raw and update data/raw/manifest.csv.

Usage: python -m backend.scripts.download_raw [--only prices_weekly,prices_monthly,supply] [--delay 1.0]
"""

import argparse
import logging

from backend.app.core.config import get_settings
from backend.app.core.logging import configure_logging
from backend.app.domains.ingestion.download import DISCOVERERS, download_all


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", default=",".join(DISCOVERERS))
    parser.add_argument("--delay", type=float, default=1.0)
    args = parser.parse_args()
    settings = get_settings()
    configure_logging(settings.raw_dir / "download.log")
    counts = download_all(settings.raw_dir, [s.strip() for s in args.only.split(",") if s.strip()], args.delay)
    for (source, status), count in sorted(counts.items()):
        logging.getLogger(__name__).info("%-15s %-11s %d", source, status, count)


if __name__ == "__main__":
    main()

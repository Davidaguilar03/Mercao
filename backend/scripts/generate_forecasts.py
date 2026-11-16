"""Write the forecasts table from the saved models (run python -m backend.scripts.train_models first).

Usage: python -m backend.scripts.generate_forecasts

The table is replaced on every run. Rebuilding the database removes it, so run this command again afterwards.
"""

import logging

from backend.app.core.database import create_db_engine
from backend.app.core.logging import configure_logging
from backend.app.domains.forecasting.forecasts import write_forecasts


def main() -> None:
    configure_logging()
    forecasts = write_forecasts(create_db_engine())
    origins = forecasts.groupby(["origin_iso_year", "origin_iso_week"]).size()
    logging.getLogger(__name__).info("Wrote %d forecasts for %d pairs, model %s. Origin weeks:\n%s",
                                     len(forecasts), forecasts.groupby(["product_id", "market_id"]).ngroups,
                                     forecasts["model_version"].iloc[0], origins.to_string())


if __name__ == "__main__":
    main()

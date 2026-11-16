"""Application settings and filesystem paths.

Every path is derived from the repository root or from environment variables, never hardcoded.
"""

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseModel):
    """Runtime settings. Override the data folder with MERCAO_DATA_DIR and the database with MERCAO_DATABASE_URL."""

    data_dir: Path
    database_url: str | None = None
    supply_workers: int = 2
    prices_workers: int = 6

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def interim_dir(self) -> Path:
        return self.data_dir / "interim"

    @property
    def processed_dir(self) -> Path:
        return self.data_dir / "processed"

    @property
    def pipeline_cache_dir(self) -> Path:
        return self.interim_dir / "pipeline"

    @property
    def database_path(self) -> Path:
        return self.processed_dir / "mercao.db"

    @property
    def resolved_database_url(self) -> str:
        return self.database_url or f"sqlite:///{self.database_path.as_posix()}"

    @property
    def catalog_dir(self) -> Path:
        return REPO_ROOT / "backend" / "app" / "domains" / "catalog" / "data"


@lru_cache
def get_settings() -> Settings:
    """Build the settings once from the environment."""
    return Settings(
        data_dir=Path(os.environ.get("MERCAO_DATA_DIR", REPO_ROOT / "data")),
        database_url=os.environ.get("MERCAO_DATABASE_URL"),
        supply_workers=int(os.environ.get("MERCAO_SUPPLY_WORKERS", "2")),
        prices_workers=int(os.environ.get("MERCAO_PRICES_WORKERS", "6")),
    )

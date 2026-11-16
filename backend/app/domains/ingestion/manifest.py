"""The download manifest (data/raw/manifest.csv) links every raw file to its URL and its published label."""

import csv
from pathlib import Path

from pydantic import BaseModel

MANIFEST_FIELDS = ["source", "url", "file", "label", "status"]


class ManifestEntry(BaseModel):
    """One downloaded file. `label` is the text next to the link on the DANE page (it carries the week dates)."""

    source: str
    url: str
    file: str
    label: str
    status: str = ""

    @property
    def file_name(self) -> str:
        return Path(self.file).name

    def path(self, raw_dir: Path) -> Path:
        return raw_dir / self.source / self.file_name


def load_manifest(raw_dir: Path) -> list[ManifestEntry]:
    """Read the manifest written by the download step."""
    manifest_path = raw_dir / "manifest.csv"
    if not manifest_path.exists():
        raise FileNotFoundError(f"{manifest_path} not found: run python -m backend.scripts.download_raw first")
    with open(manifest_path, newline="", encoding="utf-8") as handle:
        return [ManifestEntry(**row) for row in csv.DictReader(handle)]


def write_manifest(raw_dir: Path, entries: list[ManifestEntry]) -> None:
    """Write the manifest, one row per URL."""
    with open(raw_dir / "manifest.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS)
        writer.writeheader()
        writer.writerows(entry.model_dump() for entry in entries)

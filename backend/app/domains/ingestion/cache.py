"""Per-file parse cache: a parsed raw file is reused while the file size, modification time and parser version match."""

import json
import pickle
from pathlib import Path
from typing import Any

import pandas as pd


def file_signature(path: Path, parser_version: str) -> dict[str, Any]:
    stat = path.stat()
    return {"file": path.name, "size": stat.st_size, "mtime_ns": stat.st_mtime_ns, "parser": parser_version}


class ParseCache:
    """Stores one DataFrame plus a JSON-serializable meta dict per raw file.

    Small frames are pickled; large ones (supply) use parquet, which keeps categorical columns compact.
    """

    def __init__(self, cache_dir: Path, parser_version: str, fmt: str = "pickle") -> None:
        self.cache_dir = cache_dir
        self.parser_version = parser_version
        self.fmt = fmt

    def _paths(self, source: Path) -> tuple[Path, Path]:
        suffix = ".parquet" if self.fmt == "parquet" else ".pkl"
        return self.cache_dir / f"{source.name}{suffix}", self.cache_dir / f"{source.name}.meta.json"

    def data_path(self, source: Path) -> Path:
        return self._paths(source)[0]

    def is_fresh(self, source: Path) -> bool:
        data_path, meta_path = self._paths(source)
        if not data_path.exists() or not meta_path.exists():
            return False
        stored = json.loads(meta_path.read_text(encoding="utf-8")).get("signature")
        return stored == file_signature(source, self.parser_version)

    def load_meta(self, source: Path) -> dict[str, Any]:
        return json.loads(self._paths(source)[1].read_text(encoding="utf-8"))["meta"]

    def load_frame(self, source: Path, columns: list[str] | None = None) -> pd.DataFrame:
        data_path, _ = self._paths(source)
        if self.fmt == "parquet":
            return pd.read_parquet(data_path, columns=columns)
        with open(data_path, "rb") as handle:
            frame = pickle.load(handle)
        return frame[columns] if columns else frame

    def store(self, source: Path, frame: pd.DataFrame, meta: dict[str, Any]) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        data_path, meta_path = self._paths(source)
        tmp = data_path.with_suffix(data_path.suffix + ".tmp")
        if self.fmt == "parquet":
            frame.to_parquet(tmp, index=False)
        else:
            with open(tmp, "wb") as handle:
                pickle.dump(frame, handle, protocol=pickle.HIGHEST_PROTOCOL)
        tmp.replace(data_path)
        payload = {"signature": file_signature(source, self.parser_version), "meta": meta}
        meta_path.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")

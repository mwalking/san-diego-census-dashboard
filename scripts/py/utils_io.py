from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import requests


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_json(path: Path, default: Any | None = None) -> Any:
    if not path.exists():
        return default

    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    with path.open('w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=2)
        handle.write('\n')


def download_with_cache(url: str, destination: Path, timeout_seconds: int = 120) -> Path:
    ensure_dir(destination.parent)
    if destination.exists() and destination.stat().st_size > 0:
        return destination

    response = requests.get(url, timeout=timeout_seconds)
    response.raise_for_status()

    destination.write_bytes(response.content)
    return destination

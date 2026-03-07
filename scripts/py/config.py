from __future__ import annotations

import json
from pathlib import Path

project_root = Path(__file__).resolve().parents[2]
data_dir = project_root / 'public' / 'data'
tracts_dir = data_dir / 'tracts'
cache_dir = project_root / 'scripts' / 'py' / '.cache'

state_fips = '06'
counties = ['06073']
years = [2023]

tract_simplify_tolerance = 0.0003

region_default_view = {
    'longitude': -117.1611,
    'latitude': 32.7157,
    'zoom': 9.5,
    'pitch': 0,
    'bearing': 0,
}


def _load_h3_resolution(default: int = 8) -> int:
    metadata_path = data_dir / 'metadata.json'
    if not metadata_path.exists():
        return default

    try:
        with metadata_path.open('r', encoding='utf-8') as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return default

    value = payload.get('h3_resolution', default)
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    return parsed


h3_resolution = _load_h3_resolution()

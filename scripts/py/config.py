from __future__ import annotations

import json
from pathlib import Path

project_root = Path(__file__).resolve().parents[2]
data_dir = project_root / 'public' / 'data'
tracts_dir = data_dir / 'tracts'
cache_dir = project_root / 'scripts' / 'py' / '.cache'
pipeline_config_dir = project_root / 'scripts' / 'py' / 'config'
census_variables_path = pipeline_config_dir / 'census_variables.json'
census_recodes_path = pipeline_config_dir / 'census_recodes.json'

state_fips = '06'
counties = ['06073']
years = [2023]
default_h3_resolution = 8
acs_batch_size = 45
acs_request_timeout_seconds = 120
acs_source_moe_level = 90
acs_moe_level = 95

tract_simplify_tolerance = 0.0003
tract_water_erase_area_threshold = 0.75

region_default_view = {
    'longitude': -117.1611,
    'latitude': 32.7157,
    'zoom': 9.5,
    'pitch': 0,
    'bearing': 0,
}


def _load_h3_resolution(default: int = default_h3_resolution) -> int:
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

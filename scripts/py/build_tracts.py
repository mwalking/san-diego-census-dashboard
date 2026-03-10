from __future__ import annotations

import math
import re
from typing import Any

import numpy as np
import pandas as pd

from config import (
    acs_batch_size,
    acs_moe_level,
    acs_request_timeout_seconds,
    acs_source_moe_level,
    cache_dir,
    census_recodes_path,
    census_variables_path,
    counties,
    data_dir,
    h3_resolution,
    project_root,
    region_default_view,
    state_fips,
    tract_simplify_tolerance,
    tract_water_erase_area_threshold,
    tracts_dir,
    years,
)
from utils_acs import (
    ACS_DETAILED_SURVEY_PATH,
    ACS_SUBJECT_SURVEY_PATH,
    fetch_county_reference_values,
    fetch_tract_acs,
)
from utils_geo import (
    WATER_TRACTCE_MAX,
    WATER_TRACTCE_MIN,
    load_tract_geometry,
    tracts_to_feature_collection,
)
from utils_io import ensure_dir, read_json, write_json
from utils_recode import (
    collapse_census_data,
    flatten_public_field_names,
    load_census_recodes,
    load_census_variable_map,
    normalize_public_output_columns,
    scale_moe_columns,
)

GEOID_RE = re.compile(r'^\d{11}$')
QUANTILE_PROBS = (0.1, 0.3, 0.5, 0.7, 0.9)

LEGACY_FRONTEND_VARIABLE_MAP = {
    'B25077_001E': 'home_value_median_e',
    'B25077_001M': 'home_value_median_m',
}
LEGACY_FRONTEND_RECODE_MAP: dict[str, str | list[str]] = {
    'home_value_median_e': 'home_value_median_e',
    'home_value_median_m': 'home_value_median_m',
}
FRONTEND_ALIAS_MAP = {
    'poverty_below': 'poverty_below_poverty_level',
    'poverty_below_moe': 'poverty_below_poverty_level_moe',
    'poverty_universe': 'poverty_total_pop_base',
    'poverty_universe_moe': 'poverty_total_pop_base_moe',
}
FRONTEND_REQUIRED_KEYS = [
    'home_value_median',
    'home_value_median_moe',
    'poverty_below',
    'poverty_below_moe',
    'poverty_universe',
    'poverty_universe_moe',
]

CATALOG_GROUP_PREFIXES = [
    ('Age', ('age_',)),
    ('Race / ethnicity', ('race_',)),
    ('Transportation', ('transport_',)),
    ('Disability', ('disability_',)),
    ('Poverty', ('poverty_',)),
    ('Internet', ('internet_',)),
    ('Education', ('edu_',)),
    ('Household income bands', ('hh_income_',)),
    ('Language', ('lang_',)),
    ('Commute', ('commute_',)),
    ('Housing year built', ('housing_year_built_',)),
    ('Housing occupancy / tenure', ('housing_occupancy_', 'housing_tenure_')),
    ('Housing structure', ('housing_units_structure_',)),
    ('Vehicle availability by tenure', ('tenure_vehicles_',)),
    ('Rent burden', ('rent_burden_',)),
    ('Home value bands', ('home_value_',)),
]


def _to_number_or_none(value: Any) -> float | int | None:
    if value is None:
        return None

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(numeric):
        return None

    if numeric.is_integer():
        return int(numeric)
    return numeric


def _quantiles(values: list[float]) -> list[float | int]:
    finite_values = [float(value) for value in values if value is not None and math.isfinite(float(value))]
    if not finite_values:
        return []

    value_array = np.array(finite_values, dtype='float64')
    try:
        quantiles = np.quantile(value_array, QUANTILE_PROBS, method='linear')
    except TypeError:
        quantiles = np.quantile(value_array, QUANTILE_PROBS, interpolation='linear')

    normalized: list[float | int] = []
    for value in quantiles:
        as_number = _to_number_or_none(value)
        if isinstance(as_number, float):
            rounded = round(as_number, 6)
            if float(rounded).is_integer():
                normalized.append(int(rounded))
            else:
                normalized.append(rounded)
        elif isinstance(as_number, int):
            normalized.append(as_number)
    return normalized


def _merge_mappings(
    base: dict[str, Any],
    overlay: dict[str, Any],
    mapping_name: str,
) -> dict[str, Any]:
    merged = dict(base)
    for key, value in overlay.items():
        if key in merged and merged[key] != value:
            raise RuntimeError(
                f'Conflicting {mapping_name} entry for {key!r}: {merged[key]!r} vs {value!r}'
            )
        merged[key] = value
    return merged


def _validate_recode_sources_exist(
    fetched_df: pd.DataFrame,
    recode_map: dict[str, str | list[str]],
) -> None:
    missing_by_output: dict[str, list[str]] = {}
    for output_name, source_spec in recode_map.items():
        if isinstance(source_spec, str):
            sources = [source_spec]
        else:
            sources = list(source_spec)

        missing_sources = [source for source in sources if source not in fetched_df.columns]
        if missing_sources:
            missing_by_output[output_name] = missing_sources

    if missing_by_output:
        details = [f'{key}: {", ".join(values)}' for key, values in sorted(missing_by_output.items())]
        raise RuntimeError('Missing recode source columns after fetch: ' + '; '.join(details))


def _apply_frontend_aliases(public_df: pd.DataFrame) -> pd.DataFrame:
    output = public_df.copy()
    for target_key, source_key in FRONTEND_ALIAS_MAP.items():
        if target_key in output.columns:
            continue
        if source_key not in output.columns:
            raise RuntimeError(
                f'Cannot build frontend compatibility key {target_key!r}; missing source field {source_key!r}.'
            )
        output[target_key] = output[source_key]

    for required_key in FRONTEND_REQUIRED_KEYS:
        if required_key not in output.columns:
            raise RuntimeError(f'Missing required frontend key after recode normalization: {required_key}')

    return output


def _build_tract_year_payload(
    tract_df: pd.DataFrame,
) -> tuple[dict[str, dict[str, float | int | None]], list[str]]:
    value_columns = [column for column in tract_df.columns if column != 'GEOID']
    payload: dict[str, dict[str, float | int | None]] = {}

    for row in tract_df.to_dict(orient='records'):
        geoid = str(row.get('GEOID', '')).strip()
        if not geoid:
            continue
        payload[geoid] = {
            column: _to_number_or_none(row.get(column))
            for column in value_columns
        }

    return payload, value_columns


def _compute_tract_quantiles(
    tract_values: dict[str, dict[str, float | int | None]],
) -> dict[str, list[float | int]]:
    home_value_values: list[float] = []
    poverty_rate_values: list[float] = []

    for record in tract_values.values():
        home_value = record.get('home_value_median')
        if home_value is not None:
            try:
                home_numeric = float(home_value)
                if math.isfinite(home_numeric):
                    home_value_values.append(home_numeric)
            except (TypeError, ValueError):
                pass

        poverty_below = record.get('poverty_below')
        poverty_universe = record.get('poverty_universe')
        try:
            below_numeric = float(poverty_below)
            universe_numeric = float(poverty_universe)
        except (TypeError, ValueError):
            continue

        if not math.isfinite(below_numeric) or not math.isfinite(universe_numeric):
            continue
        if universe_numeric <= 0:
            continue

        poverty_rate_values.append(below_numeric / universe_numeric)

    return {
        'home_value_median': _quantiles(home_value_values),
        'poverty_rate': _quantiles(poverty_rate_values),
    }


def _compute_tract_quantiles_by_year(
    tract_values_by_year: dict[int, dict[str, dict[str, float | int | None]]],
) -> dict[str, dict[str, list[float | int]]]:
    quantiles_by_year: dict[str, dict[str, list[float | int]]] = {}
    for year_value in sorted(tract_values_by_year.keys()):
        quantiles_by_year[str(year_value)] = _compute_tract_quantiles(tract_values_by_year[year_value])
    return quantiles_by_year


def _normalize_year_quantiles(
    payload: object,
    default_year: int,
) -> dict[str, dict[str, list[float | int]]]:
    if not isinstance(payload, dict):
        return {}

    year_like_entries: dict[str, dict[str, list[float | int]]] = {}
    for key, value in payload.items():
        if str(key).isdigit() and isinstance(value, dict):
            year_like_entries[str(key)] = value

    if year_like_entries:
        return year_like_entries

    metric_like_entries = {
        str(key): value
        for key, value in payload.items()
        if isinstance(value, (list, tuple))
    }
    if metric_like_entries:
        return {str(default_year): metric_like_entries}

    return {}


def _slugify(value: str) -> str:
    return value.lower().replace('/', ' ').replace('+', ' plus ').replace('-', ' ').replace('  ', ' ').strip().replace(' ', '_')


def _humanize_field_name(field_name: str) -> str:
    tokens = field_name.split('_')
    normalized_tokens: list[str] = []
    for token in tokens:
        if token in {'hh'}:
            normalized_tokens.append(token.upper())
        elif token in {'moe'}:
            normalized_tokens.append('MOE')
        elif token.isupper() and any(char.isalpha() for char in token):
            normalized_tokens.append(token)
        else:
            normalized_tokens.append(token.capitalize())
    return ' '.join(normalized_tokens)


def _resolve_catalog_group(field_name: str) -> str | None:
    for group_label, prefixes in CATALOG_GROUP_PREFIXES:
        if any(field_name.startswith(prefix) for prefix in prefixes):
            return group_label
    return None


def _build_catalog_groups(public_field_names: list[str]) -> list[dict[str, object]]:
    field_set = set(public_field_names)
    estimate_fields = sorted(field for field in field_set if field != 'GEOID' and not field.endswith('_moe'))
    groups: dict[str, dict[str, object]] = {
        group_label: {
            'id': _slugify(group_label),
            'label': group_label,
            'metrics': [],
        }
        for group_label, _ in CATALOG_GROUP_PREFIXES
    }

    for field_name in estimate_fields:
        group_label = _resolve_catalog_group(field_name)
        if group_label is None:
            continue

        format_hint = 'number'
        aggregation_hint = 'sum'
        if field_name == 'home_value_median':
            format_hint = 'currency'
            aggregation_hint = 'median'

        metric_entry: dict[str, object] = {
            'id': field_name,
            'label': _humanize_field_name(field_name),
            'group': group_label,
            'type': 'direct',
            'format': format_hint,
            'source_field': field_name,
            'aggregation': aggregation_hint,
            'enabledInSidebar': False,
        }

        moe_key = f'{field_name}_moe'
        if moe_key in field_set:
            metric_entry['moeKey'] = moe_key

        groups[group_label]['metrics'].append(metric_entry)

    return [group for group in groups.values() if group['metrics']]


def _build_variables_payload(public_field_names: list[str]) -> dict[str, object]:
    return {
        'metrics': [
            {
                'id': 'home_value_median',
                'label': 'Median home value',
                'group': 'Income & Property',
                'format': 'currency',
                'type': 'direct',
                'source_field': 'home_value_median',
                'moeKey': 'home_value_median_moe',
                'aggregation': 'median',
                'description': 'ACS 5-year median home value (owner-occupied units).',
                'provenance': {
                    'dataset': 'ACS 5-year',
                    'table': 'B25077',
                    'variable': 'B25077_001',
                    'moe_level': acs_moe_level,
                },
            },
            {
                'id': 'poverty_rate',
                'label': 'Poverty rate',
                'group': 'Income & Property',
                'format': 'percent',
                'type': 'ratio',
                'numerator': 'poverty_below',
                'denominator': 'poverty_universe',
                'numeratorMoeKey': 'poverty_below_moe',
                'denominatorMoeKey': 'poverty_universe_moe',
                'moeMethod': 'proportion',
                'aggregation': 'ratio',
                'description': 'ACS 5-year poverty rate computed as poverty_below / poverty_universe.',
                'provenance': {
                    'dataset': 'ACS 5-year',
                    'table': 'B17001',
                    'numerator': 'B17001_002',
                    'denominator': 'B17001_001',
                    'moe_level': acs_moe_level,
                },
            },
        ],
        'catalog': {
            'groups': _build_catalog_groups(public_field_names),
        },
    }


def _build_metadata(
    existing_metadata: dict[str, object],
    tract_quantiles_by_year: dict[str, dict[str, list[float | int]]],
    yearly_averages: dict[str, dict[str, float | int | None]],
    tract_year: int,
    tiger_source: dict[str, object],
) -> dict[str, object]:
    existing_quantiles = existing_metadata.get('quantiles', {}) if isinstance(existing_metadata, dict) else {}
    existing_averages = existing_metadata.get('averages', {}) if isinstance(existing_metadata, dict) else {}

    raw_hex_quantiles = existing_quantiles.get('hex', {}) if isinstance(existing_quantiles, dict) else {}
    hex_quantiles = _normalize_year_quantiles(raw_hex_quantiles, default_year=tract_year)
    hex_averages = existing_averages.get('hex', {}) if isinstance(existing_averages, dict) else {}

    tract_averages = {year_key: values for year_key, values in yearly_averages.items()}
    averages_payload: dict[str, object] = {
        **yearly_averages,
        'hex': hex_averages,
        'tract': tract_averages,
    }

    variable_map_rel = str(census_variables_path.relative_to(project_root))
    recode_map_rel = str(census_recodes_path.relative_to(project_root))
    return {
        'years': years,
        'h3_resolution': h3_resolution,
        'region': {
            'name': 'San Diego County, CA',
            'state': state_fips,
            'counties': counties,
            'defaultView': region_default_view,
        },
        'quantiles': {
            'hex': hex_quantiles,
            'tract': tract_quantiles_by_year,
        },
        'averages': averages_payload,
        'sources': {
            'tract_geometry': tiger_source,
            'acs_survey': 'acs5',
            'acs_source_moe_level': acs_source_moe_level,
            'acs_moe_level': acs_moe_level,
            'quantile_year': tract_year,
            'quantile_years': sorted(str(year_value) for year_value in years),
            'acs_variable_map': variable_map_rel,
            'acs_recode_map': recode_map_rel,
            'acs_fetch_strategy': {
                'detailed_endpoint': ACS_DETAILED_SURVEY_PATH,
                'subject_endpoint': ACS_SUBJECT_SURVEY_PATH,
                'batch_size': acs_batch_size,
                'grouping': 'product + table_prefix',
            },
        },
    }


def _is_water_tract_code(value: Any) -> bool:
    numeric = _to_number_or_none(value)
    if numeric is None:
        return False
    return WATER_TRACTCE_MIN <= int(numeric) <= WATER_TRACTCE_MAX


def _validate_recode_outputs(
    fetched_df: pd.DataFrame,
    recoded_df: pd.DataFrame,
    public_df: pd.DataFrame,
    recode_map: dict[str, str | list[str]],
) -> None:
    if 'GEOID' not in fetched_df.columns:
        raise AssertionError('Fetched ACS frame is missing GEOID.')
    if 'GEOID' not in recoded_df.columns:
        raise AssertionError('Recoded ACS frame is missing GEOID.')
    if 'GEOID' not in public_df.columns:
        raise AssertionError('Public ACS frame is missing GEOID.')

    _validate_recode_sources_exist(fetched_df, recode_map)

    recode_columns = [column for column in recoded_df.columns if column != 'GEOID']
    if not recode_columns:
        raise AssertionError('Recoded ACS frame has no recoded value columns.')

    non_null_cells = int(recoded_df[recode_columns].notna().sum().sum())
    if non_null_cells <= 0:
        raise AssertionError('Recoded ACS frame contains no non-null output values.')


def _validate_outputs(
    tract_geometry_gdf,
    tracts_geojson: dict[str, object],
    tract_values_by_year: dict[int, dict[str, dict[str, float | int | None]]],
    required_value_keys: list[str],
) -> None:
    if tract_geometry_gdf.empty:
        raise AssertionError('Tract geometry GeoDataFrame is empty after cleanup.')

    if tract_geometry_gdf['geometry'].isna().any() or tract_geometry_gdf.geometry.is_empty.any():
        raise AssertionError('Tract geometry contains empty geometries after cleanup.')

    if tract_geometry_gdf['GEOID'].isna().any():
        raise AssertionError('Tract geometry contains missing GEOIDs after cleanup.')

    if tract_geometry_gdf['GEOID'].duplicated().any():
        raise AssertionError('Tract geometry contains duplicate GEOIDs after cleanup.')

    if (tract_geometry_gdf['ALAND'] <= 0).any():
        raise AssertionError('Tract geometry contains ALAND <= 0 after cleanup.')

    if tract_geometry_gdf['TRACTCE'].map(_is_water_tract_code).any():
        raise AssertionError('Tract geometry still contains special water-only tract codes.')

    features = tracts_geojson.get('features') if isinstance(tracts_geojson, dict) else None
    if not isinstance(features, list) or not features:
        raise AssertionError('tracts.geojson must contain at least one feature.')

    geometry_geoids = set(tract_geometry_gdf['GEOID'].astype(str).tolist())
    geojson_geoids: set[str] = set()
    for feature in features:
        properties = feature.get('properties', {}) if isinstance(feature, dict) else {}
        geoid = str(properties.get('GEOID', ''))
        if GEOID_RE.match(geoid) is None:
            raise AssertionError(f'Invalid GEOID in tracts.geojson: {geoid!r}')
        geojson_geoids.add(geoid)

    if geojson_geoids != geometry_geoids:
        raise AssertionError('tracts.geojson GEOIDs do not match cleaned tract geometry GEOIDs.')

    if not tract_values_by_year:
        raise AssertionError('No tract year values were generated.')

    for year_value, tract_values in tract_values_by_year.items():
        if not tract_values:
            raise AssertionError(f'Tract values for year {year_value} are empty.')

        for geoid, record in tract_values.items():
            if GEOID_RE.match(str(geoid)) is None:
                raise AssertionError(f'Invalid GEOID in tract values for {year_value}: {geoid!r}')

            if geoid not in geometry_geoids:
                raise AssertionError(
                    f'GEOID {geoid} in tracts/{year_value}.json not found in tracts.geojson.'
                )

            missing_keys = [key for key in required_value_keys if key not in record]
            if missing_keys:
                raise AssertionError(f'Missing keys for GEOID {geoid}: {missing_keys}')

        value_geoids = set(tract_values.keys())
        if value_geoids != geometry_geoids:
            raise AssertionError(
                f'tracts/{year_value}.json GEOIDs do not match cleaned tract geometry GEOIDs.'
            )

        non_empty_records = [
            record
            for record in tract_values.values()
            if any(value is not None for value in record.values())
        ]
        if not non_empty_records:
            raise AssertionError(f'tracts/{year_value}.json contains only empty records.')


def main() -> None:
    ensure_dir(tracts_dir)
    ensure_dir(cache_dir)

    print('Loading ACS variable map and recodes...')
    uploaded_variable_map = load_census_variable_map(census_variables_path)
    uploaded_recode_map = load_census_recodes(census_recodes_path)
    variable_map = _merge_mappings(
        uploaded_variable_map,
        LEGACY_FRONTEND_VARIABLE_MAP,
        mapping_name='variable_map',
    )
    recode_map = _merge_mappings(
        uploaded_recode_map,
        LEGACY_FRONTEND_RECODE_MAP,
        mapping_name='recode_map',
    )

    print('Building tract geometry...')
    tract_geometry_gdf, tiger_source = load_tract_geometry(
        year=max(years),
        state_fips=state_fips,
        counties=counties,
        cache_dir=cache_dir,
        simplify_tolerance=tract_simplify_tolerance,
        water_area_threshold=tract_water_erase_area_threshold,
    )
    tracts_geojson = tracts_to_feature_collection(tract_geometry_gdf)
    write_json(tracts_dir / 'tracts.geojson', tracts_geojson)
    geometry_geoids = set(tract_geometry_gdf['GEOID'].astype(str).tolist())

    tract_values_by_year: dict[int, dict[str, dict[str, float | int | None]]] = {}
    yearly_averages: dict[str, dict[str, float | int | None]] = {}
    required_value_keys: list[str] = []

    for year_value in years:
        print(f'Fetching ACS tract values for {year_value} (batched by endpoint/table)...')
        fetched_df = fetch_tract_acs(
            year=year_value,
            state_fips=state_fips,
            counties=counties,
            variable_map=variable_map,
            batch_size=acs_batch_size,
            timeout_seconds=acs_request_timeout_seconds,
        )

        print(f'Applying recodes for {year_value}...')
        recoded_df = collapse_census_data(fetched_df, recode_map)
        recoded_df = scale_moe_columns(
            recoded_df,
            source_confidence_level=acs_source_moe_level,
            target_confidence_level=acs_moe_level,
        )
        public_df = normalize_public_output_columns(recoded_df)
        public_df = _apply_frontend_aliases(public_df)
        _validate_recode_outputs(fetched_df, recoded_df, public_df, recode_map)

        public_df = public_df[public_df['GEOID'].astype(str).isin(geometry_geoids)].copy()
        public_df = public_df.sort_values('GEOID').reset_index(drop=True)
        tract_payload, value_columns = _build_tract_year_payload(public_df)
        required_value_keys = sorted(set(value_columns))

        tract_values_by_year[year_value] = tract_payload
        write_json(tracts_dir / f'{year_value}.json', tract_payload)

        print(f'Fetching county reference values for {year_value}...')
        reference_values = fetch_county_reference_values(
            year=year_value,
            state_fips=state_fips,
            counties=counties,
            timeout_seconds=acs_request_timeout_seconds,
        )
        yearly_averages[str(year_value)] = {
            'home_value_median': _to_number_or_none(reference_values.get('home_value_median')),
            'poverty_rate': _to_number_or_none(reference_values.get('poverty_rate')),
        }

    latest_year = max(years)
    tract_quantiles_by_year = _compute_tract_quantiles_by_year(tract_values_by_year)

    print('Writing years, variables, and metadata...')
    write_json(data_dir / 'years.json', years)

    public_field_names = flatten_public_field_names(recode_map) + list(FRONTEND_ALIAS_MAP.keys())
    write_json(data_dir / 'variables.json', _build_variables_payload(public_field_names))

    existing_metadata = read_json(data_dir / 'metadata.json', default={})
    metadata_payload = _build_metadata(
        existing_metadata=existing_metadata if isinstance(existing_metadata, dict) else {},
        tract_quantiles_by_year=tract_quantiles_by_year,
        yearly_averages=yearly_averages,
        tract_year=latest_year,
        tiger_source=tiger_source,
    )
    write_json(data_dir / 'metadata.json', metadata_payload)

    required_keys_for_validation = sorted(set(required_value_keys + FRONTEND_REQUIRED_KEYS))
    _validate_outputs(
        tract_geometry_gdf=tract_geometry_gdf,
        tracts_geojson=tracts_geojson,
        tract_values_by_year=tract_values_by_year,
        required_value_keys=required_keys_for_validation,
    )
    print('Tract pipeline build complete.')


if __name__ == '__main__':
    main()

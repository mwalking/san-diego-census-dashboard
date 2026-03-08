from __future__ import annotations

import math
import re
from typing import Any

import numpy as np

from config import (
    cache_dir,
    counties,
    data_dir,
    h3_resolution,
    region_default_view,
    state_fips,
    tract_simplify_tolerance,
    tract_water_erase_area_threshold,
    tracts_dir,
    years,
)
from utils_acs import REQUIRED_VALUE_KEYS, fetch_county_reference_values, fetch_tract_acs
from utils_geo import (
    WATER_TRACTCE_MAX,
    WATER_TRACTCE_MIN,
    load_tract_geometry,
    tracts_to_feature_collection,
)
from utils_io import ensure_dir, read_json, write_json

GEOID_RE = re.compile(r'^\d{11}$')
QUANTILE_PROBS = (0.1, 0.3, 0.5, 0.7, 0.9)


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


def _build_tract_year_payload(tract_df) -> dict[str, dict[str, float | int | None]]:
    payload: dict[str, dict[str, float | int | None]] = {}

    for row in tract_df.itertuples(index=False):
        geoid = str(row.GEOID)

        payload[geoid] = {
            'home_value_median': _to_number_or_none(row.home_value_median),
            'home_value_median_moe': _to_number_or_none(row.home_value_median_moe),
            'poverty_below': _to_number_or_none(row.poverty_below),
            'poverty_below_moe': _to_number_or_none(row.poverty_below_moe),
            'poverty_universe': _to_number_or_none(row.poverty_universe),
            'poverty_universe_moe': _to_number_or_none(row.poverty_universe_moe),
        }

    return payload


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


def _build_variables_payload() -> dict[str, object]:
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
                    'moe_level': 90,
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
                'description': 'ACS 5-year poverty rate computed as B17001_002 / B17001_001.',
                'provenance': {
                    'dataset': 'ACS 5-year',
                    'table': 'B17001',
                    'numerator': 'B17001_002',
                    'denominator': 'B17001_001',
                    'moe_level': 90,
                },
            },
        ]
    }


def _build_metadata(
    existing_metadata: dict[str, object],
    tract_quantiles: dict[str, list[float]],
    yearly_averages: dict[str, dict[str, float | int | None]],
    tract_year: int,
    tiger_source: dict[str, object],
) -> dict[str, object]:
    existing_quantiles = existing_metadata.get('quantiles', {}) if isinstance(existing_metadata, dict) else {}
    existing_averages = existing_metadata.get('averages', {}) if isinstance(existing_metadata, dict) else {}

    hex_quantiles = existing_quantiles.get('hex', {}) if isinstance(existing_quantiles, dict) else {}
    hex_averages = existing_averages.get('hex', {}) if isinstance(existing_averages, dict) else {}

    tract_averages = {year_key: values for year_key, values in yearly_averages.items()}

    averages_payload: dict[str, object] = {
        **yearly_averages,
        'hex': hex_averages,
        'tract': tract_averages,
    }

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
            'tract': tract_quantiles,
        },
        'averages': averages_payload,
        'sources': {
            'tract_geometry': tiger_source,
            'acs_survey': 'acs5',
            'acs_moe_level': 90,
            'quantile_year': tract_year,
        },
    }


def _is_water_tract_code(value: Any) -> bool:
    numeric = _to_number_or_none(value)
    if numeric is None:
        return False
    return WATER_TRACTCE_MIN <= int(numeric) <= WATER_TRACTCE_MAX


def _validate_outputs(
    tract_geometry_gdf,
    tracts_geojson: dict[str, object],
    tract_values_by_year: dict[int, dict[str, dict[str, float | int | None]]],
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

            missing_keys = [key for key in REQUIRED_VALUE_KEYS if key not in record]
            if missing_keys:
                raise AssertionError(f'Missing keys for GEOID {geoid}: {missing_keys}')

        value_geoids = set(tract_values.keys())
        if value_geoids != geometry_geoids:
            raise AssertionError(
                f'tracts/{year_value}.json GEOIDs do not match cleaned tract geometry GEOIDs.'
            )


def main() -> None:
    ensure_dir(tracts_dir)
    ensure_dir(cache_dir)

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

    for year_value in years:
        print(f'Fetching ACS tract values for {year_value}...')
        tract_df = fetch_tract_acs(
            year=year_value,
            state_fips=state_fips,
            counties=counties,
            moe_level=90,
        )
        tract_df = tract_df[tract_df['GEOID'].astype(str).isin(geometry_geoids)].copy()
        tract_payload = _build_tract_year_payload(tract_df)
        tract_values_by_year[year_value] = tract_payload
        write_json(tracts_dir / f'{year_value}.json', tract_payload)

        print(f'Fetching county reference values for {year_value}...')
        reference_values = fetch_county_reference_values(
            year=year_value,
            state_fips=state_fips,
            counties=counties,
            moe_level=90,
        )

        yearly_averages[str(year_value)] = {
            'home_value_median': _to_number_or_none(reference_values.get('home_value_median')),
            'poverty_rate': _to_number_or_none(reference_values.get('poverty_rate')),
        }

    latest_year = max(years)
    tract_quantiles = _compute_tract_quantiles(tract_values_by_year[latest_year])

    print('Writing years, variables, and metadata...')
    write_json(data_dir / 'years.json', years)
    write_json(data_dir / 'variables.json', _build_variables_payload())

    existing_metadata = read_json(data_dir / 'metadata.json', default={})
    metadata_payload = _build_metadata(
        existing_metadata=existing_metadata if isinstance(existing_metadata, dict) else {},
        tract_quantiles=tract_quantiles,
        yearly_averages=yearly_averages,
        tract_year=latest_year,
        tiger_source=tiger_source,
    )
    write_json(data_dir / 'metadata.json', metadata_payload)

    _validate_outputs(tract_geometry_gdf, tracts_geojson, tract_values_by_year)
    print('Tract pipeline build complete.')


if __name__ == '__main__':
    main()

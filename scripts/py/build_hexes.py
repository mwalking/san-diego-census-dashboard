from __future__ import annotations

import math
import re
from typing import Any

import geopandas as gpd
import h3
import numpy as np
import pandas as pd
from shapely import Polygon, make_valid

from config import (
    acs_batch_size,
    acs_request_timeout_seconds,
    cache_dir,
    counties,
    data_dir,
    h3_resolution,
    state_fips,
    tract_simplify_tolerance,
    tract_water_erase_area_threshold,
    years,
)
from utils_acs import fetch_block_group_acs
from utils_geo import load_block_group_geometry
from utils_io import ensure_dir, read_json, write_json

COUNT_FIELD_PAIRS = (
    ('poverty_below', 'poverty_below_moe'),
    ('poverty_universe', 'poverty_universe_moe'),
)
MEDIAN_FIELD = 'home_value_median'
MEDIAN_MOE_FIELD = 'home_value_median_moe'
HEX_REQUIRED_KEYS = [
    'h3',
    'poverty_below',
    'poverty_below_moe',
    'poverty_universe',
    'poverty_universe_moe',
    MEDIAN_FIELD,
    MEDIAN_MOE_FIELD,
]
BLOCK_GROUP_VALUE_MAP = {
    'C17002_001E': 'poverty_universe_raw',
    'C17002_001M': 'poverty_universe_raw_moe',
    'C17002_002E': 'poverty_below_under_50_raw',
    'C17002_002M': 'poverty_below_under_50_raw_moe',
    'C17002_003E': 'poverty_below_50_to_99_raw',
    'C17002_003M': 'poverty_below_50_to_99_raw_moe',
    'B25077_001E': MEDIAN_FIELD,
    'B25077_001M': MEDIAN_MOE_FIELD,
}
BLOCK_GROUP_FETCH_COLUMNS = [
    'poverty_universe_raw',
    'poverty_universe_raw_moe',
    'poverty_below_under_50_raw',
    'poverty_below_under_50_raw_moe',
    'poverty_below_50_to_99_raw',
    'poverty_below_50_to_99_raw_moe',
    MEDIAN_FIELD,
    MEDIAN_MOE_FIELD,
]
BLOCK_GROUP_VALUE_COLUMNS = [
    'poverty_below',
    'poverty_below_moe',
    'poverty_universe',
    'poverty_universe_moe',
    MEDIAN_FIELD,
    MEDIAN_MOE_FIELD,
]
QUANTILE_PROBS = (0.1, 0.3, 0.5, 0.7, 0.9)
GEOID_RE = re.compile(r'^\d{11,12}$')
EQUAL_AREA_CRS = 'EPSG:3310'
PARITY_REL_TOLERANCE = 0.03
POVERTY_RATIO_TOLERANCE = 1.02


def _to_float_or_none(value: Any) -> float | None:
    if value is None:
        return None

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(numeric):
        return None

    return numeric


def _to_number_or_none(value: Any, decimals: int = 6) -> float | int | None:
    numeric = _to_float_or_none(value)
    if numeric is None:
        return None

    rounded = round(numeric, decimals)
    if float(rounded).is_integer():
        return int(rounded)
    return rounded


def _to_nonnegative_number_or_none(value: Any, decimals: int = 6) -> float | int | None:
    numeric = _to_number_or_none(value, decimals=decimals)
    if numeric is None:
        return None
    if float(numeric) < 0:
        return None
    return numeric


def _normalize_geoid(value: Any) -> str | None:
    if value is None:
        return None

    geoid = str(value).strip().replace('.0', '')
    if GEOID_RE.match(geoid) is None:
        return None
    return geoid


def _quantiles(values: list[float]) -> list[float | int]:
    finite_values = [float(value) for value in values if _to_float_or_none(value) is not None]
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
        if as_number is not None:
            normalized.append(as_number)
    return normalized


def _fetch_block_group_year_values(year_value: int) -> pd.DataFrame:
    payload = fetch_block_group_acs(
        year=year_value,
        state_fips=state_fips,
        counties=counties,
        variable_map=BLOCK_GROUP_VALUE_MAP,
        batch_size=acs_batch_size,
        timeout_seconds=acs_request_timeout_seconds,
    )
    if payload.empty:
        raise RuntimeError(f'Block-group ACS fetch returned no rows for year {year_value}.')

    required_columns = ['GEOID', *BLOCK_GROUP_FETCH_COLUMNS]
    missing_columns = [column for column in required_columns if column not in payload.columns]
    if missing_columns:
        raise RuntimeError(
            f'Block-group ACS fetch missing required columns for year {year_value}: {missing_columns}'
        )

    values = payload[required_columns].copy()
    values['GEOID'] = values['GEOID'].map(_normalize_geoid)
    values = values[values['GEOID'].notna()].copy()

    for column in BLOCK_GROUP_FETCH_COLUMNS:
        values[column] = values[column].map(_to_number_or_none)

    values['poverty_universe'] = values['poverty_universe_raw'].map(_to_nonnegative_number_or_none)
    values['poverty_universe_moe'] = values['poverty_universe_raw_moe'].map(_to_nonnegative_number_or_none)

    below_under_50 = values['poverty_below_under_50_raw'].map(_to_nonnegative_number_or_none)
    below_50_to_99 = values['poverty_below_50_to_99_raw'].map(_to_nonnegative_number_or_none)
    values['poverty_below'] = [
        _to_nonnegative_number_or_none((left or 0) + (right or 0)) if left is not None or right is not None else None
        for left, right in zip(below_under_50.tolist(), below_50_to_99.tolist(), strict=False)
    ]

    below_under_50_moe = values['poverty_below_under_50_raw_moe'].map(_to_nonnegative_number_or_none)
    below_50_to_99_moe = values['poverty_below_50_to_99_raw_moe'].map(_to_nonnegative_number_or_none)
    values['poverty_below_moe'] = [
        _to_nonnegative_number_or_none(
            math.sqrt(((left or 0) ** 2) + ((right or 0) ** 2))
        )
        if left is not None or right is not None
        else None
        for left, right in zip(
            below_under_50_moe.tolist(),
            below_50_to_99_moe.tolist(),
            strict=False,
        )
    ]

    values[MEDIAN_FIELD] = values[MEDIAN_FIELD].map(_to_nonnegative_number_or_none)
    values[MEDIAN_MOE_FIELD] = values[MEDIAN_MOE_FIELD].map(_to_nonnegative_number_or_none)

    values = values[['GEOID', *BLOCK_GROUP_VALUE_COLUMNS]].copy()

    values = values.drop_duplicates(subset=['GEOID'], keep='first')
    return values.sort_values('GEOID').reset_index(drop=True)


def _attach_block_group_values(
    block_group_geometry: gpd.GeoDataFrame,
    block_group_values: pd.DataFrame,
    year_value: int,
) -> tuple[gpd.GeoDataFrame, dict[str, float]]:
    geometry_geoids = set(block_group_geometry['GEOID'].astype(str).tolist())
    value_geoids = set(block_group_values['GEOID'].astype(str).tolist())

    value_rows_in_geometry = block_group_values[block_group_values['GEOID'].isin(geometry_geoids)].copy()
    filtered_value_geoids = set(value_rows_in_geometry['GEOID'].astype(str).tolist())

    missing_from_values = geometry_geoids - filtered_value_geoids
    if missing_from_values:
        raise RuntimeError(
            f'Block-group GEOID mismatch for year {year_value}: missing_from_values={len(missing_from_values)}'
        )

    missing_from_geometry = value_geoids - geometry_geoids
    if missing_from_geometry:
        print(
            f'Warning: dropping {len(missing_from_geometry)} block-group value rows not present in cleaned geometry '
            f'for year {year_value}.'
        )

    enriched = block_group_geometry.merge(
        value_rows_in_geometry,
        on='GEOID',
        how='left',
        validate='one_to_one',
    )

    source_totals = {
        'poverty_below': float(
            sum(
                _to_float_or_none(value) or 0.0
                for value in value_rows_in_geometry['poverty_below'].tolist()
            )
        ),
        'poverty_universe': float(
            sum(
                _to_float_or_none(value) or 0.0
                for value in value_rows_in_geometry['poverty_universe'].tolist()
            )
        ),
    }

    return enriched, source_totals


def _build_county_polygon(source_gdf: gpd.GeoDataFrame):
    dissolved = source_gdf[['geometry']].dissolve()
    if dissolved.empty:
        raise RuntimeError('Unable to dissolve source geometry into a county polygon.')

    county_polygon = make_valid(dissolved.geometry.iloc[0])
    county_polygon = make_valid(county_polygon.buffer(0))
    if county_polygon.is_empty:
        raise RuntimeError('County polygon is empty after dissolve.')
    if county_polygon.geom_type not in {'Polygon', 'MultiPolygon'}:
        raise RuntimeError(f'County boundary must be polygonal, got {county_polygon.geom_type}.')

    return county_polygon


def _build_hex_geometry(county_polygon) -> gpd.GeoDataFrame:
    hex_ids = sorted(h3.geo_to_cells(county_polygon, res=h3_resolution))
    if not hex_ids:
        raise RuntimeError('No H3 cells were generated for the county polygon.')

    records: list[dict[str, object]] = []
    for cell in hex_ids:
        boundary = h3.cell_to_boundary(cell)
        coordinates = [(float(lng), float(lat)) for lat, lng in boundary]
        polygon = make_valid(Polygon(coordinates))
        if polygon.is_empty:
            continue

        records.append({'h3': str(cell), 'geometry': polygon})

    if not records:
        raise RuntimeError('No valid H3 polygons were built from generated H3 cells.')

    return gpd.GeoDataFrame(records, geometry='geometry', crs='EPSG:4326')


def _allocate_count_fields(
    hex_gdf: gpd.GeoDataFrame,
    source_gdf: gpd.GeoDataFrame,
) -> tuple[dict[str, dict[str, float | int | None]], dict[str, str]]:
    hex_equal_area = hex_gdf.to_crs(EQUAL_AREA_CRS)
    source_equal_area = source_gdf.to_crs(EQUAL_AREA_CRS).copy()
    source_equal_area['source_area'] = source_equal_area.geometry.area

    candidates = gpd.sjoin(
        hex_equal_area[['h3', 'geometry']],
        source_equal_area[
            [
                'GEOID',
                'geometry',
                'source_area',
                'poverty_below',
                'poverty_below_moe',
                'poverty_universe',
                'poverty_universe_moe',
            ]
        ],
        how='inner',
        predicate='intersects',
    )
    if candidates.empty:
        raise RuntimeError('No intersecting source/hex candidates found.')

    accumulator: dict[str, dict[str, float]] = {}
    contribution_counts: dict[str, int] = {}
    largest_piece_by_hex: dict[str, tuple[str, float]] = {}
    for hex_id in hex_equal_area['h3'].astype(str):
        accumulator[hex_id] = {
            'poverty_below': 0.0,
            'poverty_below_moe_sq': 0.0,
            'poverty_universe': 0.0,
            'poverty_universe_moe_sq': 0.0,
        }
        contribution_counts[hex_id] = 0

    for row in candidates.itertuples():
        hex_index = int(row.Index)
        source_index = int(row.index_right)
        hex_id = str(row.h3)

        source_area = _to_float_or_none(source_equal_area['source_area'].iloc[source_index])
        if source_area is None or source_area <= 0:
            continue

        intersection_area = (
            hex_equal_area.geometry.iloc[hex_index].intersection(source_equal_area.geometry.iloc[source_index]).area
        )
        if not math.isfinite(intersection_area) or intersection_area <= 0:
            continue

        weight = intersection_area / source_area
        if not math.isfinite(weight) or weight <= 0:
            continue

        contribution_counts[hex_id] += 1
        geoid = _normalize_geoid(row.GEOID)
        if geoid is not None:
            current = largest_piece_by_hex.get(hex_id)
            if current is None or intersection_area > current[1]:
                largest_piece_by_hex[hex_id] = (geoid, intersection_area)

        for estimate_key, moe_key in COUNT_FIELD_PAIRS:
            estimate_value = _to_float_or_none(getattr(row, estimate_key))
            if estimate_value is not None:
                accumulator[hex_id][estimate_key] += estimate_value * weight

            moe_value = _to_float_or_none(getattr(row, moe_key))
            if moe_value is not None:
                piece = moe_value * weight
                accumulator[hex_id][f'{moe_key}_sq'] += piece * piece

    counts_by_hex: dict[str, dict[str, float | int | None]] = {}
    fallback_geoid_by_hex: dict[str, str] = {}
    for hex_id, bucket in accumulator.items():
        if contribution_counts[hex_id] == 0:
            counts_by_hex[hex_id] = {
                'poverty_below': None,
                'poverty_below_moe': None,
                'poverty_universe': None,
                'poverty_universe_moe': None,
            }
        else:
            counts_by_hex[hex_id] = {
                'poverty_below': _to_number_or_none(bucket['poverty_below']),
                'poverty_below_moe': _to_number_or_none(math.sqrt(bucket['poverty_below_moe_sq'])),
                'poverty_universe': _to_number_or_none(bucket['poverty_universe']),
                'poverty_universe_moe': _to_number_or_none(math.sqrt(bucket['poverty_universe_moe_sq'])),
            }

        fallback_piece = largest_piece_by_hex.get(hex_id)
        if fallback_piece is not None:
            fallback_geoid_by_hex[hex_id] = fallback_piece[0]

    return counts_by_hex, fallback_geoid_by_hex


def _assign_median_fields(
    hex_gdf: gpd.GeoDataFrame,
    source_gdf: gpd.GeoDataFrame,
    county_polygon,
    fallback_geoid_by_hex: dict[str, str],
) -> dict[str, dict[str, float | int | None]]:
    clipped = hex_gdf.geometry.intersection(county_polygon)
    points = clipped.representative_point()
    point_gdf = gpd.GeoDataFrame({'h3': hex_gdf['h3'].astype(str)}, geometry=points, crs='EPSG:4326')

    point_hits = gpd.sjoin(
        point_gdf[['h3', 'geometry']],
        source_gdf[['GEOID', 'geometry']],
        how='left',
        predicate='intersects',
    )

    geoid_by_hex: dict[str, str] = {}
    if not point_hits.empty:
        first_hits = point_hits.drop_duplicates(subset='h3', keep='first')
        for row in first_hits.itertuples(index=False):
            geoid = _normalize_geoid(getattr(row, 'GEOID', None))
            if geoid is not None:
                geoid_by_hex[str(row.h3)] = geoid

    for hex_id, geoid in fallback_geoid_by_hex.items():
        geoid_by_hex.setdefault(str(hex_id), geoid)

    source_median_by_geoid: dict[str, dict[str, float | int | None]] = {}
    for row in source_gdf.itertuples(index=False):
        geoid = _normalize_geoid(row.GEOID)
        if geoid is None:
            continue

        source_median_by_geoid[geoid] = {
            MEDIAN_FIELD: _to_number_or_none(getattr(row, MEDIAN_FIELD)),
            MEDIAN_MOE_FIELD: _to_number_or_none(getattr(row, MEDIAN_MOE_FIELD)),
        }

    output: dict[str, dict[str, float | int | None]] = {}
    for hex_id in hex_gdf['h3'].astype(str):
        source_geoid = geoid_by_hex.get(hex_id)
        source_record = source_median_by_geoid.get(source_geoid, {})
        output[hex_id] = {
            MEDIAN_FIELD: source_record.get(MEDIAN_FIELD),
            MEDIAN_MOE_FIELD: source_record.get(MEDIAN_MOE_FIELD),
        }

    return output


def _build_hex_records(
    hex_gdf: gpd.GeoDataFrame,
    counts_by_hex: dict[str, dict[str, float | int | None]],
    medians_by_hex: dict[str, dict[str, float | int | None]],
) -> list[dict[str, float | int | str | None]]:
    records: list[dict[str, float | int | str | None]] = []
    for hex_id in sorted(hex_gdf['h3'].astype(str).tolist()):
        counts = counts_by_hex.get(hex_id, {})
        medians = medians_by_hex.get(hex_id, {})
        records.append(
            {
                'h3': hex_id,
                'poverty_below': _to_number_or_none(counts.get('poverty_below')),
                'poverty_below_moe': _to_number_or_none(counts.get('poverty_below_moe')),
                'poverty_universe': _to_number_or_none(counts.get('poverty_universe')),
                'poverty_universe_moe': _to_number_or_none(counts.get('poverty_universe_moe')),
                MEDIAN_FIELD: _to_number_or_none(medians.get(MEDIAN_FIELD)),
                MEDIAN_MOE_FIELD: _to_number_or_none(medians.get(MEDIAN_MOE_FIELD)),
            }
        )
    return records


def _compute_hex_quantiles(hex_records: list[dict[str, Any]]) -> dict[str, list[float | int]]:
    home_value_values: list[float] = []
    poverty_rate_values: list[float] = []

    for record in hex_records:
        home_value = _to_float_or_none(record.get(MEDIAN_FIELD))
        if home_value is not None:
            home_value_values.append(home_value)

        poverty_below = _to_float_or_none(record.get('poverty_below'))
        poverty_universe = _to_float_or_none(record.get('poverty_universe'))
        if poverty_below is None or poverty_universe is None or poverty_universe <= 0:
            continue
        poverty_rate_values.append(poverty_below / poverty_universe)

    return {
        MEDIAN_FIELD: _quantiles(home_value_values),
        'poverty_rate': _quantiles(poverty_rate_values),
    }


def _compute_hex_quantiles_by_year(
    hex_records_by_year: dict[int, list[dict[str, Any]]],
) -> dict[str, dict[str, list[float | int]]]:
    quantiles_by_year: dict[str, dict[str, list[float | int]]] = {}
    for year_value in sorted(hex_records_by_year.keys()):
        quantiles_by_year[str(year_value)] = _compute_hex_quantiles(hex_records_by_year[year_value])
    return quantiles_by_year


def _compute_hex_year_averages(hex_records: list[dict[str, Any]]) -> dict[str, float | int | None]:
    home_value_values: list[float] = []
    poverty_below_total = 0.0
    poverty_universe_total = 0.0

    for record in hex_records:
        home_value = _to_float_or_none(record.get(MEDIAN_FIELD))
        if home_value is not None:
            home_value_values.append(home_value)

        poverty_below = _to_float_or_none(record.get('poverty_below'))
        poverty_universe = _to_float_or_none(record.get('poverty_universe'))
        if poverty_below is not None:
            poverty_below_total += poverty_below
        if poverty_universe is not None:
            poverty_universe_total += poverty_universe

    home_value_reference = None
    if home_value_values:
        home_value_reference = float(np.median(np.array(home_value_values, dtype='float64')))

    poverty_rate_reference = None
    if poverty_universe_total > 0:
        poverty_rate_reference = poverty_below_total / poverty_universe_total

    return {
        MEDIAN_FIELD: _to_number_or_none(home_value_reference),
        'poverty_rate': _to_number_or_none(poverty_rate_reference),
    }


def _update_metadata(
    hex_records_by_year: dict[int, list[dict[str, Any]]],
    block_group_source_meta: dict[str, Any],
) -> None:
    metadata_path = data_dir / 'metadata.json'
    metadata = read_json(metadata_path, default={})
    if not isinstance(metadata, dict):
        raise RuntimeError('metadata.json must contain a JSON object.')

    quantiles = metadata.get('quantiles')
    if not isinstance(quantiles, dict):
        quantiles = {}
        metadata['quantiles'] = quantiles

    quantiles['hex'] = _compute_hex_quantiles_by_year(hex_records_by_year)

    averages = metadata.get('averages')
    if not isinstance(averages, dict):
        averages = {}
        metadata['averages'] = averages

    hex_averages = averages.get('hex')
    if not isinstance(hex_averages, dict):
        hex_averages = {}
        averages['hex'] = hex_averages

    for year_value, hex_records in hex_records_by_year.items():
        hex_averages[str(year_value)] = _compute_hex_year_averages(hex_records)

    sources = metadata.get('sources')
    if not isinstance(sources, dict):
        sources = {}
        metadata['sources'] = sources

    sources['hex_interpolation'] = {
        'source_geography': 'block_group',
        'source_geometry': block_group_source_meta,
        'count_method': 'area_weighted',
        'moe_method': 'weighted_piece_rss',
        'median_method': 'representative_point_with_largest_overlap_fallback',
        'parity_relative_tolerance': PARITY_REL_TOLERANCE,
        'quantile_years': sorted(str(year_value) for year_value in hex_records_by_year.keys()),
    }

    metadata['h3_resolution'] = int(h3_resolution)
    write_json(metadata_path, metadata)


def _validate_hex_outputs(
    hex_records_by_year: dict[int, list[dict[str, Any]]],
    source_totals_by_year: dict[int, dict[str, float]],
) -> None:
    if not hex_records_by_year:
        raise AssertionError('No hex outputs were generated.')

    for year_value, records in hex_records_by_year.items():
        if not records:
            raise AssertionError(f'Hex output for year {year_value} is empty.')

        hex_poverty_below_total = 0.0
        hex_poverty_universe_total = 0.0
        for record in records:
            if not record.get('h3'):
                raise AssertionError(f'Hex output for year {year_value} has a record without h3.')

            missing_keys = [key for key in HEX_REQUIRED_KEYS if key not in record]
            if missing_keys:
                raise AssertionError(
                    f'Hex output for year {year_value} is missing keys {missing_keys} in record {record}.'
                )

            poverty_below = _to_float_or_none(record.get('poverty_below'))
            poverty_universe = _to_float_or_none(record.get('poverty_universe'))
            if poverty_below is not None:
                hex_poverty_below_total += poverty_below
            if poverty_universe is not None:
                hex_poverty_universe_total += poverty_universe

            if (
                poverty_below is not None
                and poverty_universe is not None
                and poverty_universe > 0
                and poverty_below > poverty_universe * POVERTY_RATIO_TOLERANCE
            ):
                raise AssertionError(
                    f'Hex record has implausible poverty ratio for year {year_value}: '
                    f'below={poverty_below}, universe={poverty_universe}'
                )

        if (
            hex_poverty_universe_total > 0
            and hex_poverty_below_total > hex_poverty_universe_total * POVERTY_RATIO_TOLERANCE
        ):
            raise AssertionError(
                f'Hex aggregate poverty ratio exceeds tolerance for {year_value}: '
                f'below={hex_poverty_below_total}, universe={hex_poverty_universe_total}'
            )

        source_totals = source_totals_by_year.get(int(year_value), {})
        source_poverty_below_total = _to_float_or_none(source_totals.get('poverty_below'))
        source_poverty_universe_total = _to_float_or_none(source_totals.get('poverty_universe'))

        if source_poverty_below_total is not None and source_poverty_below_total > 0:
            relative_diff = (
                abs(hex_poverty_below_total - source_poverty_below_total) / source_poverty_below_total
            )
            if relative_diff > PARITY_REL_TOLERANCE:
                raise AssertionError(
                    f'Hex/source parity check failed for poverty_below in {year_value}: '
                    f'hex={hex_poverty_below_total}, source={source_poverty_below_total}, '
                    f'relative_diff={relative_diff:.4f}'
                )

        if source_poverty_universe_total is not None and source_poverty_universe_total > 0:
            relative_diff = (
                abs(hex_poverty_universe_total - source_poverty_universe_total) / source_poverty_universe_total
            )
            if relative_diff > PARITY_REL_TOLERANCE:
                raise AssertionError(
                    f'Hex/source parity check failed for poverty_universe in {year_value}: '
                    f'hex={hex_poverty_universe_total}, source={source_poverty_universe_total}, '
                    f'relative_diff={relative_diff:.4f}'
                )


def main() -> None:
    ensure_dir(data_dir / 'hexes')

    print('Loading block-group geometry...')
    block_group_geometry, block_group_source_meta = load_block_group_geometry(
        year=max(years),
        state_fips=state_fips,
        counties=counties,
        cache_dir=cache_dir,
        simplify_tolerance=tract_simplify_tolerance,
        water_area_threshold=tract_water_erase_area_threshold,
    )
    county_polygon = _build_county_polygon(block_group_geometry)

    print(f'Generating H3 cells (resolution={h3_resolution})...')
    hex_geometry = _build_hex_geometry(county_polygon)

    hex_records_by_year: dict[int, list[dict[str, Any]]] = {}
    source_totals_by_year: dict[int, dict[str, float]] = {}
    for year_value in years:
        print(f'Fetching block-group ACS values for {year_value}...')
        block_group_values = _fetch_block_group_year_values(int(year_value))
        block_group_with_values, source_totals = _attach_block_group_values(
            block_group_geometry,
            block_group_values,
            int(year_value),
        )
        source_totals_by_year[int(year_value)] = source_totals

        print(f'Building hex values for {year_value}...')
        count_values_by_hex, fallback_geoid_by_hex = _allocate_count_fields(
            hex_geometry,
            block_group_with_values,
        )
        median_values_by_hex = _assign_median_fields(
            hex_geometry,
            block_group_with_values,
            county_polygon,
            fallback_geoid_by_hex,
        )
        hex_records = _build_hex_records(hex_geometry, count_values_by_hex, median_values_by_hex)

        write_json(data_dir / 'hexes' / f'{year_value}.json', hex_records)
        hex_records_by_year[int(year_value)] = hex_records

    _validate_hex_outputs(hex_records_by_year, source_totals_by_year)
    _update_metadata(hex_records_by_year, block_group_source_meta)
    print('Hex pipeline build complete.')


if __name__ == '__main__':
    main()

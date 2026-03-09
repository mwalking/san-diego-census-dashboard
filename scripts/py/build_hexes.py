from __future__ import annotations

import math
import re
from typing import Any

import geopandas as gpd
import h3
import numpy as np
from shapely import Polygon, make_valid

from config import data_dir, h3_resolution, tracts_dir, years
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
    'home_value_median',
    'home_value_median_moe',
]
QUANTILE_PROBS = (0.1, 0.3, 0.5, 0.7, 0.9)
GEOID_RE = re.compile(r'^\d{11}$')
EQUAL_AREA_CRS = 'EPSG:3310'


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


def _load_tract_geometry() -> gpd.GeoDataFrame:
    geometry_path = tracts_dir / 'tracts.geojson'
    if not geometry_path.exists():
        raise FileNotFoundError(f'Missing tract geometry file: {geometry_path}')

    tract_gdf = gpd.read_file(geometry_path)
    if tract_gdf.crs is None:
        tract_gdf = tract_gdf.set_crs('EPSG:4326', allow_override=True)
    else:
        tract_gdf = tract_gdf.to_crs('EPSG:4326')

    if tract_gdf.empty:
        raise RuntimeError('Tract geometry is empty.')

    tract_gdf['GEOID'] = tract_gdf['GEOID'].map(_normalize_geoid)
    tract_gdf = tract_gdf[tract_gdf['GEOID'].notna()].copy()
    tract_gdf['geometry'] = tract_gdf.geometry.map(lambda geom: make_valid(geom) if geom is not None else None)
    tract_gdf = tract_gdf[tract_gdf.geometry.notna() & ~tract_gdf.geometry.is_empty].copy()
    tract_gdf = tract_gdf[['GEOID', 'geometry']].sort_values('GEOID').reset_index(drop=True)

    if tract_gdf['GEOID'].duplicated().any():
        raise RuntimeError('Tract geometry has duplicate GEOID values.')

    return tract_gdf


def _load_tract_year_values(year_value: int) -> dict[str, dict[str, float | int | None]]:
    path = tracts_dir / f'{year_value}.json'
    payload = read_json(path, default={})
    if not isinstance(payload, dict) or not payload:
        raise RuntimeError(f'Tract values missing or invalid for year {year_value}: {path}')

    normalized: dict[str, dict[str, float | int | None]] = {}
    for geoid_raw, record_raw in payload.items():
        geoid = _normalize_geoid(geoid_raw)
        if geoid is None:
            raise RuntimeError(f'Invalid GEOID in tract values for year {year_value}: {geoid_raw!r}')
        if not isinstance(record_raw, dict):
            raise RuntimeError(f'Invalid tract record for GEOID {geoid} in year {year_value}.')

        normalized[geoid] = {
            'poverty_below': _to_number_or_none(record_raw.get('poverty_below')),
            'poverty_below_moe': _to_number_or_none(record_raw.get('poverty_below_moe')),
            'poverty_universe': _to_number_or_none(record_raw.get('poverty_universe')),
            'poverty_universe_moe': _to_number_or_none(record_raw.get('poverty_universe_moe')),
            MEDIAN_FIELD: _to_number_or_none(record_raw.get(MEDIAN_FIELD)),
            MEDIAN_MOE_FIELD: _to_number_or_none(record_raw.get(MEDIAN_MOE_FIELD)),
        }

    return normalized


def _attach_tract_values(
    tract_gdf: gpd.GeoDataFrame,
    tract_values: dict[str, dict[str, float | int | None]],
    year_value: int,
) -> gpd.GeoDataFrame:
    geometry_geoids = set(tract_gdf['GEOID'].astype(str).tolist())
    value_geoids = set(tract_values.keys())

    missing_from_values = geometry_geoids - value_geoids
    missing_from_geometry = value_geoids - geometry_geoids
    if missing_from_values or missing_from_geometry:
        raise RuntimeError(
            f'Tract GEOID mismatch for year {year_value}: '
            f'missing_from_values={len(missing_from_values)} '
            f'missing_from_geometry={len(missing_from_geometry)}'
        )

    enriched = tract_gdf.copy()
    for estimate_key, moe_key in COUNT_FIELD_PAIRS:
        enriched[estimate_key] = enriched['GEOID'].map(
            lambda geoid: _to_float_or_none(tract_values[str(geoid)].get(estimate_key))
        )
        enriched[moe_key] = enriched['GEOID'].map(
            lambda geoid: _to_float_or_none(tract_values[str(geoid)].get(moe_key))
        )

    enriched[MEDIAN_FIELD] = enriched['GEOID'].map(
        lambda geoid: _to_number_or_none(tract_values[str(geoid)].get(MEDIAN_FIELD))
    )
    enriched[MEDIAN_MOE_FIELD] = enriched['GEOID'].map(
        lambda geoid: _to_number_or_none(tract_values[str(geoid)].get(MEDIAN_MOE_FIELD))
    )

    return enriched


def _build_county_polygon(tract_gdf: gpd.GeoDataFrame):
    dissolved = tract_gdf[['geometry']].dissolve()
    if dissolved.empty:
        raise RuntimeError('Unable to dissolve tract geometry into a county polygon.')

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
    tract_gdf: gpd.GeoDataFrame,
) -> tuple[dict[str, dict[str, float | int | None]], dict[str, str]]:
    hex_equal_area = hex_gdf.to_crs(EQUAL_AREA_CRS)
    tract_equal_area = tract_gdf.to_crs(EQUAL_AREA_CRS).copy()
    tract_equal_area['tract_area'] = tract_equal_area.geometry.area

    candidates = gpd.sjoin(
        hex_equal_area[['h3', 'geometry']],
        tract_equal_area[
            [
                'GEOID',
                'geometry',
                'tract_area',
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
        raise RuntimeError('No intersecting tract/hex candidates found.')

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
        tract_index = int(row.index_right)
        hex_id = str(row.h3)

        tract_area = _to_float_or_none(tract_equal_area['tract_area'].iloc[tract_index])
        if tract_area is None or tract_area <= 0:
            continue

        intersection_area = (
            hex_equal_area.geometry.iloc[hex_index].intersection(tract_equal_area.geometry.iloc[tract_index]).area
        )
        if not math.isfinite(intersection_area) or intersection_area <= 0:
            continue

        weight = intersection_area / tract_area
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
    tract_gdf: gpd.GeoDataFrame,
    county_polygon,
    fallback_geoid_by_hex: dict[str, str],
) -> dict[str, dict[str, float | int | None]]:
    clipped = hex_gdf.geometry.intersection(county_polygon)
    points = clipped.representative_point()
    point_gdf = gpd.GeoDataFrame({'h3': hex_gdf['h3'].astype(str)}, geometry=points, crs='EPSG:4326')

    point_hits = gpd.sjoin(
        point_gdf[['h3', 'geometry']],
        tract_gdf[['GEOID', 'geometry']],
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

    tract_median_by_geoid: dict[str, dict[str, float | int | None]] = {}
    for row in tract_gdf.itertuples(index=False):
        geoid = _normalize_geoid(row.GEOID)
        if geoid is None:
            continue

        tract_median_by_geoid[geoid] = {
            MEDIAN_FIELD: _to_number_or_none(getattr(row, MEDIAN_FIELD)),
            MEDIAN_MOE_FIELD: _to_number_or_none(getattr(row, MEDIAN_MOE_FIELD)),
        }

    output: dict[str, dict[str, float | int | None]] = {}
    for hex_id in hex_gdf['h3'].astype(str):
        source_geoid = geoid_by_hex.get(hex_id)
        source_record = tract_median_by_geoid.get(source_geoid, {})
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


def _update_metadata(hex_records_by_year: dict[int, list[dict[str, Any]]]) -> None:
    metadata_path = data_dir / 'metadata.json'
    metadata = read_json(metadata_path, default={})
    if not isinstance(metadata, dict):
        raise RuntimeError('metadata.json must contain a JSON object.')

    quantiles = metadata.get('quantiles')
    if not isinstance(quantiles, dict):
        quantiles = {}
        metadata['quantiles'] = quantiles

    latest_year = max(hex_records_by_year.keys())
    quantiles['hex'] = _compute_hex_quantiles(hex_records_by_year[latest_year])

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

    metadata['h3_resolution'] = int(h3_resolution)
    write_json(metadata_path, metadata)


def _validate_hex_outputs(hex_records_by_year: dict[int, list[dict[str, Any]]]) -> None:
    if not hex_records_by_year:
        raise AssertionError('No hex outputs were generated.')

    for year_value, records in hex_records_by_year.items():
        if not records:
            raise AssertionError(f'Hex output for year {year_value} is empty.')

        for record in records:
            if not record.get('h3'):
                raise AssertionError(f'Hex output for year {year_value} has a record without h3.')

            missing_keys = [key for key in HEX_REQUIRED_KEYS if key not in record]
            if missing_keys:
                raise AssertionError(
                    f'Hex output for year {year_value} is missing keys {missing_keys} in record {record}.'
                )


def main() -> None:
    ensure_dir(data_dir / 'hexes')

    print('Loading tract geometry...')
    tract_geometry = _load_tract_geometry()
    county_polygon = _build_county_polygon(tract_geometry)

    print(f'Generating H3 cells (resolution={h3_resolution})...')
    hex_geometry = _build_hex_geometry(county_polygon)

    hex_records_by_year: dict[int, list[dict[str, Any]]] = {}
    for year_value in years:
        print(f'Building hex values for {year_value}...')
        tract_values = _load_tract_year_values(year_value)
        tract_with_values = _attach_tract_values(tract_geometry, tract_values, year_value)

        count_values_by_hex, fallback_geoid_by_hex = _allocate_count_fields(hex_geometry, tract_with_values)
        median_values_by_hex = _assign_median_fields(
            hex_geometry,
            tract_with_values,
            county_polygon,
            fallback_geoid_by_hex,
        )
        hex_records = _build_hex_records(hex_geometry, count_values_by_hex, median_values_by_hex)

        write_json(data_dir / 'hexes' / f'{year_value}.json', hex_records)
        hex_records_by_year[int(year_value)] = hex_records

    _validate_hex_outputs(hex_records_by_year)
    _update_metadata(hex_records_by_year)
    print('Hex pipeline build complete.')


if __name__ == '__main__':
    main()

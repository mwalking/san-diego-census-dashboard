from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
from pygris.utils import erase_water
from shapely import make_valid

from utils_io import download_with_cache

TIGER_TRACT_URL_TEMPLATE = 'https://www2.census.gov/geo/tiger/TIGER{year}/TRACT/tl_{year}_{state_fips}_tract.zip'
WATER_TRACTCE_MIN = 990000
WATER_TRACTCE_MAX = 990099


def county_fips3(county_fips: str) -> str:
    county = str(county_fips)
    if len(county) == 5:
        county = county[-3:]
    return county.zfill(3)


def _download_tiger_tract_zip(
    year: int,
    state_fips: str,
    cache_dir: Path,
    min_year: int = 2018,
) -> tuple[Path, int, str]:
    year_candidates = list(range(int(year), min_year - 1, -1))
    last_error: Exception | None = None

    for tiger_year in year_candidates:
        url = TIGER_TRACT_URL_TEMPLATE.format(year=tiger_year, state_fips=state_fips)
        destination = cache_dir / f'tl_{tiger_year}_{state_fips}_tract.zip'

        try:
            zip_path = download_with_cache(url, destination)
            return zip_path, tiger_year, url
        except requests.HTTPError as error:
            status_code = error.response.status_code if error.response is not None else None
            if status_code == 404:
                last_error = error
                continue
            raise
        except requests.RequestException as error:
            last_error = error
            continue

    message = f'Unable to download TIGER tract geometry for state {state_fips} (target year {year}).'
    if last_error is not None:
        raise RuntimeError(message) from last_error
    raise RuntimeError(message)


def _normalize_tract_columns(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    normalized = gdf.copy()
    normalized['GEOID'] = normalized['GEOID'].astype(str).str.replace('.0', '', regex=False).str.zfill(11)
    normalized['TRACTCE'] = (
        normalized['TRACTCE'].astype(str).str.replace('.0', '', regex=False).str.zfill(6)
    )
    normalized['ALAND'] = pd.to_numeric(normalized['ALAND'], errors='coerce')
    return normalized


def _is_water_tract(tractce: pd.Series) -> pd.Series:
    tractce_numeric = pd.to_numeric(tractce, errors='coerce')
    return tractce_numeric.between(WATER_TRACTCE_MIN, WATER_TRACTCE_MAX, inclusive='both')


def _cleanup_geometry(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    cleaned = gdf.copy()
    cleaned['geometry'] = cleaned.geometry.apply(lambda geom: make_valid(geom) if geom is not None else None)
    cleaned = cleaned[cleaned.geometry.notna()].copy()
    cleaned = cleaned[~cleaned.geometry.is_empty].copy()
    cleaned = cleaned[cleaned.geometry.geom_type.isin(['Polygon', 'MultiPolygon'])].copy()
    cleaned = cleaned[cleaned.is_valid].copy()
    return gpd.GeoDataFrame(cleaned, geometry='geometry', crs=gdf.crs)


def load_tract_geometry(
    year: int,
    state_fips: str,
    counties: list[str],
    cache_dir: Path,
    simplify_tolerance: float,
    water_area_threshold: float,
) -> tuple[gpd.GeoDataFrame, dict[str, object]]:
    if water_area_threshold < 0 or water_area_threshold > 1:
        raise ValueError('water_area_threshold must be between 0 and 1.')

    zip_path, tiger_year, source_url = _download_tiger_tract_zip(year, state_fips, cache_dir)

    gdf = gpd.read_file(f'zip://{zip_path}')
    if gdf.crs is None:
        gdf = gdf.set_crs('EPSG:4269', allow_override=True)
    gdf = gdf.to_crs('EPSG:4326')

    county_set = {county_fips3(value) for value in counties}
    filtered = gdf[
        (gdf['STATEFP'].astype(str) == state_fips)
        & (gdf['COUNTYFP'].astype(str).isin(county_set))
    ].copy()

    if filtered.empty:
        raise RuntimeError('No tract geometry rows found for configured counties.')

    filtered = _normalize_tract_columns(filtered[['GEOID', 'TRACTCE', 'ALAND', 'geometry']])

    feature_count_before_cleanup = int(len(filtered))
    filtered = erase_water(
        filtered,
        area_threshold=water_area_threshold,
        year=tiger_year,
        cache=False,
    )
    filtered = _normalize_tract_columns(filtered)
    filtered = _cleanup_geometry(filtered)

    if filtered['GEOID'].duplicated().any():
        filtered = filtered.dissolve(by='GEOID', as_index=False, aggfunc='first')
        filtered = _normalize_tract_columns(filtered)
        filtered = _cleanup_geometry(filtered)

    filtered = filtered[filtered['ALAND'].notna() & (filtered['ALAND'] > 0)].copy()
    filtered = filtered[~_is_water_tract(filtered['TRACTCE'])].copy()
    filtered = _cleanup_geometry(filtered)

    if filtered.empty:
        raise RuntimeError('No tract geometries remained after water cleanup.')

    if simplify_tolerance > 0:
        filtered['geometry'] = filtered.geometry.simplify(
            simplify_tolerance,
            preserve_topology=True,
        )
        filtered = _cleanup_geometry(filtered)

    representative_points = filtered.geometry.representative_point()
    filtered['centroid_lon'] = representative_points.x.astype(float)
    filtered['centroid_lat'] = representative_points.y.astype(float)

    filtered = filtered[['GEOID', 'TRACTCE', 'ALAND', 'centroid_lon', 'centroid_lat', 'geometry']]
    filtered = filtered.sort_values('GEOID').reset_index(drop=True)

    source_meta = {
        'tiger_year': tiger_year,
        'source_url': source_url,
        'zip_path': str(zip_path),
        'water_erase_area_threshold': water_area_threshold,
        'feature_count_before_cleanup': feature_count_before_cleanup,
        'feature_count_after_cleanup': int(len(filtered)),
    }

    return filtered, source_meta


def tracts_to_feature_collection(tracts_gdf: gpd.GeoDataFrame) -> dict[str, object]:
    features: list[dict[str, object]] = []

    for row in tracts_gdf.itertuples(index=False):
        geometry = getattr(row, 'geometry', None)
        if geometry is None:
            continue

        features.append(
            {
                'type': 'Feature',
                'properties': {
                    'GEOID': str(row.GEOID),
                    'centroid_lon': float(row.centroid_lon),
                    'centroid_lat': float(row.centroid_lat),
                },
                'geometry': geometry.__geo_interface__,
            }
        )

    return {
        'type': 'FeatureCollection',
        'features': features,
    }

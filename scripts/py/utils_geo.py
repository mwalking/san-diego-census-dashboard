from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import requests

from utils_io import download_with_cache

TIGER_TRACT_URL_TEMPLATE = 'https://www2.census.gov/geo/tiger/TIGER{year}/TRACT/tl_{year}_{state_fips}_tract.zip'


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


def load_tract_geometry(
    year: int,
    state_fips: str,
    counties: list[str],
    cache_dir: Path,
    simplify_tolerance: float,
) -> tuple[gpd.GeoDataFrame, dict[str, object]]:
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

    filtered['GEOID'] = filtered['GEOID'].astype(str).str.zfill(11)

    if simplify_tolerance > 0:
        filtered['geometry'] = filtered.geometry.simplify(
            simplify_tolerance,
            preserve_topology=True,
        )

    representative_points = filtered.geometry.representative_point()
    filtered['centroid_lon'] = representative_points.x.astype(float)
    filtered['centroid_lat'] = representative_points.y.astype(float)

    filtered = filtered[['GEOID', 'centroid_lon', 'centroid_lat', 'geometry']]
    filtered = filtered.sort_values('GEOID').reset_index(drop=True)

    source_meta = {
        'tiger_year': tiger_year,
        'source_url': source_url,
        'zip_path': str(zip_path),
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

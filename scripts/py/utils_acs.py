from __future__ import annotations

import os
from dataclasses import dataclass

import pandas as pd
import requests

ACS_DETAILED_SURVEY_PATH = 'acs/acs5'
ACS_SUBJECT_SURVEY_PATH = 'acs/acs5/subject'
COUNTY_REFERENCE_VARIABLES = ['B25077_001E', 'B17001_001E', 'B17001_002E']


@dataclass(frozen=True)
class FetchBatch:
    survey_path: str
    table_prefix: str
    variables: tuple[str, ...]


def _county_fips3(value: str) -> str:
    county = str(value)
    if len(county) == 5:
        county = county[-3:]
    return county.zfill(3)


def _api_key() -> str:
    api_key = os.getenv('CENSUS_API_KEY')
    if not api_key:
        raise RuntimeError('CENSUS_API_KEY is required. Provide it via environment or --env-file .env.')

    return api_key


def _acs_survey_path_for_variable(variable_code: str) -> str:
    normalized = str(variable_code).strip().upper()
    if normalized.startswith('B'):
        return ACS_DETAILED_SURVEY_PATH
    if normalized.startswith('S'):
        return ACS_SUBJECT_SURVEY_PATH
    raise ValueError(f'Unsupported ACS variable code prefix for {variable_code!r}. Expected B* or S*.')


def _table_prefix(variable_code: str) -> str:
    normalized = str(variable_code).strip().upper()
    return normalized.split('_', 1)[0]


def plan_tract_fetch_batches(
    variable_codes: list[str],
    batch_size: int,
) -> list[FetchBatch]:
    if batch_size < 1:
        raise ValueError('batch_size must be >= 1')

    grouped: dict[tuple[str, str], list[str]] = {}
    for variable_code in sorted({str(code).strip().upper() for code in variable_codes if str(code).strip()}):
        survey_path = _acs_survey_path_for_variable(variable_code)
        table_name = _table_prefix(variable_code)
        grouped.setdefault((survey_path, table_name), []).append(variable_code)

    batches: list[FetchBatch] = []
    for (survey_path, table_name), variables in sorted(grouped.items()):
        for start in range(0, len(variables), batch_size):
            chunk = tuple(variables[start : start + batch_size])
            batches.append(FetchBatch(survey_path=survey_path, table_prefix=table_name, variables=chunk))

    return batches


def _census_url(year: int, survey_path: str) -> str:
    return f'https://api.census.gov/data/{int(year)}/{survey_path}'


def _fetch_census_rows(url: str, params: list[tuple[str, str]], timeout_seconds: int) -> list[list[str]]:
    response = requests.get(url, params=params, timeout=timeout_seconds)
    response.raise_for_status()

    payload = response.json()
    if not isinstance(payload, list) or len(payload) < 2:
        raise RuntimeError(f'Unexpected Census API response from {url}: {payload!r}')
    if not isinstance(payload[0], list):
        raise RuntimeError(f'Unexpected Census API header row from {url}: {payload[0]!r}')

    return payload


def _fetch_tract_batch_for_county(
    year: int,
    state_fips: str,
    county_fips3: str,
    batch: FetchBatch,
    timeout_seconds: int,
) -> pd.DataFrame:
    url = _census_url(year, batch.survey_path)
    get_fields = ','.join(('NAME', *batch.variables))
    params = [
        ('get', get_fields),
        ('for', 'tract:*'),
        ('in', f'state:{state_fips}'),
        ('in', f'county:{county_fips3}'),
        ('key', _api_key()),
    ]

    payload = _fetch_census_rows(url, params=params, timeout_seconds=timeout_seconds)
    headers = payload[0]
    rows = payload[1:]
    batch_df = pd.DataFrame(rows, columns=headers)

    required_geo_columns = ['state', 'county', 'tract']
    missing_geo = [column for column in required_geo_columns if column not in batch_df.columns]
    if missing_geo:
        raise RuntimeError(
            f'Census API tract response missing expected geography columns {missing_geo} '
            f'for {batch.survey_path} {batch.table_prefix}.'
        )

    missing_variables = [variable for variable in batch.variables if variable not in batch_df.columns]
    if missing_variables:
        raise RuntimeError(
            f'Census API tract response missing requested variables {missing_variables} '
            f'for {batch.survey_path} {batch.table_prefix}.'
        )

    batch_df['GEOID'] = (
        batch_df['state'].astype(str).str.zfill(2)
        + batch_df['county'].astype(str).str.zfill(3)
        + batch_df['tract'].astype(str).str.zfill(6)
    )

    output_columns = ['GEOID', *batch.variables]
    return batch_df[output_columns].copy()


def _fetch_tract_batch(
    year: int,
    state_fips: str,
    counties: list[str],
    batch: FetchBatch,
    timeout_seconds: int,
) -> pd.DataFrame:
    county_frames: list[pd.DataFrame] = []
    for county_value in counties:
        county_code = _county_fips3(county_value)
        county_df = _fetch_tract_batch_for_county(
            year=year,
            state_fips=state_fips,
            county_fips3=county_code,
            batch=batch,
            timeout_seconds=timeout_seconds,
        )
        county_frames.append(county_df)

    if not county_frames:
        return pd.DataFrame(columns=['GEOID', *batch.variables])

    combined = pd.concat(county_frames, ignore_index=True)
    return combined.drop_duplicates(subset=['GEOID'], keep='first')


def fetch_tract_acs(
    year: int,
    state_fips: str,
    counties: list[str],
    variable_map: dict[str, str],
    batch_size: int = 45,
    timeout_seconds: int = 120,
) -> pd.DataFrame:
    if not variable_map:
        raise ValueError('variable_map cannot be empty when fetching tract ACS data.')

    raw_variables = sorted({str(key).strip().upper() for key in variable_map.keys() if str(key).strip()})
    if not raw_variables:
        raise ValueError('variable_map did not contain valid ACS variable codes.')

    target_columns = [str(value).strip() for value in variable_map.values() if str(value).strip()]
    if len(set(target_columns)) != len(target_columns):
        raise ValueError('variable_map target field names must be unique.')

    batches = plan_tract_fetch_batches(raw_variables, batch_size=batch_size)
    if not batches:
        raise RuntimeError('No ACS fetch batches were planned.')

    merged_df: pd.DataFrame | None = None
    for batch in batches:
        batch_df = _fetch_tract_batch(
            year=year,
            state_fips=state_fips,
            counties=counties,
            batch=batch,
            timeout_seconds=timeout_seconds,
        )

        numeric_columns = [column for column in batch_df.columns if column != 'GEOID']
        for column in numeric_columns:
            batch_df[column] = pd.to_numeric(batch_df[column], errors='coerce')

        if merged_df is None:
            merged_df = batch_df
        else:
            merged_df = merged_df.merge(batch_df, on='GEOID', how='outer', validate='one_to_one')

    if merged_df is None:
        raise RuntimeError('Failed to fetch tract ACS data.')

    missing_raw_columns = [column for column in raw_variables if column not in merged_df.columns]
    if missing_raw_columns:
        raise RuntimeError(f'Failed to fetch ACS columns: {missing_raw_columns}')

    rename_map = {str(key).strip().upper(): str(value).strip() for key, value in variable_map.items()}
    merged_df = merged_df.rename(columns=rename_map)

    output_columns = ['GEOID', *target_columns]
    output_df = merged_df[output_columns].copy()
    output_df = output_df.dropna(subset=['GEOID']).drop_duplicates(subset=['GEOID'], keep='first')
    return output_df.sort_values('GEOID').reset_index(drop=True)


def _fetch_county_reference_row(
    year: int,
    state_fips: str,
    county_fips3: str,
    timeout_seconds: int,
) -> dict[str, float | None]:
    url = _census_url(year, ACS_DETAILED_SURVEY_PATH)
    get_fields = ','.join(('NAME', *COUNTY_REFERENCE_VARIABLES))
    params = [
        ('get', get_fields),
        ('for', f'county:{county_fips3}'),
        ('in', f'state:{state_fips}'),
        ('key', _api_key()),
    ]
    payload = _fetch_census_rows(url, params=params, timeout_seconds=timeout_seconds)

    headers = payload[0]
    row = payload[1] if len(payload) > 1 else []
    row_map = {headers[index]: row[index] for index in range(min(len(headers), len(row)))}

    home_value = pd.to_numeric(pd.Series([row_map.get('B25077_001E')]), errors='coerce').iloc[0]
    poverty_universe = pd.to_numeric(pd.Series([row_map.get('B17001_001E')]), errors='coerce').iloc[0]
    poverty_below = pd.to_numeric(pd.Series([row_map.get('B17001_002E')]), errors='coerce').iloc[0]

    return {
        'home_value_median': float(home_value) if pd.notna(home_value) else None,
        'poverty_universe_total': float(poverty_universe) if pd.notna(poverty_universe) else None,
        'poverty_below_total': float(poverty_below) if pd.notna(poverty_below) else None,
    }


def fetch_county_reference_values(
    year: int,
    state_fips: str,
    counties: list[str],
    timeout_seconds: int = 120,
) -> dict[str, float | None]:
    home_values: list[float] = []
    poverty_universe_total = 0.0
    poverty_below_total = 0.0

    for county_value in counties:
        county_code = _county_fips3(county_value)
        row = _fetch_county_reference_row(
            year=year,
            state_fips=state_fips,
            county_fips3=county_code,
            timeout_seconds=timeout_seconds,
        )

        home_value = row.get('home_value_median')
        if home_value is not None:
            home_values.append(float(home_value))

        universe = row.get('poverty_universe_total')
        if universe is not None:
            poverty_universe_total += float(universe)

        below = row.get('poverty_below_total')
        if below is not None:
            poverty_below_total += float(below)

    poverty_rate_reference = None
    if poverty_universe_total > 0:
        poverty_rate_reference = poverty_below_total / poverty_universe_total

    home_value_reference = home_values[0] if home_values else None
    return {
        'home_value_median': home_value_reference,
        'poverty_rate': poverty_rate_reference,
        'poverty_below_total': poverty_below_total,
        'poverty_universe_total': poverty_universe_total,
    }

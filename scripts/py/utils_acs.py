from __future__ import annotations

import os
from typing import Iterable

import numpy as np
import pandas as pd
from pytidycensus import get_acs

ACS_VARIABLES = {
    'home_value_median': 'B25077_001',
    'poverty_below': 'B17001_002',
    'poverty_universe': 'B17001_001',
}

REQUIRED_VALUE_KEYS = [
    'home_value_median',
    'home_value_median_moe',
    'poverty_below',
    'poverty_below_moe',
    'poverty_universe',
    'poverty_universe_moe',
]


def _county_fips3(value: str) -> str:
    county = str(value)
    if len(county) == 5:
        county = county[-3:]
    return county.zfill(3)


def _resolve_column(df: pd.DataFrame, candidates: Iterable[str]) -> str | None:
    lower_to_actual = {column.lower(): column for column in df.columns}
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
        matched = lower_to_actual.get(candidate.lower())
        if matched is not None:
            return matched
    return None


def _extract_geoid(df: pd.DataFrame, geography: str) -> pd.Series:
    geoid_column = _resolve_column(df, ['GEOID'])
    if geoid_column is not None:
        geoid = df[geoid_column].astype(str).str.strip()
    elif geography == 'tract':
        state_column = _resolve_column(df, ['state', 'STATE'])
        county_column = _resolve_column(df, ['county', 'COUNTY'])
        tract_column = _resolve_column(df, ['tract', 'TRACT'])
        if state_column is None or county_column is None or tract_column is None:
            raise RuntimeError('ACS tract response did not contain GEOID or tract geography parts.')

        geoid = (
            df[state_column].astype(str).str.zfill(2)
            + df[county_column].astype(str).str.zfill(3)
            + df[tract_column].astype(str).str.zfill(6)
        )
    elif geography == 'county':
        state_column = _resolve_column(df, ['state', 'STATE'])
        county_column = _resolve_column(df, ['county', 'COUNTY'])
        if state_column is None or county_column is None:
            raise RuntimeError('ACS county response did not contain GEOID or county geography parts.')

        geoid = df[state_column].astype(str).str.zfill(2) + df[county_column].astype(str).str.zfill(3)
    else:
        raise RuntimeError(f'Unsupported geography: {geography}')

    geoid = geoid.str.replace('.0', '', regex=False).str.strip()
    if geography == 'tract':
        geoid = geoid.str.zfill(11)
    elif geography == 'county':
        geoid = geoid.str.zfill(5)

    return geoid


def _numeric_column(df: pd.DataFrame, candidates: list[str]) -> pd.Series:
    column = _resolve_column(df, candidates)
    if column is None:
        return pd.Series(np.nan, index=df.index, dtype='float64')

    numeric = pd.to_numeric(df[column], errors='coerce')
    return numeric.replace([np.inf, -np.inf], np.nan)


def _standardize_acs_values(df: pd.DataFrame, geography: str) -> pd.DataFrame:
    output = pd.DataFrame({'GEOID': _extract_geoid(df, geography)})

    for key, variable in ACS_VARIABLES.items():
        output[key] = _numeric_column(df, [key, f'{variable}E', variable])
        output[f'{key}_moe'] = _numeric_column(df, [f'{key}_moe', f'{variable}M'])

    output = output.dropna(subset=['GEOID']).drop_duplicates(subset=['GEOID'], keep='first')
    return output.sort_values('GEOID').reset_index(drop=True)


def _api_key() -> str:
    api_key = os.getenv('CENSUS_API_KEY')
    if not api_key:
        raise RuntimeError('CENSUS_API_KEY is required. Provide it via environment or --env-file .env.')

    return api_key


def fetch_tract_acs(
    year: int,
    state_fips: str,
    counties: list[str],
    moe_level: int = 90,
) -> pd.DataFrame:
    county_values = [_county_fips3(value) for value in counties]
    county_arg: str | list[str] = county_values[0] if len(county_values) == 1 else county_values

    raw = get_acs(
        geography='tract',
        variables=ACS_VARIABLES,
        year=int(year),
        survey='acs5',
        state=state_fips,
        county=county_arg,
        output='wide',
        geometry=False,
        moe_level=moe_level,
        api_key=_api_key(),
    )

    if not isinstance(raw, pd.DataFrame):
        raw = pd.DataFrame(raw)

    return _standardize_acs_values(raw, geography='tract')


def fetch_county_reference_values(
    year: int,
    state_fips: str,
    counties: list[str],
    moe_level: int = 90,
) -> dict[str, float | None]:
    county_values = [_county_fips3(value) for value in counties]
    county_arg: str | list[str] = county_values[0] if len(county_values) == 1 else county_values

    raw = get_acs(
        geography='county',
        variables=ACS_VARIABLES,
        year=int(year),
        survey='acs5',
        state=state_fips,
        county=county_arg,
        output='wide',
        geometry=False,
        moe_level=moe_level,
        api_key=_api_key(),
    )

    if not isinstance(raw, pd.DataFrame):
        raw = pd.DataFrame(raw)

    county_df = _standardize_acs_values(raw, geography='county')

    home_value = county_df['home_value_median'].dropna()
    home_value_reference = float(home_value.iloc[0]) if not home_value.empty else None

    poverty_below_total = float(county_df['poverty_below'].fillna(0).sum())
    poverty_universe_total = float(county_df['poverty_universe'].fillna(0).sum())
    poverty_rate_reference = None
    if poverty_universe_total > 0:
        poverty_rate_reference = poverty_below_total / poverty_universe_total

    return {
        'home_value_median': home_value_reference,
        'poverty_rate': poverty_rate_reference,
        'poverty_below_total': poverty_below_total,
        'poverty_universe_total': poverty_universe_total,
    }

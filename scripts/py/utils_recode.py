from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


def load_census_variable_map(path: Path) -> dict[str, str]:
    with path.open('r', encoding='utf-8') as handle:
        payload = json.load(handle)

    if not isinstance(payload, dict) or not payload:
        raise RuntimeError(f'Variable map must be a non-empty JSON object: {path}')

    mapping: dict[str, str] = {}
    for raw_code, internal_name in payload.items():
        raw_key = str(raw_code).strip().upper()
        target_name = str(internal_name).strip()
        if not raw_key or not target_name:
            raise RuntimeError(f'Invalid variable map entry in {path}: {raw_code!r} -> {internal_name!r}')
        mapping[raw_key] = target_name

    return mapping


def load_census_recodes(path: Path) -> dict[str, str | list[str]]:
    with path.open('r', encoding='utf-8') as handle:
        payload = json.load(handle)

    if not isinstance(payload, dict) or not payload:
        raise RuntimeError(f'Recode map must be a non-empty JSON object: {path}')

    recodes: dict[str, str | list[str]] = {}
    for output_name, source_spec in payload.items():
        output_key = str(output_name).strip()
        if not output_key:
            raise RuntimeError(f'Invalid recode output key in {path}: {output_name!r}')

        if isinstance(source_spec, str):
            source_key = source_spec.strip()
            if not source_key:
                raise RuntimeError(f'Invalid recode source for {output_key} in {path}')
            recodes[output_key] = source_key
            continue

        if isinstance(source_spec, list):
            sources = [str(value).strip() for value in source_spec if str(value).strip()]
            if not sources:
                raise RuntimeError(f'Invalid recode source list for {output_key} in {path}')
            recodes[output_key] = sources
            continue

        raise RuntimeError(
            f'Recode source must be a string or list of strings for {output_key} in {path}; '
            f'got {type(source_spec).__name__}.'
        )

    return recodes


def _normalize_sources(source_spec: str | list[str]) -> tuple[list[str], bool]:
    if isinstance(source_spec, str):
        return [source_spec], True
    return list(source_spec), False


def collapse_census_data(
    df: pd.DataFrame,
    recodes_dict: dict[str, str | list[str]],
    geoid_column: str = 'GEOID',
) -> pd.DataFrame:
    if geoid_column not in df.columns:
        raise KeyError(f'{geoid_column} column is required for recoding.')

    missing_by_output: dict[str, list[str]] = {}
    for output_name, source_spec in recodes_dict.items():
        sources, _ = _normalize_sources(source_spec)
        missing = [source for source in sources if source not in df.columns]
        if missing:
            missing_by_output[output_name] = missing

    if missing_by_output:
        missing_descriptions = [
            f'{output_name}: {", ".join(missing_sources)}'
            for output_name, missing_sources in sorted(missing_by_output.items())
        ]
        raise KeyError(
            'Missing source columns for recodes: ' + '; '.join(missing_descriptions)
        )

    output_columns: dict[str, Any] = {geoid_column: df[geoid_column].astype(str)}
    for output_name, source_spec in recodes_dict.items():
        sources, is_direct = _normalize_sources(source_spec)

        if is_direct:
            output_columns[output_name] = pd.to_numeric(df[sources[0]], errors='coerce')
            continue

        source_frame = df[sources].apply(pd.to_numeric, errors='coerce')
        if output_name.endswith('_m'):
            rss_values = np.sqrt(source_frame.pow(2).fillna(0).sum(axis=1))
            all_missing = source_frame.isna().all(axis=1)
            output_columns[output_name] = rss_values.where(~all_missing, np.nan)
        else:
            output_columns[output_name] = source_frame.sum(axis=1, min_count=1)

    return pd.DataFrame(output_columns)


def to_public_field_name(field_name: str) -> str:
    if field_name.endswith('_e'):
        return field_name[:-2]
    if field_name.endswith('_m'):
        return f'{field_name[:-2]}_moe'
    return field_name


def normalize_public_output_columns(
    df: pd.DataFrame,
    geoid_column: str = 'GEOID',
) -> pd.DataFrame:
    rename_map: dict[str, str] = {}
    seen_targets: set[str] = set()
    for column in df.columns:
        if column == geoid_column:
            continue
        normalized_name = to_public_field_name(str(column))
        if normalized_name in seen_targets:
            raise RuntimeError(f'Duplicate public output field name after normalization: {normalized_name}')
        seen_targets.add(normalized_name)
        rename_map[column] = normalized_name

    normalized = df.rename(columns=rename_map).copy()
    return normalized


def flatten_public_field_names(recodes_dict: dict[str, str | list[str]]) -> list[str]:
    return [to_public_field_name(output_name) for output_name in recodes_dict.keys()]

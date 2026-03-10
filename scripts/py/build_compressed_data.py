from __future__ import annotations

import gzip
from pathlib import Path

from config import data_dir
from utils_io import ensure_dir

TARGET_SUFFIXES = ('.json', '.geojson')


def _iter_target_files(root: Path):
    for path in sorted(root.rglob('*')):
        if not path.is_file():
            continue
        if path.name.endswith('.gz'):
            continue
        if path.suffix not in TARGET_SUFFIXES:
            continue
        yield path


def _compress_file(path: Path) -> tuple[int, int]:
    raw_bytes = path.read_bytes()
    compressed_bytes = gzip.compress(raw_bytes, compresslevel=9, mtime=0)

    output_path = Path(f'{path}.gz')
    ensure_dir(output_path.parent)
    output_path.write_bytes(compressed_bytes)
    return len(raw_bytes), len(compressed_bytes)


def main() -> None:
    total_raw = 0
    total_gz = 0
    file_count = 0

    for path in _iter_target_files(data_dir):
        raw_size, gz_size = _compress_file(path)
        total_raw += raw_size
        total_gz += gz_size
        file_count += 1

    ratio = (total_gz / total_raw) if total_raw > 0 else 0.0
    print(f'Compressed {file_count} files in {data_dir}')
    print(f'Total raw bytes: {total_raw}')
    print(f'Total gz bytes:  {total_gz}')
    print(f'Overall ratio:   {ratio:.4f}')


if __name__ == '__main__':
    main()

export const NO_DATA_COLOR = [17, 24, 39, 220];

const BASE_PALETTE = [
  [15, 23, 42, 210],
  [30, 58, 95, 210],
  [3, 105, 161, 210],
  [8, 145, 178, 210],
  [13, 148, 136, 210],
  [101, 163, 13, 210],
  [163, 230, 53, 210],
];

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeQuantileBreaks(breaks) {
  if (!Array.isArray(breaks)) {
    return [];
  }

  return breaks
    .map((value) => toFiniteNumber(value))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
}

export function getPaletteForBucketCount(bucketCount) {
  const count = Math.max(1, Number(bucketCount) || 1);

  if (count === 1) {
    const middleIndex = Math.floor(BASE_PALETTE.length / 2);
    return [BASE_PALETTE[middleIndex]];
  }

  if (count <= BASE_PALETTE.length) {
    return Array.from({ length: count }, (_, index) => {
      const ratio = count === 1 ? 0 : index / (count - 1);
      const paletteIndex = Math.round(ratio * (BASE_PALETTE.length - 1));
      return BASE_PALETTE[paletteIndex];
    });
  }

  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const startIndex = Math.floor(ratio * (BASE_PALETTE.length - 1));
    return BASE_PALETTE[Math.min(startIndex, BASE_PALETTE.length - 1)];
  });
}

export function getBucketIndexForValue(value, quantileBreaks) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) {
    return -1;
  }

  const breaks = normalizeQuantileBreaks(quantileBreaks);
  if (!breaks.length) {
    return -1;
  }

  let index = 0;
  while (index < breaks.length && numericValue > breaks[index]) {
    index += 1;
  }

  return index;
}

export function getFillColorForValue(value, quantileBreaks) {
  const breaks = normalizeQuantileBreaks(quantileBreaks);
  if (!breaks.length) {
    return NO_DATA_COLOR;
  }

  const bucketIndex = getBucketIndexForValue(value, breaks);
  if (bucketIndex < 0) {
    return NO_DATA_COLOR;
  }

  const palette = getPaletteForBucketCount(breaks.length + 1);
  return palette[Math.min(bucketIndex, palette.length - 1)] ?? NO_DATA_COLOR;
}

export function buildLegendBins(quantileBreaks, formatValue) {
  const breaks = normalizeQuantileBreaks(quantileBreaks);
  if (!breaks.length) {
    return [{ label: 'No data', color: NO_DATA_COLOR }];
  }

  const palette = getPaletteForBucketCount(breaks.length + 1);
  const bins = [];

  for (let index = 0; index < palette.length; index += 1) {
    let label;
    if (index === 0) {
      label = `<= ${formatValue(breaks[0])}`;
    } else if (index === palette.length - 1) {
      label = `> ${formatValue(breaks[breaks.length - 1])}`;
    } else {
      label = `${formatValue(breaks[index - 1])} - ${formatValue(breaks[index])}`;
    }

    bins.push({ label, color: palette[index] });
  }

  bins.push({ label: 'No data', color: NO_DATA_COLOR });
  return bins;
}

import { moeProportion, moeRatio, rssMoe } from './moe.js';

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PERCENT_POINT_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveMetricType(metric) {
  const explicitType = metric?.type ?? metric?.compute?.type;
  if (explicitType) {
    return explicitType;
  }

  if (metric?.source_field || metric?.key || metric?.compute?.key) {
    return 'direct';
  }

  return null;
}

function resolveAggregation(metric) {
  if (metric?.aggregation) {
    return metric.aggregation;
  }

  const metricType = resolveMetricType(metric);
  if (metricType === 'ratio') {
    return 'ratio';
  }
  return 'sum';
}

function getDirectKey(metric) {
  return metric?.key ?? metric?.source_field ?? metric?.compute?.key ?? null;
}

function getDirectMoeKey(metric) {
  return metric?.moeKey ?? null;
}

function getRatioNumeratorKey(metric) {
  return (
    metric?.num ?? metric?.numerator ?? metric?.compute?.num ?? metric?.compute?.numerator ?? null
  );
}

function getRatioDenominatorKey(metric) {
  return (
    metric?.den ??
    metric?.denominator ??
    metric?.compute?.den ??
    metric?.compute?.denominator ??
    null
  );
}

function getRatioNumeratorMoeKey(metric) {
  return metric?.numeratorMoeKey ?? metric?.numMoeKey ?? null;
}

function getRatioDenominatorMoeKey(metric) {
  return metric?.denominatorMoeKey ?? metric?.denMoeKey ?? null;
}

function computeRatioWithMoe(metric, numerator, numeratorMoe, denominator, denominatorMoe) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return { estimate: null, moe: null };
  }

  const estimate = numerator / denominator;
  const method = metric?.moeMethod === 'proportion' ? 'proportion' : 'ratio';
  const moe =
    method === 'proportion'
      ? moeProportion(numerator, numeratorMoe, denominator, denominatorMoe)
      : moeRatio(numerator, numeratorMoe, denominator, denominatorMoe);

  return {
    estimate,
    moe,
  };
}

function sumFiniteValues(records, key) {
  if (!key) {
    return null;
  }

  let total = 0;
  let count = 0;

  for (const record of records) {
    const value = toFiniteNumber(record?.[key]);
    if (value === null) {
      continue;
    }
    total += value;
    count += 1;
  }

  if (count === 0) {
    return null;
  }
  return total;
}

function collectFiniteValues(records, key) {
  if (!key) {
    return [];
  }

  const values = [];
  for (const record of records) {
    const value = toFiniteNumber(record?.[key]);
    if (value !== null) {
      values.push(value);
    }
  }
  return values;
}

export function computeRecordMetricStats(metric, record) {
  if (!metric || !record || typeof record !== 'object') {
    return { estimate: null, moe: null };
  }

  const metricType = resolveMetricType(metric);
  if (metricType === 'direct') {
    const estimate = toFiniteNumber(record?.[getDirectKey(metric)]);
    const moe = toFiniteNumber(record?.[getDirectMoeKey(metric)]);
    return { estimate, moe };
  }

  if (metricType === 'ratio') {
    const numerator = toFiniteNumber(record?.[getRatioNumeratorKey(metric)]);
    const denominator = toFiniteNumber(record?.[getRatioDenominatorKey(metric)]);
    const numeratorMoe = toFiniteNumber(record?.[getRatioNumeratorMoeKey(metric)]);
    const denominatorMoe = toFiniteNumber(record?.[getRatioDenominatorMoeKey(metric)]);

    return computeRatioWithMoe(metric, numerator, numeratorMoe, denominator, denominatorMoe);
  }

  return { estimate: null, moe: null };
}

export function computeAggregateMetricStats(metric, records) {
  if (!metric || !Array.isArray(records) || records.length === 0) {
    return { estimate: null, moe: null };
  }

  const aggregation = resolveAggregation(metric);
  const metricType = resolveMetricType(metric);

  if (aggregation === 'median') {
    if (records.length === 1) {
      return computeRecordMetricStats(metric, records[0]);
    }
    return {
      estimate: null,
      moe: null,
      note: 'Median aggregation not implemented',
    };
  }

  if (aggregation === 'sum') {
    const estimate = sumFiniteValues(records, getDirectKey(metric));
    const moe = rssMoe(collectFiniteValues(records, getDirectMoeKey(metric)));
    return { estimate, moe };
  }

  if (aggregation === 'ratio' || metricType === 'ratio') {
    const numerator = sumFiniteValues(records, getRatioNumeratorKey(metric));
    const denominator = sumFiniteValues(records, getRatioDenominatorKey(metric));
    const numeratorMoe = rssMoe(collectFiniteValues(records, getRatioNumeratorMoeKey(metric)));
    const denominatorMoe = rssMoe(collectFiniteValues(records, getRatioDenominatorMoeKey(metric)));

    const result = computeRatioWithMoe(
      metric,
      numerator,
      numeratorMoe,
      denominator,
      denominatorMoe,
    );
    return {
      estimate: result.estimate,
      moe: result.moe,
    };
  }

  return { estimate: null, moe: null };
}

export function formatMetricEstimate(metric, value) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) {
    return '—';
  }

  if (metric?.format === 'currency') {
    return CURRENCY_FORMATTER.format(numericValue);
  }

  if (metric?.format === 'percent') {
    return PERCENT_FORMATTER.format(numericValue);
  }

  return NUMBER_FORMATTER.format(numericValue);
}

export function formatMetricMoe(metric, value) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) {
    return '—';
  }

  if (metric?.format === 'currency') {
    return CURRENCY_FORMATTER.format(numericValue);
  }

  if (metric?.format === 'percent') {
    return `${PERCENT_POINT_FORMATTER.format(numericValue * 100)} pp`;
  }

  return NUMBER_FORMATTER.format(numericValue);
}

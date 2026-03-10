import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AboutModal from '../components/AboutModal.jsx';
import DataSourcesModal from '../components/DataSourcesModal.jsx';
import LegendCard from '../components/LegendCard.jsx';
import MapShell from '../components/MapShell.jsx';
import SelectionModeCard from '../components/SelectionModeCard.jsx';
import Sidebar from '../components/Sidebar.jsx';
import WelcomeModal from '../components/WelcomeModal.jsx';
import { curateExploreMetrics } from '../config/exploreCatalog.js';
import {
  buildLegendBins,
  getBucketIndexForValue,
  normalizeQuantileBreaks,
} from '../data/choropleth.js';
import {
  GEO_MODES,
  getCenterLngLat,
  getFeatureId,
  getGeoLabel,
  indexYearData,
} from '../data/geography.js';
import {
  loadHexYear,
  loadMetadata,
  loadTractGeometry,
  loadTractYear,
  loadVariables,
  loadYears,
} from '../data/loadData.js';
import {
  computeRecordMetricStats,
  formatMetricEstimate,
  formatMetricMoe,
} from '../data/metricStats.js';
import { COPY, STORAGE_KEYS } from '../ui/microcopy.js';

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

const CHOOSE_FOR_ME_EXTREME_PERCENTILE = 0.02;
const CHOOSE_FOR_ME_MIN_RECORDS_FOR_PERCENTILE = 50;
const CHOOSE_FOR_ME_FLY_TO_DURATION_MS = 1200;
const QUANTILE_PROBS = Object.freeze([0.1, 0.3, 0.5, 0.7, 0.9]);
const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

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

function getDirectKey(metric) {
  return metric?.key ?? metric?.source_field ?? metric?.compute?.key ?? null;
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

function buildProportionMetricDefinition(metric) {
  if (!metric || metric?.type === 'ratio' || !metric?.proportionOf) {
    return metric;
  }

  const numeratorKey = getDirectKey(metric);
  const denominatorKey = metric.proportionOf;
  if (!numeratorKey || !denominatorKey) {
    return metric;
  }

  return {
    ...metric,
    type: 'ratio',
    aggregation: 'ratio',
    format: 'percent',
    numerator: numeratorKey,
    denominator: denominatorKey,
    numeratorMoeKey:
      metric?.numeratorMoeKey ?? metric?.numMoeKey ?? metric?.moeKey ?? `${numeratorKey}_moe`,
    denominatorMoeKey:
      metric?.denominatorMoeKey ??
      metric?.denMoeKey ??
      metric?.proportionOfMoeKey ??
      `${denominatorKey}_moe`,
    moeMethod: metric?.moeMethod ?? 'proportion',
  };
}

function metricHasRequiredKeys(metric, sampleRecord) {
  if (!metric || !sampleRecord || typeof sampleRecord !== 'object') {
    return false;
  }

  const metricType = resolveMetricType(metric);
  if (metricType === 'direct') {
    const key = getDirectKey(metric);
    return Boolean(key && key in sampleRecord);
  }

  if (metricType === 'ratio') {
    const numeratorKey = getRatioNumeratorKey(metric);
    const denominatorKey = getRatioDenominatorKey(metric);
    return Boolean(
      numeratorKey &&
      denominatorKey &&
      numeratorKey in sampleRecord &&
      denominatorKey in sampleRecord,
    );
  }

  return false;
}

function computeLinearQuantile(sortedValues, probability) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    return null;
  }

  const normalizedProbability = toFiniteNumber(probability);
  if (normalizedProbability === null) {
    return null;
  }

  const p = Math.max(0, Math.min(1, normalizedProbability));
  const index = (sortedValues.length - 1) * p;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];

  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue)) {
    return null;
  }

  if (lowerIndex === upperIndex) {
    return lowerValue;
  }

  const weight = index - lowerIndex;
  return lowerValue + (upperValue - lowerValue) * weight;
}

function normalizeQuantileValue(value) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) {
    return null;
  }

  const rounded = Number(numericValue.toFixed(6));
  if (!Number.isFinite(rounded)) {
    return null;
  }

  return Number.isInteger(rounded) ? rounded : rounded;
}

function computeRuntimeQuantileBreaks(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const sortedFiniteValues = values
    .map((value) => toFiniteNumber(value))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  if (!sortedFiniteValues.length) {
    return [];
  }

  const breaks = [];
  for (const probability of QUANTILE_PROBS) {
    const quantileValue = computeLinearQuantile(sortedFiniteValues, probability);
    const normalizedValue = normalizeQuantileValue(quantileValue);
    if (normalizedValue !== null) {
      breaks.push(normalizedValue);
    }
  }

  return breaks;
}

function normalizeYearsPayload(payload) {
  const source = Array.isArray(payload) ? payload : payload?.years;
  if (!Array.isArray(source)) {
    return [];
  }

  const seen = new Set();
  const years = [];

  for (const value of source) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    if (!seen.has(parsed)) {
      seen.add(parsed);
      years.push(parsed);
    }
  }

  return years.sort((a, b) => a - b);
}

function normalizeIdList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => (value === undefined || value === null ? '' : String(value)))
        .filter(Boolean),
    ),
  );
}

function normalizeMetricList(payload) {
  const normalizedMetrics = [];
  const seenMetricIds = new Set();

  function appendMetric(metric, fallbackGroup) {
    if (!metric || typeof metric !== 'object' || !metric.id) {
      return;
    }

    const metricId = String(metric.id);
    if (!metricId || seenMetricIds.has(metricId)) {
      return;
    }

    seenMetricIds.add(metricId);
    normalizedMetrics.push({
      ...metric,
      id: metricId,
      label: metric.label ? String(metric.label) : metricId,
      group: metric.group ? String(metric.group) : fallbackGroup || 'Other',
      format: metric.format ? String(metric.format) : 'number',
    });
  }

  const primaryMetrics = Array.isArray(payload?.metrics) ? payload.metrics : [];
  for (const metric of primaryMetrics) {
    appendMetric(metric, null);
  }

  const catalogGroups = Array.isArray(payload?.catalog?.groups) ? payload.catalog.groups : [];
  for (const group of catalogGroups) {
    const fallbackGroup =
      (group?.label && String(group.label)) || (group?.id && String(group.id)) || 'Other';
    const catalogMetrics = Array.isArray(group?.metrics) ? group.metrics : [];
    for (const metric of catalogMetrics) {
      appendMetric(metric, fallbackGroup);
    }
  }

  return curateExploreMetrics(normalizedMetrics).map((metric) =>
    buildProportionMetricDefinition(metric),
  );
}

function getQuantilesForGeoYear(metadata, geoMode, year) {
  const modeQuantiles = metadata?.quantiles?.[geoMode];
  if (!modeQuantiles || typeof modeQuantiles !== 'object' || Array.isArray(modeQuantiles)) {
    return {};
  }

  const yearEntries = Object.entries(modeQuantiles)
    .filter(
      ([key, value]) =>
        /^\d{4}$/.test(String(key)) && value && typeof value === 'object' && !Array.isArray(value),
    )
    .sort(([leftYear], [rightYear]) => Number(leftYear) - Number(rightYear));

  if (yearEntries.length > 0) {
    const yearKey = String(year ?? '');
    if (yearKey && modeQuantiles[yearKey] && typeof modeQuantiles[yearKey] === 'object') {
      return modeQuantiles[yearKey];
    }

    const [, latestYearQuantiles] = yearEntries[yearEntries.length - 1];
    return latestYearQuantiles;
  }

  return modeQuantiles;
}

function formatLegendTick(value, format) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 'N/A';
  }

  if (format === 'currency') {
    return CURRENCY_FORMATTER.format(numericValue);
  }

  if (format === 'percent') {
    return PERCENT_FORMATTER.format(numericValue);
  }

  return NUMBER_FORMATTER.format(numericValue);
}

function pickRandomValue(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * values.length);
  return values[randomIndex] ?? null;
}

function getExtremePoolFromPercentile(candidates, pickHigh) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const sortedCandidates = [...candidates].sort((left, right) => left.estimate - right.estimate);
  const bucketSize = Math.max(
    1,
    Math.ceil(sortedCandidates.length * CHOOSE_FOR_ME_EXTREME_PERCENTILE),
  );
  return pickHigh ? sortedCandidates.slice(-bucketSize) : sortedCandidates.slice(0, bucketSize);
}

function getExtremePoolFromQuantiles(candidates, pickHigh, quantileBreaks) {
  const normalizedBreaks = normalizeQuantileBreaks(quantileBreaks);
  if (!normalizedBreaks.length) {
    return [];
  }

  const boundary = pickHigh ? normalizedBreaks[normalizedBreaks.length - 1] : normalizedBreaks[0];
  return candidates.filter((candidate) =>
    pickHigh ? candidate.estimate > boundary : candidate.estimate <= boundary,
  );
}

function pickExtremeCandidate(candidates, pickHigh, quantileBreaks) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  let candidatePool = [];
  if (candidates.length >= CHOOSE_FOR_ME_MIN_RECORDS_FOR_PERCENTILE) {
    candidatePool = getExtremePoolFromPercentile(candidates, pickHigh);
  } else {
    candidatePool = getExtremePoolFromQuantiles(candidates, pickHigh, quantileBreaks);
  }

  if (!candidatePool.length) {
    const quantilePool = getExtremePoolFromQuantiles(candidates, pickHigh, quantileBreaks);
    if (quantilePool.length) {
      candidatePool = quantilePool;
    }
  }

  if (!candidatePool.length) {
    candidatePool = getExtremePoolFromPercentile(candidates, pickHigh);
  }

  return pickRandomValue(candidatePool);
}

function getCountyAverage(metadata, geoMode, year, metricId) {
  const yearKey = String(year ?? '');
  const modeAverage = toFiniteNumber(metadata?.averages?.[geoMode]?.[yearKey]?.[metricId]);
  if (modeAverage !== null) {
    return modeAverage;
  }
  return toFiniteNumber(metadata?.averages?.[yearKey]?.[metricId]);
}

async function loadYearIndexForGeoMode(geoMode, year) {
  const yearKey = String(year ?? '');
  if (!yearKey) {
    return { byId: new globalThis.Map(), records: [] };
  }

  if (geoMode === GEO_MODES.HEX) {
    const rawHexData = await loadHexYear(yearKey);
    return indexYearData(GEO_MODES.HEX, rawHexData);
  }

  if (geoMode === GEO_MODES.TRACT) {
    const rawTractData = await loadTractYear(yearKey);
    return indexYearData(GEO_MODES.TRACT, rawTractData);
  }

  return { byId: new globalThis.Map(), records: [] };
}

async function computeLegendBucketSelection({
  geoMode,
  year,
  metric,
  quantileBreaks,
  bucketIndex,
}) {
  const normalizedBucketIndex = Number(bucketIndex);
  if (!Number.isInteger(normalizedBucketIndex) || normalizedBucketIndex < 0 || !metric) {
    return [];
  }

  const breaks = normalizeQuantileBreaks(quantileBreaks);
  if (!breaks.length) {
    return [];
  }

  const yearIndex = await loadYearIndexForGeoMode(geoMode, year);
  if (!(yearIndex?.byId instanceof Map)) {
    return [];
  }

  const matchingIds = [];
  for (const [id, record] of yearIndex.byId.entries()) {
    const estimate = computeRecordMetricStats(metric, record)?.estimate;
    const recordBucketIndex = getBucketIndexForValue(estimate, breaks);
    if (recordBucketIndex === normalizedBucketIndex) {
      matchingIds.push(id);
    }
  }

  return matchingIds;
}

function App() {
  const [geoMode, setGeoMode] = useState(GEO_MODES.HEX);
  const [hoverIdByGeo, setHoverIdByGeo] = useState({
    [GEO_MODES.HEX]: null,
    [GEO_MODES.TRACT]: null,
  });
  const [selectedIdsByGeo, setSelectedIdsByGeo] = useState({
    [GEO_MODES.HEX]: [],
    [GEO_MODES.TRACT]: [],
  });
  const [visibleIdsByGeo, setVisibleIdsByGeo] = useState({
    [GEO_MODES.HEX]: [],
    [GEO_MODES.TRACT]: [],
  });
  const [selectionMode, setSelectionMode] = useState('single');
  const [activeMetricId, setActiveMetricId] = useState(null);
  const [year, setYear] = useState(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const [chooseForMeCallout, setChooseForMeCallout] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [years, setYears] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [isSharedDataLoading, setIsSharedDataLoading] = useState(true);
  const [isMapDataLoading, setIsMapDataLoading] = useState(false);
  const [isRuntimeQuantilesLoading, setIsRuntimeQuantilesLoading] = useState(false);
  const [legendFilter, setLegendFilter] = useState(null);
  const [runtimeQuantilesForCurrentContext, setRuntimeQuantilesForCurrentContext] = useState({});
  const chooseDataCacheRef = useRef({
    [GEO_MODES.HEX]: new Map(),
    [GEO_MODES.TRACT]: new Map(),
    tractsGeojson: null,
  });
  const runtimeQuantilesCacheRef = useRef(new Map());
  const legendFilterPreviousSelectionRef = useRef(null);
  const legendFilterRequestIdRef = useRef(0);

  useEffect(() => {
    try {
      const wasDismissed = globalThis.localStorage?.getItem(STORAGE_KEYS.welcomeDismissed) === '1';
      setIsWelcomeOpen(!wasDismissed);
    } catch {
      setIsWelcomeOpen(true);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadSharedData() {
      setIsSharedDataLoading(true);
      try {
        const [loadedYears, loadedMetadata, loadedVariables] = await Promise.all([
          loadYears(),
          loadMetadata(),
          loadVariables(),
        ]);

        if (isCancelled) {
          return;
        }

        const normalizedYears = normalizeYearsPayload(loadedYears);
        setYears(normalizedYears);
        setMetadata(loadedMetadata ?? null);
        setMetrics(normalizeMetricList(loadedVariables));
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load shared app data:', error);
          setYears([]);
          setMetadata(null);
          setMetrics([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSharedDataLoading(false);
        }
      }
    }

    loadSharedData();

    return () => {
      isCancelled = true;
    };
  }, []);

  function handleWelcomeDismiss() {
    setIsWelcomeOpen(false);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEYS.welcomeDismissed, '1');
    } catch {
      // Ignore storage errors and continue.
    }
  }

  const loadChooseDataContext = useCallback(async (mode, targetYear) => {
    const normalizedYear = String(targetYear ?? '');
    if (!normalizedYear) {
      return null;
    }

    const cachedByYear = chooseDataCacheRef.current[mode];
    const cachedContext = cachedByYear?.get(normalizedYear) ?? null;
    if (cachedContext) {
      return cachedContext;
    }

    if (mode === GEO_MODES.HEX) {
      const rawHexData = await loadHexYear(normalizedYear);
      const yearIndex = indexYearData(GEO_MODES.HEX, rawHexData);
      const nextContext = { yearIndex, tractsGeojson: null };
      cachedByYear.set(normalizedYear, nextContext);
      return nextContext;
    }

    if (mode === GEO_MODES.TRACT) {
      const rawTractYearData = await loadTractYear(normalizedYear);
      let tractsGeojson = chooseDataCacheRef.current.tractsGeojson;
      if (!tractsGeojson) {
        tractsGeojson = (await loadTractGeometry()) ?? EMPTY_GEOJSON;
        chooseDataCacheRef.current.tractsGeojson = tractsGeojson;
      }

      const yearIndex = indexYearData(GEO_MODES.TRACT, rawTractYearData);
      const nextContext = { yearIndex, tractsGeojson };
      cachedByYear.set(normalizedYear, nextContext);
      return nextContext;
    }

    return null;
  }, []);

  function handleHoverIdChange(mode, nextHoverId) {
    const normalizedHoverId = nextHoverId ?? null;

    setHoverIdByGeo((previous) => {
      if (mode !== GEO_MODES.HEX && mode !== GEO_MODES.TRACT) {
        return previous;
      }

      if (previous[mode] === normalizedHoverId) {
        return previous;
      }

      return {
        ...previous,
        [mode]: normalizedHoverId,
      };
    });
  }

  const clearLegendFilter = useCallback(
    ({ restorePreviousSelection = true } = {}) => {
      if (!legendFilter) {
        return false;
      }

      legendFilterRequestIdRef.current += 1;
      const previousSelection = legendFilterPreviousSelectionRef.current;

      if (restorePreviousSelection && previousSelection?.geoMode) {
        const mode = previousSelection.geoMode;
        const restoreIds = normalizeIdList(previousSelection.ids);
        setSelectedIdsByGeo((previous) => {
          const previousIds = previous[mode] ?? [];
          const hasSameLength = previousIds.length === restoreIds.length;
          const hasSameValues =
            hasSameLength && previousIds.every((value, index) => value === restoreIds[index]);

          if (hasSameValues) {
            return previous;
          }

          return {
            ...previous,
            [mode]: restoreIds,
          };
        });
      }

      legendFilterPreviousSelectionRef.current = null;
      setLegendFilter(null);
      return true;
    },
    [legendFilter],
  );

  const applySelectedIdsByGeoMode = useCallback((mode, nextSelectedIds) => {
    if (mode !== GEO_MODES.HEX && mode !== GEO_MODES.TRACT) {
      return;
    }

    const normalizedSelectedIds = normalizeIdList(nextSelectedIds);

    setSelectedIdsByGeo((previous) => {
      const previousIds = previous[mode] ?? [];
      const hasSameLength = previousIds.length === normalizedSelectedIds.length;
      const hasSameValues =
        hasSameLength &&
        previousIds.every((value, index) => value === normalizedSelectedIds[index]);

      if (hasSameValues) {
        return previous;
      }

      return {
        ...previous,
        [mode]: normalizedSelectedIds,
      };
    });
  }, []);

  function handleSelectedIdsChange(mode, nextSelectedIds) {
    if (legendFilter?.geoMode === mode) {
      clearLegendFilter({ restorePreviousSelection: false });
    }

    applySelectedIdsByGeoMode(mode, nextSelectedIds);
  }

  const handleVisibleIdsChange = useCallback((mode, nextVisibleIds) => {
    if (mode !== GEO_MODES.HEX && mode !== GEO_MODES.TRACT) {
      return;
    }

    const normalizedVisibleIds = normalizeIdList(nextVisibleIds);

    setVisibleIdsByGeo((previous) => {
      const previousIds = previous[mode] ?? [];
      const hasSameLength = previousIds.length === normalizedVisibleIds.length;
      const hasSameValues =
        hasSameLength && previousIds.every((value, index) => value === normalizedVisibleIds[index]);

      if (hasSameValues) {
        return previous;
      }

      return {
        ...previous,
        [mode]: normalizedVisibleIds,
      };
    });
  }, []);

  const quantilesForCurrentGeoYear = useMemo(
    () => getQuantilesForGeoYear(metadata, geoMode, year),
    [geoMode, metadata, year],
  );

  const metricIdFingerprint = useMemo(
    () => metrics.map((metric) => metric.id).join('|'),
    [metrics],
  );

  useEffect(() => {
    let isCancelled = false;

    async function computeRuntimeQuantileFallback() {
      const yearKey = String(year ?? '');
      if (!yearKey || metrics.length === 0) {
        setRuntimeQuantilesForCurrentContext({});
        setIsRuntimeQuantilesLoading(false);
        return;
      }

      const cacheKey = `${geoMode}:${yearKey}:${metricIdFingerprint}`;
      const cachedQuantiles = runtimeQuantilesCacheRef.current.get(cacheKey);
      if (cachedQuantiles) {
        setRuntimeQuantilesForCurrentContext(cachedQuantiles);
        setIsRuntimeQuantilesLoading(false);
        return;
      }

      setRuntimeQuantilesForCurrentContext({});
      setIsRuntimeQuantilesLoading(true);

      try {
        const yearIndex = await loadYearIndexForGeoMode(geoMode, year);
        if (isCancelled) {
          return;
        }

        const records = Array.isArray(yearIndex?.records) ? yearIndex.records : [];
        const sampleRecord = records.find((record) => record && typeof record === 'object') ?? null;
        if (!sampleRecord) {
          runtimeQuantilesCacheRef.current.set(cacheKey, {});
          setRuntimeQuantilesForCurrentContext({});
          setIsRuntimeQuantilesLoading(false);
          return;
        }

        const fallbackQuantiles = {};
        for (const metric of metrics) {
          const metadataBreaks = normalizeQuantileBreaks(quantilesForCurrentGeoYear?.[metric.id]);
          if (metadataBreaks.length > 0) {
            continue;
          }
          if (!metricHasRequiredKeys(metric, sampleRecord)) {
            continue;
          }

          const metricValues = [];
          for (const record of records) {
            const estimate = computeRecordMetricStats(metric, record)?.estimate;
            if (Number.isFinite(estimate)) {
              metricValues.push(estimate);
            }
          }

          const breaks = computeRuntimeQuantileBreaks(metricValues);
          if (breaks.length > 0) {
            fallbackQuantiles[metric.id] = breaks;
          }
        }

        runtimeQuantilesCacheRef.current.set(cacheKey, fallbackQuantiles);
        setRuntimeQuantilesForCurrentContext(fallbackQuantiles);
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to compute runtime quantile fallback:', error);
          setRuntimeQuantilesForCurrentContext({});
        }
      } finally {
        if (!isCancelled) {
          setIsRuntimeQuantilesLoading(false);
        }
      }
    }

    computeRuntimeQuantileFallback();

    return () => {
      isCancelled = true;
    };
  }, [geoMode, metricIdFingerprint, metrics, quantilesForCurrentGeoYear, year]);

  const effectiveQuantilesForCurrentGeoYear = useMemo(() => {
    const baseQuantiles = quantilesForCurrentGeoYear ?? {};
    const fallbackEntries = Object.entries(runtimeQuantilesForCurrentContext ?? {});
    if (!fallbackEntries.length) {
      return baseQuantiles;
    }

    const mergedQuantiles = { ...baseQuantiles };
    for (const [metricId, breaks] of fallbackEntries) {
      const existingBreaks = normalizeQuantileBreaks(mergedQuantiles[metricId]);
      if (existingBreaks.length > 0) {
        continue;
      }
      mergedQuantiles[metricId] = breaks;
    }

    return mergedQuantiles;
  }, [quantilesForCurrentGeoYear, runtimeQuantilesForCurrentContext]);

  const metricsForCurrentGeoMode = useMemo(() => {
    return metrics.map((metric) => ({
      ...metric,
      isAvailable:
        Array.isArray(effectiveQuantilesForCurrentGeoYear?.[metric.id]) &&
        normalizeQuantileBreaks(effectiveQuantilesForCurrentGeoYear[metric.id]).length > 0,
    }));
  }, [effectiveQuantilesForCurrentGeoYear, metrics]);

  const metricGroups = useMemo(() => {
    const groups = [];
    const groupsByLabel = new Map();

    for (const metric of metricsForCurrentGeoMode) {
      if (!groupsByLabel.has(metric.group)) {
        const nextGroup = {
          id: metric.group.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          label: metric.group,
          metrics: [],
        };
        groupsByLabel.set(metric.group, nextGroup);
        groups.push(nextGroup);
      }

      groupsByLabel.get(metric.group).metrics.push({
        id: metric.id,
        label: metric.label,
        isDisabled: !metric.isAvailable,
      });
    }

    return groups;
  }, [metricsForCurrentGeoMode]);

  const metricDefinitionsById = useMemo(() => {
    const nextById = {};
    for (const metric of metricsForCurrentGeoMode) {
      nextById[metric.id] = metric;
    }
    return nextById;
  }, [metricsForCurrentGeoMode]);

  const availableMetricsForGeoMode = useMemo(
    () => metricsForCurrentGeoMode.filter((metric) => metric.isAvailable),
    [metricsForCurrentGeoMode],
  );

  useEffect(() => {
    if (!years.length) {
      setYear(null);
      return;
    }

    setYear((previousYear) =>
      years.includes(previousYear) ? previousYear : years[years.length - 1],
    );
  }, [years]);

  useEffect(() => {
    if (isRuntimeQuantilesLoading) {
      return;
    }

    if (!availableMetricsForGeoMode.length) {
      setActiveMetricId(null);
      return;
    }

    const stillAvailable = availableMetricsForGeoMode.some(
      (metric) => metric.id === activeMetricId,
    );
    if (!stillAvailable) {
      setActiveMetricId(availableMetricsForGeoMode[0].id);
    }
  }, [activeMetricId, availableMetricsForGeoMode, isRuntimeQuantilesLoading]);

  const activeMetric = useMemo(
    () => availableMetricsForGeoMode.find((metric) => metric.id === activeMetricId) ?? null,
    [activeMetricId, availableMetricsForGeoMode],
  );

  const handleChooseForMeClick = useCallback(async () => {
    if (!activeMetric || !year) {
      return;
    }

    try {
      const chooseContext = await loadChooseDataContext(geoMode, year);
      if (!chooseContext) {
        return;
      }

      const sourceRecords = Array.isArray(chooseContext.yearIndex?.records)
        ? chooseContext.yearIndex.records
        : [];

      const candidates = sourceRecords
        .map((record) => {
          const id = getFeatureId(geoMode, record);
          if (!id) {
            return null;
          }
          const stats = computeRecordMetricStats(activeMetric, record);
          if (!Number.isFinite(stats?.estimate)) {
            return null;
          }
          return {
            id,
            estimate: stats.estimate,
            moe: stats.moe,
          };
        })
        .filter((candidate) => candidate !== null);

      if (!candidates.length) {
        return;
      }

      const pickHigh = Math.random() >= 0.5;
      const selectedCandidate = pickExtremeCandidate(
        candidates,
        pickHigh,
        normalizeQuantileBreaks(effectiveQuantilesForCurrentGeoYear?.[activeMetric.id]),
      );

      if (!selectedCandidate?.id) {
        return;
      }

      const centerLngLat = getCenterLngLat(geoMode, selectedCandidate.id, {
        tractsGeojson: chooseContext.tractsGeojson,
      });
      if (Array.isArray(centerLngLat) && centerLngLat.length >= 2) {
        setFlyToTarget({
          id: selectedCandidate.id,
          lngLat: centerLngLat,
          durationMs: CHOOSE_FOR_ME_FLY_TO_DURATION_MS,
        });
      }

      if (legendFilter?.geoMode === geoMode) {
        clearLegendFilter({ restorePreviousSelection: false });
      }

      setSelectionMode('single');
      setSelectedIdsByGeo((previous) => ({
        ...previous,
        [geoMode]: [selectedCandidate.id],
      }));

      const countyAverage = getCountyAverage(metadata, geoMode, year, activeMetric.id);
      setChooseForMeCallout({
        id: selectedCandidate.id,
        geoMode,
        year,
        metricLabel: activeMetric.label,
        extremeLabel: pickHigh ? 'High' : 'Low',
        estimateLabel: formatMetricEstimate(activeMetric, selectedCandidate.estimate),
        moeLabel: formatMetricMoe(activeMetric, selectedCandidate.moe),
        countyAverageLabel: formatMetricEstimate(activeMetric, countyAverage),
      });
    } catch (error) {
      console.error('Choose for me failed:', error);
    }
  }, [
    activeMetric,
    clearLegendFilter,
    geoMode,
    legendFilter,
    loadChooseDataContext,
    effectiveQuantilesForCurrentGeoYear,
    metadata,
    year,
  ]);

  useEffect(() => {
    if (!chooseForMeCallout) {
      return;
    }

    const selectedIdsForMode = selectedIdsByGeo[chooseForMeCallout.geoMode] ?? [];
    const shouldKeepCallout =
      selectedIdsForMode.length === 1 && selectedIdsForMode[0] === chooseForMeCallout.id;

    if (!shouldKeepCallout) {
      setChooseForMeCallout(null);
    }
  }, [chooseForMeCallout, selectedIdsByGeo]);

  useEffect(() => {
    setChooseForMeCallout(null);
  }, [activeMetricId, geoMode, year]);

  useEffect(() => {
    if (!legendFilter) {
      return;
    }

    const yearKey = String(year ?? '');
    const isStillValid =
      legendFilter.geoMode === geoMode &&
      legendFilter.metricId === activeMetricId &&
      legendFilter.year === yearKey;

    if (!isStillValid) {
      clearLegendFilter({ restorePreviousSelection: true });
    }
  }, [activeMetricId, clearLegendFilter, geoMode, legendFilter, year]);

  const quantileBreaks = useMemo(
    () => normalizeQuantileBreaks(effectiveQuantilesForCurrentGeoYear?.[activeMetricId]),
    [activeMetricId, effectiveQuantilesForCurrentGeoYear],
  );

  const legendBins = useMemo(() => {
    const format = activeMetric?.format ?? 'number';
    return buildLegendBins(quantileBreaks, (value) => formatLegendTick(value, format));
  }, [activeMetric, quantileBreaks]);

  const isLegendFilterActive = useMemo(() => {
    if (!legendFilter) {
      return false;
    }

    const yearKey = String(year ?? '');
    return (
      legendFilter.geoMode === geoMode &&
      legendFilter.metricId === activeMetricId &&
      legendFilter.year === yearKey
    );
  }, [activeMetricId, geoMode, legendFilter, year]);

  const activeLegendBucketIndex = isLegendFilterActive ? legendFilter.bucketIndex : null;

  const handleLegendBucketClick = useCallback(
    async (bucketIndex) => {
      if (!activeMetric || !year) {
        return;
      }

      const normalizedBucketIndex = Number(bucketIndex);
      if (!Number.isInteger(normalizedBucketIndex) || normalizedBucketIndex < 0) {
        return;
      }

      const yearKey = String(year);
      const isSameFilterContext =
        legendFilter?.geoMode === geoMode &&
        legendFilter?.metricId === activeMetric.id &&
        legendFilter?.year === yearKey;

      const isSameBucket =
        isSameFilterContext && legendFilter?.bucketIndex === normalizedBucketIndex;
      if (isSameBucket) {
        clearLegendFilter({ restorePreviousSelection: true });
        return;
      }

      if (!isSameFilterContext) {
        legendFilterPreviousSelectionRef.current = {
          geoMode,
          ids: normalizeIdList(selectedIdsByGeo[geoMode] ?? []),
        };
      }

      const requestId = legendFilterRequestIdRef.current + 1;
      legendFilterRequestIdRef.current = requestId;

      try {
        const ids = await computeLegendBucketSelection({
          geoMode,
          year,
          metric: activeMetric,
          quantileBreaks,
          bucketIndex: normalizedBucketIndex,
        });

        if (legendFilterRequestIdRef.current !== requestId) {
          return;
        }

        applySelectedIdsByGeoMode(geoMode, ids);
        setLegendFilter({
          geoMode,
          metricId: activeMetric.id,
          year: yearKey,
          bucketIndex: normalizedBucketIndex,
        });
      } catch (error) {
        if (legendFilterRequestIdRef.current !== requestId) {
          return;
        }
        console.error('Legend bucket filter failed:', error);
      }
    },
    [
      activeMetric,
      applySelectedIdsByGeoMode,
      clearLegendFilter,
      geoMode,
      legendFilter,
      quantileBreaks,
      selectedIdsByGeo,
      year,
    ],
  );

  const geoLabel = useMemo(() => getGeoLabel(geoMode), [geoMode]);
  const isLoading = isSharedDataLoading || isMapDataLoading || isRuntimeQuantilesLoading;
  const defaultViewState = metadata?.region?.defaultView;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="h-16 shrink-0 border-b border-slate-200/10 bg-slate-950/70 backdrop-blur">
        <div className="flex h-full items-center justify-between gap-3 px-4">
          <h1 className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg">
            {COPY.app.name}
          </h1>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-2 text-xs text-slate-200 hover:bg-slate-800 sm:px-3 sm:text-sm"
              onClick={() => setIsDataSourcesOpen(true)}
            >
              {COPY.nav.dataSources}
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-2 text-xs text-slate-200 hover:bg-slate-800 sm:px-3 sm:text-sm"
              onClick={() => setIsAboutOpen(true)}
            >
              {COPY.nav.about}
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-400 px-2 py-2 text-xs font-semibold text-slate-900 sm:px-3 sm:text-sm"
              onClick={handleChooseForMeClick}
            >
              {COPY.nav.chooseForMe}
            </button>
          </nav>
        </div>
      </header>

      <main className="relative flex-1 min-h-0">
        <div className="relative h-full w-full">
          <MapShell
            geoMode={geoMode}
            year={year}
            activeMetric={activeMetric}
            quantileBreaks={quantileBreaks}
            hoverId={hoverIdByGeo[geoMode]}
            selectionMode={selectionMode}
            selectedIds={selectedIdsByGeo[geoMode] ?? []}
            legendFilterActive={isLegendFilterActive}
            legendFilterHighlightIds={isLegendFilterActive ? (selectedIdsByGeo[geoMode] ?? []) : []}
            flyToTarget={flyToTarget}
            defaultViewState={defaultViewState}
            onDataLoadingChange={setIsMapDataLoading}
            onHoverIdChange={handleHoverIdChange}
            onSelectedIdsChange={handleSelectedIdsChange}
            onVisibleIdsChange={handleVisibleIdsChange}
          />

          {chooseForMeCallout ? (
            <aside className="pointer-events-auto absolute left-1/2 top-4 z-30 w-[360px] max-w-[92vw] -translate-x-1/2 rounded-lg border border-emerald-300/40 bg-slate-900/95 px-4 py-3 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                    {chooseForMeCallout.extremeLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {chooseForMeCallout.metricLabel}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                  onClick={() => setChooseForMeCallout(null)}
                  aria-label="Dismiss choose for me callout"
                >
                  X
                </button>
              </div>
              <p className="mt-3 text-base font-semibold text-slate-100">
                {chooseForMeCallout.estimateLabel}
              </p>
              <p className="mt-1 text-xs text-slate-300">± {chooseForMeCallout.moeLabel}</p>
              <p className="mt-2 text-xs text-slate-400">
                County average ({chooseForMeCallout.year}): {chooseForMeCallout.countyAverageLabel}
              </p>
            </aside>
          ) : null}

          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="pointer-events-auto absolute left-4 top-4 w-[320px] max-w-[92vw]">
              <LegendCard
                geoMode={geoMode}
                onGeoModeChange={setGeoMode}
                activeMetricLabel={activeMetric?.label ?? 'No available metric'}
                legendSubtext={`Showing ${geoLabel.toLowerCase()} for the active metric and year.`}
                quantileBins={legendBins}
                activeBucketIndex={activeLegendBucketIndex}
                onBucketClick={handleLegendBucketClick}
                onClearBucketFilter={() => clearLegendFilter({ restorePreviousSelection: true })}
                isLoading={isLoading}
              />
            </div>

            <div className="pointer-events-auto absolute bottom-4 left-4 w-[320px] max-w-[92vw]">
              <SelectionModeCard
                selectionMode={selectionMode}
                onSelectionModeChange={setSelectionMode}
              />
            </div>

            <div className="pointer-events-auto absolute bottom-4 right-4 top-4 w-[360px] max-w-[92vw]">
              <Sidebar
                years={years}
                year={year}
                onYearChange={setYear}
                metricGroups={metricGroups}
                metricDefinitionsById={metricDefinitionsById}
                activeMetricId={activeMetricId}
                activeMetric={activeMetric}
                onActiveMetricChange={setActiveMetricId}
                geoMode={geoMode}
                selectedIds={selectedIdsByGeo[geoMode] ?? []}
                visibleIds={visibleIdsByGeo[geoMode] ?? []}
                metadata={metadata}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      </main>

      <WelcomeModal isOpen={isWelcomeOpen} onDismiss={handleWelcomeDismiss} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <DataSourcesModal isOpen={isDataSourcesOpen} onClose={() => setIsDataSourcesOpen(false)} />
    </div>
  );
}

export default App;

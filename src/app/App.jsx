import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AboutModal from '../components/AboutModal.jsx';
import DataSourcesModal from '../components/DataSourcesModal.jsx';
import LegendCard from '../components/LegendCard.jsx';
import MapShell from '../components/MapShell.jsx';
import SelectionModeCard from '../components/SelectionModeCard.jsx';
import Sidebar from '../components/Sidebar.jsx';
import WelcomeModal from '../components/WelcomeModal.jsx';
import { buildLegendBins, normalizeQuantileBreaks } from '../data/choropleth.js';
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
const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const source = Array.isArray(payload?.metrics) ? payload.metrics : [];
  return source
    .filter((metric) => metric && typeof metric === 'object' && metric.id)
    .map((metric) => ({
      ...metric,
      id: String(metric.id),
      label: metric.label ? String(metric.label) : String(metric.id),
      group: metric.group ? String(metric.group) : 'Other',
      format: metric.format ? String(metric.format) : 'number',
    }));
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
  const chooseDataCacheRef = useRef({
    [GEO_MODES.HEX]: new Map(),
    [GEO_MODES.TRACT]: new Map(),
    tractsGeojson: null,
  });

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

  function handleSelectedIdsChange(mode, nextSelectedIds) {
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

  const quantilesByGeoMode = useMemo(() => metadata?.quantiles ?? {}, [metadata]);

  const metricsForCurrentGeoMode = useMemo(() => {
    const quantilesForMode = quantilesByGeoMode?.[geoMode] ?? {};

    return metrics.map((metric) => ({
      ...metric,
      isAvailable:
        Array.isArray(quantilesForMode?.[metric.id]) &&
        normalizeQuantileBreaks(quantilesForMode[metric.id]).length > 0,
    }));
  }, [geoMode, metrics, quantilesByGeoMode]);

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
  }, [activeMetricId, availableMetricsForGeoMode]);

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
        metadata?.quantiles?.[geoMode]?.[activeMetric.id],
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
  }, [activeMetric, geoMode, loadChooseDataContext, metadata, year]);

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

  const quantileBreaks = useMemo(() => {
    if (!activeMetricId) {
      return [];
    }
    const breaks = quantilesByGeoMode?.[geoMode]?.[activeMetricId];
    return normalizeQuantileBreaks(breaks);
  }, [activeMetricId, geoMode, quantilesByGeoMode]);

  const legendBins = useMemo(() => {
    const format = activeMetric?.format ?? 'number';
    return buildLegendBins(quantileBreaks, (value) => formatLegendTick(value, format));
  }, [activeMetric, quantileBreaks]);

  const geoLabel = useMemo(() => getGeoLabel(geoMode), [geoMode]);
  const isLoading = isSharedDataLoading || isMapDataLoading;
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

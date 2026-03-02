import { useEffect, useMemo, useState } from 'react';
import AboutModal from '../components/AboutModal.jsx';
import DataSourcesModal from '../components/DataSourcesModal.jsx';
import LegendCard from '../components/LegendCard.jsx';
import MapShell from '../components/MapShell.jsx';
import SelectionModeCard from '../components/SelectionModeCard.jsx';
import Sidebar from '../components/Sidebar.jsx';
import WelcomeModal from '../components/WelcomeModal.jsx';
import { buildLegendBins, normalizeQuantileBreaks } from '../data/choropleth.js';
import { GEO_MODES, getGeoLabel } from '../data/geography.js';
import { loadMetadata, loadVariables, loadYears } from '../data/loadData.js';
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
  const [selectionMode, setSelectionMode] = useState('single');
  const [activeMetricId, setActiveMetricId] = useState(null);
  const [year, setYear] = useState(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const [chooseForMeMessage, setChooseForMeMessage] = useState('');
  const [years, setYears] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [isSharedDataLoading, setIsSharedDataLoading] = useState(true);
  const [isMapDataLoading, setIsMapDataLoading] = useState(false);

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

  function handleChooseForMeClick() {
    setChooseForMeMessage(COPY.app.chooseForMePlaceholder);
  }

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

    const normalizedSelectedIds = Array.isArray(nextSelectedIds)
      ? Array.from(
          new Set(
            nextSelectedIds
              .map((value) => (value === undefined || value === null ? '' : String(value)))
              .filter(Boolean),
          ),
        )
      : [];

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
            defaultViewState={defaultViewState}
            onDataLoadingChange={setIsMapDataLoading}
            onHoverIdChange={handleHoverIdChange}
            onSelectedIdsChange={handleSelectedIdsChange}
          />

          {chooseForMeMessage ? (
            <p className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-md border border-emerald-400/30 bg-slate-900/90 px-3 py-2 text-xs text-emerald-300">
              {chooseForMeMessage}
            </p>
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
                activeMetricId={activeMetricId}
                onActiveMetricChange={setActiveMetricId}
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

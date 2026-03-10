import { useEffect, useMemo, useState } from 'react';
import {
  PROFILE_LAYOUT,
  PROFILE_LAYOUT_METRIC_IDS,
  PROFILE_METRICS,
} from '../config/profileLayout.js';
import {
  computeAggregateMetricStats,
  computeRecordMetricStats,
  formatMetricEstimate,
  formatMetricMoe,
} from '../data/metricStats.js';
import { GEO_MODES, indexYearData } from '../data/geography.js';
import { loadHexYear, loadTractYear } from '../data/loadData.js';
import { COPY } from '../ui/microcopy.js';

const SIDEBAR_TABS = Object.freeze({
  EXPLORE: 'explore',
  PROFILE: 'profile',
});

const STACKED_BAR_COLORS = [
  'bg-emerald-400/70',
  'bg-cyan-400/70',
  'bg-indigo-400/70',
  'bg-amber-400/70',
  'bg-rose-400/70',
  'bg-violet-400/70',
];

const PROFILE_SECTION_THEME = Object.freeze({
  people: {
    container: 'bg-emerald-400/[0.04]',
    header: 'bg-emerald-400/15 text-emerald-100',
    marker: 'bg-emerald-300',
  },
  economic: {
    container: 'bg-cyan-400/[0.04]',
    header: 'bg-cyan-400/15 text-cyan-100',
    marker: 'bg-cyan-300',
  },
  housing: {
    container: 'bg-violet-400/[0.04]',
    header: 'bg-violet-400/15 text-violet-100',
    marker: 'bg-violet-300',
  },
  mobility: {
    container: 'bg-amber-400/[0.04]',
    header: 'bg-amber-400/15 text-amber-100',
    marker: 'bg-amber-300',
  },
  default: {
    container: 'bg-slate-800/50',
    header: 'bg-slate-800/70 text-slate-200',
    marker: 'bg-slate-300',
  },
});

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function resolveMetadataAverage(metadata, year, metricId, geoMode) {
  const yearKey = String(year ?? '');
  if (!yearKey || !metricId) {
    return { estimate: null, moe: null };
  }

  const estimate =
    toFiniteNumber(metadata?.averages?.[yearKey]?.[metricId]) ??
    toFiniteNumber(metadata?.averages?.[geoMode]?.[yearKey]?.[metricId]);

  const moe =
    toFiniteNumber(metadata?.averages_moe?.[yearKey]?.[metricId]) ??
    toFiniteNumber(metadata?.averages_moe?.[geoMode]?.[yearKey]?.[metricId]);

  return { estimate, moe };
}

function computeAllSummaryStats(activeMetric, allRecords, metadata, year, geoMode) {
  if (!activeMetric) {
    return { estimate: null, moe: null };
  }

  if (activeMetric.aggregation === 'median') {
    return resolveMetadataAverage(metadata, year, activeMetric.id, geoMode);
  }

  return computeAggregateMetricStats(activeMetric, allRecords);
}

function getSummaryLabels(activeMetric, stats, forceEmpty = false) {
  if (forceEmpty || stats?.note) {
    return {
      estimateLabel: '—',
      moeLabel: '± —',
    };
  }

  return {
    estimateLabel: formatMetricEstimate(activeMetric, stats?.estimate),
    moeLabel: `± ${formatMetricMoe(activeMetric, stats?.moe)}`,
  };
}

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\bmoe\b/gi, 'MOE')
    .replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

function isBaseVariableKey(key) {
  return /(?:^|_)base(?:_|$)/i.test(String(key));
}

function getMoreDetailsFormat(key, estimate) {
  const normalizedKey = String(key).toLowerCase();
  const isRatioLikeName =
    normalizedKey.endsWith('_rate') ||
    normalizedKey.endsWith('_share') ||
    normalizedKey.endsWith('_ratio') ||
    normalizedKey.includes('percent') ||
    normalizedKey.endsWith('_pct');

  if (isRatioLikeName && estimate >= 0 && estimate <= 1) {
    return 'percent';
  }

  return 'number';
}

function getFeatureIdentifier(record, geoMode, selectedIds) {
  if (!record || typeof record !== 'object') {
    return selectedIds?.[0] ?? null;
  }

  if (geoMode === GEO_MODES.HEX) {
    return record.h3 ?? selectedIds?.[0] ?? null;
  }

  if (geoMode === GEO_MODES.TRACT) {
    return record.GEOID ?? selectedIds?.[0] ?? null;
  }

  return selectedIds?.[0] ?? null;
}

function Sidebar({
  years = [],
  year,
  onYearChange,
  metricGroups = [],
  metricDefinitionsById = {},
  activeMetricId,
  activeMetric,
  onActiveMetricChange,
  geoMode,
  selectedIds = [],
  visibleIds = [],
  metadata = null,
  isLoading,
}) {
  const [yearDataIndex, setYearDataIndex] = useState({ byId: new globalThis.Map(), records: [] });
  const [isMetricStatsLoading, setIsMetricStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(SIDEBAR_TABS.EXPLORE);

  const yearSliderIndex = Math.max(
    0,
    years.findIndex((value) => value === year),
  );
  const isYearSliderDisabled = years.length <= 1;

  function handleYearChange(event) {
    const nextIndex = Number(event.target.value);
    if (Number.isNaN(nextIndex) || !years[nextIndex]) {
      return;
    }
    onYearChange(years[nextIndex]);
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadYearIndex() {
      if (!year || !geoMode) {
        setYearDataIndex({ byId: new globalThis.Map(), records: [] });
        setIsMetricStatsLoading(false);
        return;
      }

      setIsMetricStatsLoading(true);
      try {
        if (geoMode === GEO_MODES.HEX) {
          const rawHexData = await loadHexYear(year);
          if (isCancelled) {
            return;
          }
          setYearDataIndex(indexYearData(GEO_MODES.HEX, rawHexData));
          return;
        }

        if (geoMode === GEO_MODES.TRACT) {
          const rawTractData = await loadTractYear(year);
          if (isCancelled) {
            return;
          }
          setYearDataIndex(indexYearData(GEO_MODES.TRACT, rawTractData));
          return;
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load sidebar year data:', error);
          setYearDataIndex({ byId: new globalThis.Map(), records: [] });
        }
      } finally {
        if (!isCancelled) {
          setIsMetricStatsLoading(false);
        }
      }
    }

    loadYearIndex();

    return () => {
      isCancelled = true;
    };
  }, [geoMode, year]);

  const selectedRecords = useMemo(() => {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      return [];
    }

    return selectedIds
      .map((id) => yearDataIndex.byId?.get(id) ?? null)
      .filter((record) => record && typeof record === 'object');
  }, [selectedIds, yearDataIndex]);

  const visibleRecords = useMemo(() => {
    if (!Array.isArray(visibleIds) || visibleIds.length === 0) {
      return [];
    }

    return visibleIds
      .map((id) => yearDataIndex.byId?.get(id) ?? null)
      .filter((record) => record && typeof record === 'object');
  }, [visibleIds, yearDataIndex]);

  const allRecords = useMemo(
    () =>
      Array.isArray(yearDataIndex?.records)
        ? yearDataIndex.records.filter((record) => record && typeof record === 'object')
        : [],
    [yearDataIndex],
  );

  const selectedRecord = useMemo(
    () => (selectedRecords.length === 1 ? selectedRecords[0] : null),
    [selectedRecords],
  );
  const selectedFeatureId = useMemo(
    () => getFeatureIdentifier(selectedRecord, geoMode, selectedIds),
    [geoMode, selectedIds, selectedRecord],
  );

  const profileMetricDefinitionsById = useMemo(
    () => ({ ...PROFILE_METRICS, ...metricDefinitionsById }),
    [metricDefinitionsById],
  );

  const profileStatsByMetricId = useMemo(() => {
    if (!selectedRecord) {
      return {};
    }

    const statsByMetric = {};
    for (const metricId of PROFILE_LAYOUT_METRIC_IDS) {
      const metricDefinition = profileMetricDefinitionsById[metricId];
      if (!metricDefinition) {
        continue;
      }

      statsByMetric[metricId] = {
        metric: metricDefinition,
        selected: computeRecordMetricStats(metricDefinition, selectedRecord),
        benchmark: computeAllSummaryStats(metricDefinition, allRecords, metadata, year, geoMode),
      };
    }

    return statsByMetric;
  }, [allRecords, geoMode, metadata, profileMetricDefinitionsById, selectedRecord, year]);

  const inViewStats = useMemo(
    () => computeAggregateMetricStats(activeMetric, visibleRecords),
    [activeMetric, visibleRecords],
  );

  const selectedStats = useMemo(
    () => computeAggregateMetricStats(activeMetric, selectedRecords),
    [activeMetric, selectedRecords],
  );

  const allStats = useMemo(
    () => computeAllSummaryStats(activeMetric, allRecords, metadata, year, geoMode),
    [activeMetric, allRecords, geoMode, metadata, year],
  );

  const selectedStatsByMetricId = useMemo(() => {
    if (!Array.isArray(selectedRecords) || selectedRecords.length === 0) {
      return {};
    }

    const statsByMetric = {};
    for (const group of metricGroups) {
      for (const metricRow of group.metrics) {
        const metricDefinition = metricDefinitionsById?.[metricRow.id];
        if (!metricDefinition) {
          continue;
        }
        statsByMetric[metricRow.id] = computeAggregateMetricStats(
          metricDefinition,
          selectedRecords,
        );
      }
    }

    return statsByMetric;
  }, [metricDefinitionsById, metricGroups, selectedRecords]);

  const activeMetricProfileStats = useMemo(() => {
    if (!selectedRecord || !activeMetric) {
      return { estimate: null, moe: null };
    }
    return computeRecordMetricStats(activeMetric, selectedRecord);
  }, [activeMetric, selectedRecord]);

  const activeMetricProfileBenchmark = useMemo(
    () => computeAllSummaryStats(activeMetric, allRecords, metadata, year, geoMode),
    [activeMetric, allRecords, geoMode, metadata, year],
  );

  const usedProfileFieldKeys = useMemo(() => {
    const keys = new Set(['GEOID', 'h3']);
    for (const metricId of PROFILE_LAYOUT_METRIC_IDS) {
      const metric = profileMetricDefinitionsById[metricId];
      if (!metric) {
        continue;
      }

      if (metric.source_field) {
        keys.add(metric.source_field);
        keys.add(`${metric.source_field}_moe`);
      }
      if (metric.key) {
        keys.add(metric.key);
        keys.add(`${metric.key}_moe`);
      }
      if (metric.numerator) {
        keys.add(metric.numerator);
        keys.add(`${metric.numerator}_moe`);
      }
      if (metric.denominator) {
        keys.add(metric.denominator);
        keys.add(`${metric.denominator}_moe`);
      }
      if (metric.numeratorMoeKey) {
        keys.add(metric.numeratorMoeKey);
      }
      if (metric.denominatorMoeKey) {
        keys.add(metric.denominatorMoeKey);
      }
      if (metric.moeKey) {
        keys.add(metric.moeKey);
      }
    }
    return keys;
  }, [profileMetricDefinitionsById]);

  const moreDetailsRows = useMemo(() => {
    if (!selectedRecord || typeof selectedRecord !== 'object') {
      return [];
    }

    const rows = [];
    for (const [key, value] of Object.entries(selectedRecord)) {
      if (usedProfileFieldKeys.has(key) || key.endsWith('_moe') || isBaseVariableKey(key)) {
        continue;
      }

      const estimate = toFiniteNumber(value);
      if (estimate === null) {
        continue;
      }

      const moe = toFiniteNumber(selectedRecord[`${key}_moe`]);
      rows.push({
        key,
        label: humanizeKey(key),
        estimate,
        moe,
        format: getMoreDetailsFormat(key, estimate),
      });
    }

    rows.sort((left, right) => left.label.localeCompare(right.label));
    return rows;
  }, [selectedRecord, usedProfileFieldKeys]);

  const isSummaryLoading = isLoading || isMetricStatsLoading;
  const selectedSummary = useMemo(
    () => getSummaryLabels(activeMetric, selectedStats, selectedRecords.length === 0),
    [activeMetric, selectedRecords.length, selectedStats],
  );
  const inViewSummary = useMemo(
    () => getSummaryLabels(activeMetric, inViewStats, visibleRecords.length === 0),
    [activeMetric, inViewStats, visibleRecords.length],
  );
  const allSummary = useMemo(
    () => getSummaryLabels(activeMetric, allStats, allRecords.length === 0),
    [activeMetric, allRecords.length, allStats],
  );

  function getMetricRowSummary(metricRow) {
    if (!selectedIds.length) {
      return {
        estimateLabel: '—',
        moeLabel: null,
        note: null,
      };
    }

    if (metricRow.isDisabled) {
      return {
        estimateLabel: '—',
        moeLabel: null,
        note: null,
      };
    }

    const metricDefinition = metricDefinitionsById?.[metricRow.id];
    if (!metricDefinition) {
      return {
        estimateLabel: '—',
        moeLabel: null,
        note: null,
      };
    }

    const stats = selectedStatsByMetricId?.[metricRow.id] ?? { estimate: null, moe: null };
    const estimateLabel = formatMetricEstimate(metricDefinition, stats.estimate);

    if (stats?.note) {
      return {
        estimateLabel: '—',
        moeLabel: '± —',
        note: 'Aggregated medians not implemented yet.',
      };
    }

    return {
      estimateLabel,
      moeLabel: `± ${formatMetricMoe(metricDefinition, stats.moe)}`,
      note: null,
    };
  }

  function renderExploreView() {
    return (
      <>
        {isSummaryLoading ? <p className="mt-3 text-xs text-emerald-300">Loading…</p> : null}

        <section className="mt-4 rounded-lg bg-slate-800/70 p-3">
          <p className="mt-1 text-xs text-slate-400">{activeMetric?.label ?? 'No active metric'}</p>
          <div className="mt-3 grid grid-cols-3 divide-x divide-slate-700/70">
            <div className="min-w-0 pr-2">
              <p className="truncate text-[10px] uppercase tracking-wide text-slate-400">
                Selected ({selectedRecords.length})
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                {selectedSummary.estimateLabel}
              </p>
              <p className="mt-1 truncate text-[10px] text-slate-300">{selectedSummary.moeLabel}</p>
            </div>
            <div className="min-w-0 px-2">
              <p className="truncate text-[10px] uppercase tracking-wide text-slate-400">
                In view ({visibleRecords.length})
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                {inViewSummary.estimateLabel}
              </p>
              <p className="mt-1 truncate text-[10px] text-slate-300">{inViewSummary.moeLabel}</p>
            </div>
            <div className="min-w-0 pl-2">
              <p className="truncate text-[10px] uppercase tracking-wide text-slate-400">
                All ({allRecords.length})
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                {allSummary.estimateLabel}
              </p>
              <p className="mt-1 truncate text-[10px] text-slate-300">{allSummary.moeLabel}</p>
            </div>
          </div>
        </section>

        <div className="mt-4 space-y-4">
          {metricGroups.map((group) => (
            <section key={group.id}>
              <h3 className="text-xs uppercase tracking-wide text-slate-400">{group.label}</h3>
              <div className="mt-2 space-y-1">
                {group.metrics.map((metric) => {
                  const isActive = metric.id === activeMetricId;
                  const isDisabled = metric.isDisabled;
                  const rowSummary = getMetricRowSummary(metric);
                  return (
                    <button
                      key={metric.id}
                      type="button"
                      disabled={isDisabled}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? 'bg-emerald-400/20 text-emerald-200'
                          : isDisabled
                            ? 'cursor-not-allowed bg-slate-800/40 text-slate-500'
                            : 'bg-slate-800/70 text-slate-200 hover:bg-slate-700'
                      }`}
                      onClick={() => {
                        if (isDisabled) {
                          return;
                        }
                        onActiveMetricChange(metric.id);
                      }}
                    >
                      <span>{metric.label}</span>
                      <span className="text-right">
                        <span className="block text-xs text-slate-300">
                          {rowSummary.estimateLabel}
                        </span>
                        {rowSummary.moeLabel ? (
                          <span
                            className="block text-[10px] leading-tight text-slate-400"
                            title={rowSummary.note ?? undefined}
                          >
                            {rowSummary.moeLabel}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </>
    );
  }

  function renderComparisonRowsBlock(block) {
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const renderedRows = rows
      .map((row) => {
        const metricData = profileStatsByMetricId[row.metricId];
        const metric = metricData?.metric;
        if (!metricData || !metric) {
          return null;
        }

        const estimate = toFiniteNumber(metricData.selected?.estimate);
        if (estimate === null) {
          return null;
        }

        const moe = toFiniteNumber(metricData.selected?.moe);
        const benchmarkEstimate = toFiniteNumber(metricData.benchmark?.estimate);

        const maxDomain =
          metric.format === 'percent' ? 1 : Math.max(estimate, benchmarkEstimate ?? 0, 1);

        const estimateRatio =
          metric.format === 'percent' ? clamp01(estimate) : clamp01(estimate / maxDomain);
        const benchmarkRatio =
          benchmarkEstimate === null
            ? null
            : metric.format === 'percent'
              ? clamp01(benchmarkEstimate)
              : clamp01(benchmarkEstimate / maxDomain);

        return (
          <div key={row.metricId} className="rounded-md bg-slate-800/55 px-2 py-1.5">
            <div className="grid grid-cols-[minmax(0,104px)_1fr_auto] items-center gap-2">
              <p className="truncate text-[11px] text-slate-200">{row.label}</p>
              <div className="relative h-2 overflow-hidden rounded-full bg-slate-700/80">
                <div
                  className="h-full rounded-full bg-emerald-400/70"
                  style={{ width: `${estimateRatio * 100}%` }}
                />
                {benchmarkRatio !== null ? (
                  <span
                    className="absolute inset-y-0 w-[2px] bg-amber-300"
                    style={{ left: `calc(${benchmarkRatio * 100}% - 1px)` }}
                    title={`All: ${formatMetricEstimate(metric, benchmarkEstimate)}`}
                  />
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-100">
                  {formatMetricEstimate(metric, estimate)}
                </p>
                <p className="text-[10px] text-slate-400">± {formatMetricMoe(metric, moe)}</p>
              </div>
            </div>
          </div>
        );
      })
      .filter(Boolean);

    if (!renderedRows.length) {
      return null;
    }

    return (
      <div key={block.id} className="space-y-2">
        {renderedRows}
      </div>
    );
  }

  function renderMetricRowsBlock(block) {
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const renderedRows = rows
      .map((row) => {
        const metricData = profileStatsByMetricId[row.metricId];
        const metric = metricData?.metric;
        if (!metricData || !metric) {
          return null;
        }

        const estimate = toFiniteNumber(metricData.selected?.estimate);
        if (estimate === null) {
          return null;
        }

        const moe = toFiniteNumber(metricData.selected?.moe);
        return (
          <div
            key={row.metricId}
            className="flex items-center justify-between rounded-md bg-slate-800/55 px-2 py-1.5"
          >
            <p className="text-[11px] text-slate-200">{row.label}</p>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-100">
                {formatMetricEstimate(metric, estimate)}
              </p>
              <p className="text-[10px] text-slate-400">± {formatMetricMoe(metric, moe)}</p>
            </div>
          </div>
        );
      })
      .filter(Boolean);

    if (!renderedRows.length) {
      return null;
    }

    return (
      <div key={block.id} className="space-y-2">
        {renderedRows}
      </div>
    );
  }

  function renderStackedBarBlock(block) {
    const denominatorData = profileStatsByMetricId[block.denominatorMetricId];
    const denominatorMetric = denominatorData?.metric;
    const denominatorEstimate = toFiniteNumber(denominatorData?.selected?.estimate);
    if (!denominatorMetric || denominatorEstimate === null || denominatorEstimate <= 0) {
      return null;
    }

    const segments = (block.segments ?? [])
      .map((segment, index) => {
        const segmentData = profileStatsByMetricId[segment.metricId];
        const segmentMetric = segmentData?.metric;
        if (!segmentData || !segmentMetric) {
          return null;
        }

        const estimate = Math.max(0, toFiniteNumber(segmentData.selected?.estimate) ?? 0);
        const share = denominatorEstimate > 0 ? estimate / denominatorEstimate : 0;
        return {
          metricId: segment.metricId,
          label: segment.label,
          estimate,
          share,
          colorClass: STACKED_BAR_COLORS[index % STACKED_BAR_COLORS.length],
        };
      })
      .filter(Boolean);

    const totalShare = segments.reduce((sum, segment) => sum + segment.share, 0);
    if (!segments.length || totalShare <= 0) {
      return null;
    }

    const benchmarkDenominator = toFiniteNumber(denominatorData?.benchmark?.estimate);
    const benchmarkSegments =
      benchmarkDenominator && benchmarkDenominator > 0
        ? segments.map((segment) => {
            const benchmarkEstimate = Math.max(
              0,
              toFiniteNumber(profileStatsByMetricId[segment.metricId]?.benchmark?.estimate) ?? 0,
            );
            return {
              ...segment,
              benchmarkShare: benchmarkEstimate / benchmarkDenominator,
            };
          })
        : [];

    const hasBenchmarkDistribution = benchmarkSegments.some(
      (segment) => segment.benchmarkShare > 0,
    );

    return (
      <div key={block.id} className="rounded-md bg-slate-800/55 p-2">
        <p className="text-[11px] text-slate-300">{block.label}</p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-700/80">
          <div className="flex h-full w-full">
            {segments.map((segment) => (
              <div
                key={segment.metricId}
                className={segment.colorClass}
                style={{ width: `${clamp01(segment.share) * 100}%` }}
              />
            ))}
          </div>
        </div>
        {hasBenchmarkDistribution ? (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700/50">
            <div className="flex h-full w-full">
              {benchmarkSegments.map((segment) => (
                <div
                  key={segment.metricId}
                  className={`${segment.colorClass} opacity-60`}
                  style={{ width: `${clamp01(segment.benchmarkShare) * 100}%` }}
                />
              ))}
            </div>
          </div>
        ) : null}
        {hasBenchmarkDistribution ? (
          <p className="mt-1 text-[10px] text-slate-500">Second bar shows all-area distribution.</p>
        ) : null}
        <div className="mt-1.5 space-y-0.5">
          {segments.map((segment) => (
            <div
              key={segment.metricId}
              className="flex items-center justify-between gap-2 text-[10px] text-slate-300"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${segment.colorClass}`} />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="shrink-0">
                {formatMetricEstimate({ format: 'percent' }, segment.share)} (
                {formatMetricEstimate(denominatorMetric, segment.estimate)})
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderProfileView() {
    if (!selectedRecords.length) {
      return (
        <section className="mt-3 rounded-lg bg-slate-800/70 p-4">
          <p className="text-sm text-slate-200">Select a tract or hexagon to view a profile.</p>
        </section>
      );
    }

    if (!selectedRecord) {
      return (
        <section className="mt-3 rounded-lg bg-slate-800/70 p-4">
          <p className="text-sm text-slate-200">
            Profile view works with a single selected feature.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Narrow to one tract or hex to see the richer profile summary.
          </p>
        </section>
      );
    }

    const featureLabel = geoMode === GEO_MODES.HEX ? 'Hex' : 'Tract';
    const profileSections = PROFILE_LAYOUT.map((section) => {
      const theme = PROFILE_SECTION_THEME[section.id] ?? PROFILE_SECTION_THEME.default;
      const renderedBlocks = section.blocks
        .map((block) => {
          if (block.type === 'metricRows') {
            return renderMetricRowsBlock(block);
          }
          if (block.type === 'comparisonRows') {
            return renderComparisonRowsBlock(block);
          }
          if (block.type === 'stackedBar') {
            return renderStackedBarBlock(block);
          }
          return null;
        })
        .filter(Boolean);

      if (!renderedBlocks.length) {
        return null;
      }

      return (
        <section key={section.id} className={`mt-2.5 rounded-lg p-2 ${theme.container}`}>
          <div className={`mb-1.5 flex items-center gap-2 rounded-md px-2 py-1 ${theme.header}`}>
            <span className={`h-3 w-1.5 rounded ${theme.marker}`} />
            <h3 className="text-[10px] uppercase tracking-wide">{section.label}</h3>
          </div>
          <div className="space-y-1.5">{renderedBlocks}</div>
        </section>
      );
    }).filter(Boolean);

    return (
      <>
        <section className="mt-3 rounded-lg bg-slate-800/70 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Selected feature</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {featureLabel}: {selectedFeatureId ?? 'Unknown'}
          </p>

          <div className="mt-3 rounded-md bg-slate-900/60 p-2">
            <p className="text-[11px] text-slate-300">
              {activeMetric?.label ?? 'No active metric'}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {formatMetricEstimate(activeMetric, activeMetricProfileStats.estimate)}
            </p>
            <p className="text-[10px] text-slate-400">
              ± {formatMetricMoe(activeMetric, activeMetricProfileStats.moe)}
            </p>
            {toFiniteNumber(activeMetricProfileBenchmark?.estimate) !== null ? (
              <p className="mt-1 text-[10px] text-slate-500">
                All: {formatMetricEstimate(activeMetric, activeMetricProfileBenchmark.estimate)}
              </p>
            ) : null}
          </div>
          <p className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Selected value
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-[2px] bg-amber-300" />
              All benchmark marker
            </span>
          </p>
        </section>

        {profileSections}

        {moreDetailsRows.length ? (
          <details className="mt-3 rounded-lg bg-slate-800/70 p-3">
            <summary className="cursor-pointer text-sm text-slate-200">More details</summary>
            <div className="mt-3 max-h-56 space-y-1 overflow-auto pr-1">
              {moreDetailsRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-2 rounded bg-slate-900/50 px-2 py-1"
                >
                  <span className="min-w-0 truncate text-[11px] text-slate-300">{row.label}</span>
                  <span className="shrink-0 text-[11px] text-slate-200">
                    {formatMetricEstimate({ format: row.format }, row.estimate)}
                    {row.moe !== null ? (
                      <span className="ml-1 text-slate-500">
                        ± {formatMetricMoe({ format: row.format }, row.moe)}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </>
    );
  }

  return (
    <aside className="h-full w-full overflow-auto rounded-xl border border-slate-200/10 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
      <h2 className="text-base font-semibold text-slate-100">{COPY.sidebar.title}</h2>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-800/70 p-1">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            activeTab === SIDEBAR_TABS.EXPLORE
              ? 'bg-emerald-400/20 text-emerald-200'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab(SIDEBAR_TABS.EXPLORE)}
        >
          Explore
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            activeTab === SIDEBAR_TABS.PROFILE
              ? 'bg-emerald-400/20 text-emerald-200'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab(SIDEBAR_TABS.PROFILE)}
        >
          Profile
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-slate-800/70 p-3">
        <div className="flex items-center justify-between text-sm text-slate-200">
          <span>{COPY.sidebar.yearLabel}</span>
          <span>{year ?? '—'}</span>
        </div>
        <input
          type="range"
          min="0"
          max={String(Math.max(0, years.length - 1))}
          step="1"
          value={String(yearSliderIndex)}
          onChange={handleYearChange}
          disabled={isYearSliderDisabled}
          className="mt-2 w-full accent-emerald-400"
        />
      </div>

      {activeTab === SIDEBAR_TABS.EXPLORE ? renderExploreView() : renderProfileView()}
    </aside>
  );
}

export default Sidebar;

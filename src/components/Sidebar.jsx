import { useEffect, useMemo, useState } from 'react';
import {
  computeAggregateMetricStats,
  formatMetricEstimate,
  formatMetricMoe,
} from '../data/metricStats.js';
import { GEO_MODES, indexYearData } from '../data/geography.js';
import { loadHexYear, loadTractYear } from '../data/loadData.js';
import { COPY } from '../ui/microcopy.js';

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
  isLoading,
}) {
  const [yearDataIndex, setYearDataIndex] = useState({ byId: new globalThis.Map(), records: [] });
  const [isMetricStatsLoading, setIsMetricStatsLoading] = useState(false);
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

  const inViewStats = useMemo(
    () => computeAggregateMetricStats(activeMetric, visibleRecords),
    [activeMetric, visibleRecords],
  );

  const selectedStats = useMemo(
    () => computeAggregateMetricStats(activeMetric, selectedRecords),
    [activeMetric, selectedRecords],
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

  const isSummaryLoading = isLoading || isMetricStatsLoading;
  const inViewEstimateLabel = formatMetricEstimate(activeMetric, inViewStats?.estimate);
  const inViewMoeLabel = formatMetricMoe(activeMetric, inViewStats?.moe);
  const selectedEstimateLabel = formatMetricEstimate(activeMetric, selectedStats?.estimate);
  const selectedMoeLabel = formatMetricMoe(activeMetric, selectedStats?.moe);

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

  return (
    <aside className="h-full w-full overflow-auto rounded-xl border border-slate-200/10 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
      <h2 className="text-base font-semibold text-slate-100">{COPY.sidebar.title}</h2>
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

      {isSummaryLoading ? <p className="mt-3 text-xs text-emerald-300">Loading…</p> : null}

      <section className="mt-4 rounded-lg bg-slate-800/70 p-3">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">In view</h3>
        <p className="mt-1 text-xs text-slate-400">{activeMetric?.label ?? 'No active metric'}</p>
        <p className="mt-2 text-lg font-semibold text-slate-100">{inViewEstimateLabel}</p>
        <p className="mt-1 text-xs text-slate-300">± {inViewMoeLabel}</p>
        {inViewStats?.note ? (
          <p className="mt-1 text-xs text-slate-400">Not available for aggregated medians.</p>
        ) : null}
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
      <section className="mt-5 rounded-lg bg-slate-800/70 p-3">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">
          {COPY.sidebar.selectedAreaTitle}
        </h3>
        {selectedIds.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">{COPY.sidebar.noAreaSelected}</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-400">
              {activeMetric?.label ?? 'No active metric'}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{selectedEstimateLabel}</p>
            <p className="mt-1 text-xs text-slate-300">± {selectedMoeLabel}</p>
            {selectedStats?.note ? (
              <p className="mt-1 text-xs text-slate-400">Not available for aggregated medians.</p>
            ) : null}
          </>
        )}
      </section>
    </aside>
  );
}

export default Sidebar;

import { useEffect, useMemo, useState } from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import DeckGL from '@deck.gl/react';
import maplibregl from 'maplibre-gl';
import MapGL from 'react-map-gl/maplibre';
import { getFillColorForValue } from '../data/choropleth.js';
import {
  GEO_MODES,
  getLayerId,
  getRecordFromLayerObject,
  indexYearData,
} from '../data/geography.js';
import { loadHexYear, loadTractGeometry, loadTractYear } from '../data/loadData.js';

const INITIAL_VIEW_STATE = {
  longitude: -117.1611,
  latitude: 32.7157,
  zoom: 9.5,
  pitch: 0,
  bearing: 0,
};

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const TRACT_LINE_COLOR = [51, 65, 85, 180];
const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

function toFiniteNumber(value) {
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

function computeMetricValue(metric, record) {
  if (!metric || !record || typeof record !== 'object') {
    return null;
  }

  const metricType = resolveMetricType(metric);
  if (metricType === 'direct') {
    const key = getDirectKey(metric);
    if (!key) {
      return null;
    }
    return toFiniteNumber(record[key]);
  }

  if (metricType === 'ratio') {
    const numeratorKey = getRatioNumeratorKey(metric);
    const denominatorKey = getRatioDenominatorKey(metric);
    if (!numeratorKey || !denominatorKey) {
      return null;
    }

    const numerator = toFiniteNumber(record[numeratorKey]);
    const denominator = toFiniteNumber(record[denominatorKey]);
    if (numerator === null || denominator === null || denominator <= 0) {
      return null;
    }

    return numerator / denominator;
  }

  return null;
}

function MapShell({
  geoMode,
  year,
  activeMetric,
  quantileBreaks,
  defaultViewState = INITIAL_VIEW_STATE,
  onDataLoadingChange,
}) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [hexYearIndex, setHexYearIndex] = useState({ byId: new globalThis.Map(), records: [] });
  const [tractYearIndex, setTractYearIndex] = useState({
    byId: new globalThis.Map(),
    records: [],
  });
  const [tractsGeojson, setTractsGeojson] = useState(EMPTY_GEOJSON);

  useEffect(() => {
    if (!defaultViewState) {
      return;
    }

    setViewState((previous) => ({
      ...previous,
      ...defaultViewState,
    }));
  }, [defaultViewState]);

  useEffect(() => {
    let isCancelled = false;

    async function loadYearData() {
      if (!year) {
        setHexYearIndex({ byId: new globalThis.Map(), records: [] });
        setTractYearIndex({ byId: new globalThis.Map(), records: [] });
        setTractsGeojson(EMPTY_GEOJSON);
        onDataLoadingChange?.(false);
        return;
      }

      onDataLoadingChange?.(true);
      try {
        if (geoMode === GEO_MODES.HEX) {
          const rawHexData = await loadHexYear(year);
          if (isCancelled) {
            return;
          }
          setHexYearIndex(indexYearData(GEO_MODES.HEX, rawHexData));
          return;
        }

        if (geoMode === GEO_MODES.TRACT) {
          const [rawTractGeometry, rawTractYear] = await Promise.all([
            loadTractGeometry(),
            loadTractYear(year),
          ]);

          if (isCancelled) {
            return;
          }

          setTractsGeojson(rawTractGeometry ?? EMPTY_GEOJSON);
          setTractYearIndex(indexYearData(GEO_MODES.TRACT, rawTractYear));
          return;
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load map data:', error);
          if (geoMode === GEO_MODES.HEX) {
            setHexYearIndex({ byId: new globalThis.Map(), records: [] });
          }
          if (geoMode === GEO_MODES.TRACT) {
            setTractYearIndex({ byId: new globalThis.Map(), records: [] });
          }
        }
      } finally {
        if (!isCancelled) {
          onDataLoadingChange?.(false);
        }
      }
    }

    loadYearData();

    return () => {
      isCancelled = true;
    };
  }, [geoMode, year, onDataLoadingChange]);

  const layers = useMemo(() => {
    if (!activeMetric) {
      return [];
    }

    if (geoMode === GEO_MODES.HEX) {
      return [
        new H3HexagonLayer({
          id: getLayerId(GEO_MODES.HEX),
          data: hexYearIndex.records,
          pickable: false,
          filled: true,
          stroked: false,
          extruded: false,
          getHexagon: (record) => record.h3,
          getFillColor: (record) =>
            getFillColorForValue(computeMetricValue(activeMetric, record), quantileBreaks),
          updateTriggers: {
            getFillColor: [activeMetric?.id, quantileBreaks],
          },
        }),
      ];
    }

    if (geoMode === GEO_MODES.TRACT) {
      return [
        new GeoJsonLayer({
          id: getLayerId(GEO_MODES.TRACT),
          data: tractsGeojson,
          pickable: false,
          filled: true,
          stroked: true,
          lineWidthMinPixels: 0.75,
          getLineColor: TRACT_LINE_COLOR,
          getFillColor: (feature) => {
            const record = getRecordFromLayerObject(GEO_MODES.TRACT, feature, tractYearIndex);
            const value = computeMetricValue(activeMetric, record);
            return getFillColorForValue(value, quantileBreaks);
          },
          updateTriggers: {
            getFillColor: [activeMetric?.id, quantileBreaks],
          },
        }),
      ];
    }

    return [];
  }, [activeMetric, geoMode, hexYearIndex, quantileBreaks, tractYearIndex, tractsGeojson]);

  return (
    <section className="absolute inset-0">
      <DeckGL
        viewState={viewState}
        controller
        layers={layers}
        onViewStateChange={({ viewState: nextViewState }) => setViewState(nextViewState)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <MapGL
          mapLib={maplibregl}
          mapStyle={BASEMAP_STYLE}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
        />
      </DeckGL>
    </section>
  );
}

export default MapShell;

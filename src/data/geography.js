import * as h3 from 'h3-js';

export const GEO_MODES = Object.freeze({
  HEX: 'hex',
  TRACT: 'tract',
});

const GEO_MODE_VALUES = new Set(Object.values(GEO_MODES));

const GEO_META = Object.freeze({
  [GEO_MODES.HEX]: Object.freeze({
    label: 'Hex bins',
    noun: 'hex',
    nounPlural: 'hex bins',
    idKey: 'h3',
    layerId: 'layer-hex',
  }),
  [GEO_MODES.TRACT]: Object.freeze({
    label: 'Census tracts',
    noun: 'tract',
    nounPlural: 'tracts',
    idKey: 'GEOID',
    layerId: 'layer-tract',
  }),
});

function normalizeId(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value);
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function centroidFromValue(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value) && value.length >= 2) {
    const lng = toFiniteNumber(value[0]);
    const lat = toFiniteNumber(value[1]);
    if (lng !== null && lat !== null) {
      return [lng, lat];
    }
  }

  if (typeof value === 'object') {
    const lng = toFiniteNumber(
      value.lng ?? value.lon ?? value.longitude ?? value.centroid_lon ?? value[0],
    );
    const lat = toFiniteNumber(value.lat ?? value.latitude ?? value.centroid_lat ?? value[1]);
    if (lng !== null && lat !== null) {
      return [lng, lat];
    }
  }

  return null;
}

function getGeoMeta(geoMode) {
  return GEO_META[assertGeoMode(geoMode)];
}

function buildTractRecord(tractId, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { GEOID: tractId, ...value };
  }
  return { GEOID: tractId, value };
}

export function assertGeoMode(geoMode) {
  const normalized = String(geoMode ?? '');
  if (!GEO_MODE_VALUES.has(normalized)) {
    throw new Error(
      `Unsupported geo mode "${geoMode}". Expected one of: ${Array.from(GEO_MODE_VALUES).join(', ')}`,
    );
  }
  return normalized;
}

export function getGeoLabel(geoMode) {
  return getGeoMeta(geoMode).label;
}

export function getGeoNoun(geoMode) {
  return getGeoMeta(geoMode).noun;
}

export function getGeoNounPlural(geoMode) {
  return getGeoMeta(geoMode).nounPlural;
}

export function getIdKey(geoMode) {
  return getGeoMeta(geoMode).idKey;
}

export function getLayerId(geoMode) {
  return getGeoMeta(geoMode).layerId;
}

export function getFeatureId(geoMode, obj) {
  assertGeoMode(geoMode);

  if (!obj || typeof obj !== 'object') {
    return null;
  }

  const idKey = getIdKey(geoMode);
  const directId = normalizeId(obj[idKey]);
  if (directId) {
    return directId;
  }

  const propertyId = normalizeId(obj.properties?.[idKey]);
  if (propertyId) {
    return propertyId;
  }

  return normalizeId(obj.id);
}

export function indexYearData(geoMode, rawYearData) {
  const mode = assertGeoMode(geoMode);
  const byId = new Map();
  const records = [];

  if (mode === GEO_MODES.HEX) {
    const source = Array.isArray(rawYearData) ? rawYearData : [];
    for (const record of source) {
      const id = getFeatureId(mode, record);
      if (!id) {
        continue;
      }
      byId.set(id, record);
      records.push(record);
    }
    return { byId, records };
  }

  if (Array.isArray(rawYearData)) {
    for (const item of rawYearData) {
      const tractId = getFeatureId(mode, item);
      if (!tractId) {
        continue;
      }

      let record;
      if (item?.properties?.GEOID) {
        record = buildTractRecord(tractId, item.properties);
      } else if (item && typeof item === 'object') {
        record = buildTractRecord(tractId, item);
      } else {
        record = buildTractRecord(tractId, null);
      }

      byId.set(tractId, record);
      records.push(record);
    }
    return { byId, records };
  }

  if (rawYearData && typeof rawYearData === 'object') {
    for (const [tractIdRaw, value] of Object.entries(rawYearData)) {
      const tractId = normalizeId(tractIdRaw);
      if (!tractId) {
        continue;
      }
      const record = buildTractRecord(tractId, value);
      byId.set(tractId, record);
      records.push(record);
    }
  }

  return { byId, records };
}

export function getPickedId(geoMode, pickInfo) {
  assertGeoMode(geoMode);
  if (!pickInfo || typeof pickInfo !== 'object') {
    return null;
  }
  return getFeatureId(geoMode, pickInfo.object);
}

export function getRecordById(geoMode, id, yearIndex) {
  assertGeoMode(geoMode);
  const normalizedId = normalizeId(id);
  if (!normalizedId || !yearIndex) {
    return null;
  }

  if (yearIndex instanceof Map) {
    return yearIndex.get(normalizedId) ?? null;
  }

  if (yearIndex.byId instanceof Map) {
    return yearIndex.byId.get(normalizedId) ?? null;
  }

  if (yearIndex.byId && typeof yearIndex.byId === 'object') {
    const direct = yearIndex.byId[normalizedId];
    if (direct !== undefined) {
      return direct;
    }
  }

  if (Array.isArray(yearIndex.records)) {
    for (const record of yearIndex.records) {
      if (getFeatureId(geoMode, record) === normalizedId) {
        return record;
      }
    }
  }

  if (typeof yearIndex === 'object') {
    const direct = yearIndex[normalizedId];
    if (direct !== undefined) {
      if (geoMode === GEO_MODES.TRACT) {
        return buildTractRecord(normalizedId, direct);
      }
      return direct;
    }
  }

  return null;
}

export function getRecordFromLayerObject(geoMode, layerObject, yearIndex) {
  assertGeoMode(geoMode);

  if (!layerObject || typeof layerObject !== 'object') {
    return null;
  }

  const id = getFeatureId(geoMode, layerObject);
  if (!id) {
    return null;
  }

  const indexedRecord = getRecordById(geoMode, id, yearIndex);
  if (indexedRecord) {
    return indexedRecord;
  }

  if (
    geoMode === GEO_MODES.TRACT &&
    layerObject.properties &&
    typeof layerObject.properties === 'object'
  ) {
    return buildTractRecord(id, layerObject.properties);
  }

  return layerObject;
}

function getHexCenterLngLat(h3Id) {
  const methods = [];

  // Compatibility fallback between h3-js v4 and v3 APIs.
  if (typeof h3.cellToLatLng === 'function') {
    methods.push(h3.cellToLatLng);
  }
  if (typeof h3.h3ToGeo === 'function') {
    methods.push(h3.h3ToGeo);
  }

  for (const method of methods) {
    try {
      const latLng = method(h3Id);
      const lat = toFiniteNumber(latLng?.[0]);
      const lng = toFiniteNumber(latLng?.[1]);
      if (lng !== null && lat !== null) {
        return [lng, lat];
      }
    } catch {
      // Continue trying available compatibility methods.
    }
  }

  return null;
}

function findTractCenterInGeojson(tractId, tractsGeojson) {
  const features = tractsGeojson?.features;
  if (!Array.isArray(features)) {
    return null;
  }

  for (const feature of features) {
    if (getFeatureId(GEO_MODES.TRACT, feature) !== tractId) {
      continue;
    }

    const lng = toFiniteNumber(feature?.properties?.centroid_lon);
    const lat = toFiniteNumber(feature?.properties?.centroid_lat);
    if (lng !== null && lat !== null) {
      return [lng, lat];
    }
    return null;
  }

  return null;
}

export function getCenterLngLat(geoMode, id, ctx = {}) {
  const mode = assertGeoMode(geoMode);
  const normalizedId = normalizeId(id);

  if (!normalizedId) {
    return null;
  }

  if (mode === GEO_MODES.HEX) {
    return getHexCenterLngLat(normalizedId);
  }

  const centroidCenter = centroidFromValue(ctx.tractsCentroids?.[normalizedId]);
  if (centroidCenter) {
    return centroidCenter;
  }

  return findTractCenterInGeojson(normalizedId, ctx.tractsGeojson);
}

export function getIdsFromBrushPicks(geoMode, picks) {
  assertGeoMode(geoMode);

  if (!Array.isArray(picks)) {
    return [];
  }

  const uniqueIds = new Set();
  for (const pickInfo of picks) {
    const id = getPickedId(geoMode, pickInfo);
    if (id) {
      uniqueIds.add(id);
    }
  }

  return Array.from(uniqueIds);
}

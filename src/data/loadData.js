const singletonCache = {
  years: null,
  metadata: null,
  variables: null,
  tractGeometry: null,
};

const hexYearCache = new Map();
const tractYearCache = new Map();

function normalizeBaseUrl() {
  const rawBase = import.meta.env.BASE_URL || '/';
  return rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
}

function dataUrl(path) {
  const cleanPath = String(path).replace(/^\/+/, '');
  return `${normalizeBaseUrl()}data/${cleanPath}`;
}

async function fetchJson(path) {
  const url = dataUrl(path);
  let response;

  try {
    response = await globalThis.fetch(url);
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: network error (${error?.message ?? 'unknown'})`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function loadSingleton(cacheKey, loader) {
  if (singletonCache[cacheKey]) {
    return singletonCache[cacheKey];
  }

  const request = loader().catch((error) => {
    singletonCache[cacheKey] = null;
    throw error;
  });

  singletonCache[cacheKey] = request;
  return request;
}

function normalizeYear(year) {
  if (year === undefined || year === null || year === '') {
    throw new Error('Year is required to load year-based data.');
  }
  return String(year);
}

function loadByYear(cacheMap, year, loader) {
  const yearKey = normalizeYear(year);

  if (cacheMap.has(yearKey)) {
    return cacheMap.get(yearKey);
  }

  const request = loader(yearKey).catch((error) => {
    cacheMap.delete(yearKey);
    throw error;
  });

  cacheMap.set(yearKey, request);
  return request;
}

export async function loadYears() {
  return loadSingleton('years', () => fetchJson('years.json'));
}

export async function loadMetadata() {
  return loadSingleton('metadata', () => fetchJson('metadata.json'));
}

export async function loadVariables() {
  return loadSingleton('variables', () => fetchJson('variables.json'));
}

export async function loadHexYear(year) {
  return loadByYear(hexYearCache, year, (yearKey) => fetchJson(`hexes/${yearKey}.json`));
}

export async function loadTractGeometry() {
  return loadSingleton('tractGeometry', () => fetchJson('tracts/tracts.geojson'));
}

export async function loadTractYear(year) {
  return loadByYear(tractYearCache, year, (yearKey) => fetchJson(`tracts/${yearKey}.json`));
}

export const STORAGE_KEYS = {
  welcomeDismissed: 'san-diego-mosaic.welcome-dismissed-v1',
};

export const COPY = {
  app: {
    name: 'San Diego Mosaic',
    chooseForMePlaceholder: 'Choose for me will be wired in Milestone B.',
  },
  nav: {
    dataSources: 'Data sources',
    about: 'About',
    chooseForMe: 'Choose for me',
  },
  map: {
    placeholderTitle: 'Map goes here',
    placeholderSubtext: 'MapLibre + deck.gl overlays will be wired in Milestone B.',
  },
  legend: {
    title: 'Legend',
    toggleLabel: 'In the map',
    geoModes: [
      { id: 'hex', label: 'Hex bins' },
      { id: 'tract', label: 'Census tracts' },
    ],
    modeSubtext: {
      hex: 'Showing H3 hex bins for the active metric and year.',
      tract: 'Showing Census tracts for the active metric and year.',
    },
    bins: [
      { color: 'bg-slate-700', label: 'Low' },
      { color: 'bg-slate-600', label: 'Q2' },
      { color: 'bg-slate-500', label: 'Q3' },
      { color: 'bg-slate-400', label: 'Q4' },
      { color: 'bg-emerald-400', label: 'High' },
    ],
  },
  selectionMode: {
    title: 'Selection mode',
    options: [
      { id: 'single', label: 'Select one area' },
      { id: 'multi', label: 'Select areas' },
    ],
    helperText: {
      single: 'Click one area to inspect its demographics.',
      multi: 'Brush-select multiple areas to inspect aggregate demographics.',
    },
  },
  sidebar: {
    title: 'Metrics',
    yearLabel: 'Year',
    selectedAreaTitle: 'Selected area',
    noAreaSelected: 'No area selected.',
    placeholderValue: '--',
    years: [2019, 2020, 2021, 2022, 2023],
    groups: [
      {
        id: 'population_race',
        label: 'Population & Race',
        metrics: [
          { id: 'population_total', label: 'Total population' },
          { id: 'population_white', label: 'White population' },
          { id: 'population_black', label: 'Black population' },
          { id: 'population_asian', label: 'Asian population' },
          { id: 'population_hispanic', label: 'Hispanic population' },
          { id: 'median_age', label: 'Median age' },
        ],
      },
      {
        id: 'income_property',
        label: 'Income & Property',
        metrics: [
          { id: 'median_household_income', label: 'Median household income' },
          { id: 'median_home_value', label: 'Median home value' },
          { id: 'median_rent', label: 'Median rent' },
          { id: 'poverty_rate', label: 'Poverty rate' },
        ],
      },
      {
        id: 'employment_education',
        label: 'Employment & Education',
        metrics: [
          { id: 'ba_plus_rate', label: 'BA+ rate' },
          { id: 'employed_rate', label: 'Employed rate' },
          { id: 'work_from_home_rate', label: 'Work-from-home rate' },
        ],
      },
      {
        id: 'other_demographics',
        label: 'Other demographics',
        metrics: [
          { id: 'housing_total', label: 'Total housing units' },
          { id: 'housing_occupied', label: 'Occupied housing units' },
        ],
      },
    ],
  },
  modal: {
    close: 'Close',
  },
  welcomeModal: {
    title: 'Welcome to San Diego Mosaic',
    body: [
      'Use the geography toggle to switch between hex bins and census tracts.',
      'Pick a year and metric from the sidebar to recolor the map.',
      'Selection interactions are placeholder-only in this milestone.',
    ],
    dismiss: 'Start exploring',
  },
  aboutModal: {
    title: 'About',
    sections: [
      {
        id: 'mission',
        heading: 'What San Diego Mosaic is',
        paragraphs: [
          'San Diego Mosaic is a static, map-first census dashboard for exploring neighborhood patterns across San Diego County.',
          'The app is designed for fast interaction: users switch year, geography, and metric in-place without any backend service.',
        ],
      },
      {
        id: 'map-workflow',
        heading: 'How to use the map',
        bullets: [
          'Choose a year, then pick a metric from the sidebar to recolor the map.',
          'Switch geography between H3 hex bins and Census tracts from the legend card.',
          'Hover to inspect features, click to select one, or brush-select multiple areas.',
          'Use "Choose for me" to jump to a high/low extreme for the active metric and year.',
        ],
      },
      {
        id: 'years',
        heading: 'Year coverage',
        bullets: ['2022 (ACS 2018-2022)', '2023 (ACS 2019-2023)', '2024 (ACS 2020-2024)'],
      },
      {
        id: 'methods',
        heading: 'Geography and metric methods',
        bullets: [
          'Tract mode uses stable tract geometry with yearly values keyed by GEOID.',
          'Hex mode uses block-group-backed interpolation onto H3 resolution 8 cells.',
          'Map colors use per-year quantile breaks to keep within-year comparisons clear.',
        ],
      },
      {
        id: 'constraints',
        heading: 'Scope and constraints',
        bullets: [
          'No runtime Census API calls are made from the browser.',
          'Data are precomputed in Python and shipped as static files under public/data.',
          'This project currently targets San Diego County only.',
        ],
      },
    ],
  },
  dataSourcesModal: {
    title: 'Data sources',
    sections: [
      {
        id: 'acs',
        heading: 'American Community Survey (ACS)',
        paragraphs: [
          'Primary demographic and socioeconomic metrics are sourced from Census ACS 5-year products.',
        ],
        bullets: [
          'Detailed tables (B/C series) and subject tables (S series) are fetched in the Python pipeline.',
          'Metric recodes are defined in scripts/py/config/census_variables.json and scripts/py/config/census_recodes.json.',
        ],
      },
      {
        id: 'geometry',
        heading: 'Geographic boundaries',
        bullets: [
          'Tract and block-group boundaries are sourced from TIGER/Line products.',
          'Geometry cleanup includes water erasure and defensive filtering before export.',
          'Tract geometry is written once (stable) and reused for all years.',
        ],
      },
      {
        id: 'pipeline',
        heading: 'Precompute pipeline',
        bullets: [
          'scripts/py/build_tracts.py builds tract yearly values, geometry outputs, and metadata.',
          'scripts/py/build_hexes.py builds hex yearly values from block-group-backed interpolation.',
          'scripts/py/build_compressed_data.py emits deterministic .json.gz/.geojson.gz sidecars.',
        ],
      },
      {
        id: 'uncertainty',
        heading: 'Uncertainty and aggregation rules',
        bullets: [
          'Public MOEs are normalized to 95% confidence level in the pipeline.',
          'Aggregated sums use root-sum-square MOE handling.',
          'Derived ratio/proportion metrics use ACS-style propagation formulas.',
          'Multi-record medians are intentionally shown as N/A until distribution-based aggregation is implemented.',
        ],
      },
      {
        id: 'delivery',
        heading: 'Data delivery contract',
        bullets: [
          'Required files include years.json, variables.json, metadata.json, tracts/tracts.geojson, tracts/<YEAR>.json, and hexes/<YEAR>.json.',
          'Gzip sidecars are generated as additive assets and loaded first when supported.',
          'Plain JSON/GeoJSON files remain the compatibility fallback path.',
        ],
      },
    ],
  },
};

export function getMetricById(metricId) {
  for (const group of COPY.sidebar.groups) {
    const metric = group.metrics.find((item) => item.id === metricId);
    if (metric) {
      return metric;
    }
  }
  return null;
}

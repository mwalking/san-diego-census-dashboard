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
    body: [
      'San Diego Mosaic is a static census dashboard for exploring neighborhood-level trends.',
      'This shell milestone focuses on layout and interaction wiring before map/data integration.',
    ],
  },
  dataSourcesModal: {
    title: 'Data sources',
    body: [
      'Census and ACS values are precomputed and shipped as static files in this repository.',
      'Runtime browser requests to Census APIs are out of scope for this project.',
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

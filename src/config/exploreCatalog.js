const CURATED_EXPLORE_GROUPS = Object.freeze([
  {
    label: 'Population',
    metrics: Object.freeze([{ id: 'age_total_pop_base', label: 'Total population' }]),
  },
  {
    label: 'Income & Property',
    metrics: Object.freeze([
      { id: 'home_value_median', label: 'Median home value' },
      { id: 'poverty_rate', label: 'Poverty rate' },
    ]),
  },
  {
    label: 'Age',
    metrics: Object.freeze([
      {
        id: 'age_under_20',
        label: 'Age Under 20',
        proportionOf: 'age_total_pop_base',
      },
      { id: 'age_20_29', label: 'Age 20-29', proportionOf: 'age_total_pop_base' },
      { id: 'age_30_49', label: 'Age 30-49', proportionOf: 'age_total_pop_base' },
      { id: 'age_50_64', label: 'Age 50-64', proportionOf: 'age_total_pop_base' },
      { id: 'age_65_plus', label: 'Age 65+', proportionOf: 'age_total_pop_base' },
    ]),
  },
  {
    label: 'Race / ethnicity',
    metrics: Object.freeze([
      { id: 'race_white', label: 'White', proportionOf: 'race_total_pop_base' },
      { id: 'race_black', label: 'Black', proportionOf: 'race_total_pop_base' },
      { id: 'race_asian', label: 'Asian', proportionOf: 'race_total_pop_base' },
      { id: 'race_hispanic', label: 'Hispanic', proportionOf: 'race_total_pop_base' },
    ]),
  },
  {
    label: 'Education',
    metrics: Object.freeze([
      {
        id: 'edu_hs_or_less',
        label: 'High school or less',
        proportionOf: 'edu_total_pop_25+_base',
      },
      {
        id: 'edu_some_college',
        label: 'Some college',
        proportionOf: 'edu_total_pop_25+_base',
      },
      {
        id: 'edu_bachelors_plus',
        label: "Bachelor's+",
        proportionOf: 'edu_total_pop_25+_base',
      },
    ]),
  },
  {
    label: 'Housing occupancy / tenure',
    metrics: Object.freeze([
      {
        id: 'housing_tenure_owner_occupied',
        label: 'Owner occupied',
        proportionOf: 'housing_tenure_total_base',
      },
      {
        id: 'housing_tenure_renter_occupied',
        label: 'Renter occupied',
        proportionOf: 'housing_tenure_total_base',
      },
      {
        id: 'housing_occupancy_vacant',
        label: 'Vacant housing units',
        proportionOf: 'housing_occupancy_total_base',
      },
    ]),
  },
  {
    label: 'Home value bands',
    metrics: Object.freeze([
      {
        id: 'home_value_low_under_200k',
        label: 'Under $200k',
        proportionOf: 'home_value_total_base',
      },
      {
        id: 'home_value_moderate_200k_500k',
        label: '$200k-$500k',
        proportionOf: 'home_value_total_base',
      },
      {
        id: 'home_value_high_500k_1m',
        label: '$500k-$1M',
        proportionOf: 'home_value_total_base',
      },
      {
        id: 'home_value_luxury_1m_1_5m',
        label: '$1M-$1.5M',
        proportionOf: 'home_value_total_base',
      },
      {
        id: 'home_value_ultra_luxury_1_5m_2m',
        label: '$1.5M-$2M',
        proportionOf: 'home_value_total_base',
      },
      {
        id: 'home_value_super_luxury_2m_plus',
        label: '$2M+',
        proportionOf: 'home_value_total_base',
      },
    ]),
  },
  {
    label: 'Rent burden',
    metrics: Object.freeze([
      {
        id: 'rent_burden_affordable_under_30_percent',
        label: 'Rent burden under 30%',
        proportionOf: 'rent_burden_total_base',
      },
      {
        id: 'rent_burden_moderate_30_to_49_percent',
        label: 'Rent burden 30%-49%',
        proportionOf: 'rent_burden_total_base',
      },
      {
        id: 'rent_burden_severe_50_percent_plus',
        label: 'Rent burden 50%+',
        proportionOf: 'rent_burden_total_base',
      },
    ]),
  },
  {
    label: 'Transportation',
    metrics: Object.freeze([
      { id: 'commute_under_10min', label: 'Commute under 10 min', proportionOf: 'commute_base' },
      { id: 'commute_10_29min', label: 'Commute 10-29 min', proportionOf: 'commute_base' },
      { id: 'commute_30_59min', label: 'Commute 30-59 min', proportionOf: 'commute_base' },
      { id: 'commute_60_plus', label: 'Commute 60+ min', proportionOf: 'commute_base' },
      {
        id: 'transport_work_from_home',
        label: 'Work from home',
        proportionOf: 'transport_total_base',
      },
      {
        id: 'transport_public_transit',
        label: 'Public transit',
        proportionOf: 'transport_total_base',
      },
    ]),
  },
  {
    label: 'Internet & Language',
    metrics: Object.freeze([
      {
        id: 'internet_with_subscription',
        label: 'Internet subscription',
        proportionOf: 'internet_total_hh_base',
      },
      {
        id: 'internet_no_internet_access',
        label: 'No internet access',
        proportionOf: 'internet_total_hh_base',
      },
      {
        id: 'lang_speak_english_only',
        label: 'English only at home',
        proportionOf: 'lang_speak_base',
      },
      {
        id: 'lang_speak_spanish_low_english',
        label: 'Spanish with limited English',
        proportionOf: 'lang_speak_base',
      },
    ]),
  },
]);

export function curateExploreMetrics(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return [];
  }

  const metricsById = new Map();
  for (const metric of metrics) {
    if (!metric?.id || metricsById.has(metric.id)) {
      continue;
    }
    metricsById.set(metric.id, metric);
  }

  const curatedMetrics = [];
  const includedIds = new Set();

  for (const group of CURATED_EXPLORE_GROUPS) {
    const groupLabel = group?.label ? String(group.label) : 'Other';
    const metricRefs = Array.isArray(group?.metrics) ? group.metrics : [];
    for (const ref of metricRefs) {
      const metricId = ref?.id ? String(ref.id) : '';
      if (!metricId || includedIds.has(metricId)) {
        continue;
      }

      const metric = metricsById.get(metricId);
      if (!metric) {
        continue;
      }

      curatedMetrics.push({
        ...metric,
        group: groupLabel,
        label: ref.label ? String(ref.label) : metric.label,
        proportionOf: ref.proportionOf ? String(ref.proportionOf) : metric.proportionOf,
      });
      includedIds.add(metricId);
    }
  }

  return curatedMetrics.length > 0 ? curatedMetrics : metrics;
}

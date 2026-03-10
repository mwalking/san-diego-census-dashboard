function directMetric(id, overrides = {}) {
  return {
    id,
    type: 'direct',
    source_field: id,
    moeKey: `${id}_moe`,
    aggregation: 'sum',
    format: 'number',
    ...overrides,
  };
}

function ratioMetric(id, numerator, denominator, overrides = {}) {
  return {
    id,
    type: 'ratio',
    numerator,
    denominator,
    numeratorMoeKey: `${numerator}_moe`,
    denominatorMoeKey: `${denominator}_moe`,
    moeMethod: 'proportion',
    aggregation: 'ratio',
    format: 'percent',
    ...overrides,
  };
}

export const PROFILE_METRICS = Object.freeze({
  pop_total_population: directMetric('pop_total_population'),
  median_age: directMetric('median_age'),
  race_white_rate: ratioMetric('race_white_rate', 'race_white', 'race_total_pop_base'),
  race_black_rate: ratioMetric('race_black_rate', 'race_black', 'race_total_pop_base'),
  race_asian_rate: ratioMetric('race_asian_rate', 'race_asian', 'race_total_pop_base'),
  race_hispanic_rate: ratioMetric('race_hispanic_rate', 'race_hispanic', 'race_total_pop_base'),
  disability_rate: ratioMetric(
    'disability_rate',
    'disability_with_disability',
    'disability_total_pop_base',
  ),
  limited_english_rate: ratioMetric(
    'limited_english_rate',
    'lang_speak_spanish_low_english',
    'lang_speak_base',
  ),

  poverty_rate: ratioMetric('poverty_rate', 'poverty_below', 'poverty_universe'),
  bachelors_plus_rate: ratioMetric(
    'bachelors_plus_rate',
    'edu_bachelors_plus',
    'edu_total_pop_25+_base',
  ),
  no_internet_rate: ratioMetric(
    'no_internet_rate',
    'internet_no_internet_access',
    'internet_total_hh_base',
  ),
  median_household_income: directMetric('median_household_income', {
    format: 'currency',
    aggregation: 'median',
  }),

  home_value_median: directMetric('home_value_median', {
    format: 'currency',
    aggregation: 'median',
  }),
  median_rent: directMetric('median_rent', {
    format: 'currency',
    aggregation: 'median',
  }),
  severe_rent_burden_rate: ratioMetric(
    'severe_rent_burden_rate',
    'rent_burden_severe_50_percent_plus',
    'rent_burden_total_base',
  ),
  owner_share: ratioMetric(
    'owner_share',
    'housing_tenure_owner_occupied',
    'housing_tenure_total_base',
  ),
  renter_share: ratioMetric(
    'renter_share',
    'housing_tenure_renter_occupied',
    'housing_tenure_total_base',
  ),

  work_from_home_rate: ratioMetric(
    'work_from_home_rate',
    'transport_work_from_home',
    'transport_total_base',
  ),
  public_transit_rate: ratioMetric(
    'public_transit_rate',
    'transport_public_transit',
    'transport_total_base',
  ),
  commute_60_plus_rate: ratioMetric('commute_60_plus_rate', 'commute_60_plus', 'commute_base'),
  no_vehicle_households_rate: ratioMetric(
    'no_vehicle_households_rate',
    'tenure_vehicles_renter_no_vehicle',
    'tenure_vehicles_total_base',
  ),

  age_total_pop_base: directMetric('age_total_pop_base'),
  age_under_20: directMetric('age_under_20'),
  age_20_29: directMetric('age_20_29'),
  age_30_49: directMetric('age_30_49'),
  age_50_64: directMetric('age_50_64'),
  age_65_plus: directMetric('age_65_plus'),

  hh_income_base: directMetric('hh_income_base'),
  hh_income_less_30K: directMetric('hh_income_less_30K'),
  hh_income_30K_74K: directMetric('hh_income_30K_74K'),
  hh_income_75K_99K: directMetric('hh_income_75K_99K'),
  hh_income_100K_149K: directMetric('hh_income_100K_149K'),
  hh_income_150K_199K: directMetric('hh_income_150K_199K'),
  hh_income_200K_plus: directMetric('hh_income_200K_plus'),

  housing_year_built_total: directMetric('housing_year_built_total'),
  housing_year_built_very_new_2010_plus: directMetric('housing_year_built_very_new_2010_plus'),
  housing_year_built_new_2000_2009: directMetric('housing_year_built_new_2000_2009'),
  housing_year_built_1980_1999: directMetric('housing_year_built_1980_1999'),
  housing_year_built_1960_1979: directMetric('housing_year_built_1960_1979'),
  housing_year_built_old_pre_1960: directMetric('housing_year_built_old_pre_1960'),

  housing_units_structure_total_base: directMetric('housing_units_structure_total_base'),
  housing_units_structure_single_family: directMetric('housing_units_structure_single_family'),
  housing_units_structure_small_multi_2_to_9: directMetric(
    'housing_units_structure_small_multi_2_to_9',
  ),
  housing_units_structure_large_multi_10_plus: directMetric(
    'housing_units_structure_large_multi_10_plus',
  ),
  housing_units_structure_mobile_home: directMetric('housing_units_structure_mobile_home'),
  housing_units_structure_other: directMetric('housing_units_structure_other'),

  commute_base: directMetric('commute_base'),
  commute_under_10min: directMetric('commute_under_10min'),
  commute_10_29min: directMetric('commute_10_29min'),
  commute_30_59min: directMetric('commute_30_59min'),
  commute_60_plus: directMetric('commute_60_plus'),
});

export const PROFILE_LAYOUT = Object.freeze([
  {
    id: 'people',
    label: 'People',
    blocks: [
      {
        id: 'people-comparison',
        type: 'comparisonRows',
        rows: [
          { metricId: 'pop_total_population', label: 'Population' },
          { metricId: 'median_age', label: 'Median age' },
          { metricId: 'race_white_rate', label: 'White %' },
          { metricId: 'race_black_rate', label: 'Black %' },
          { metricId: 'race_asian_rate', label: 'Asian %' },
          { metricId: 'race_hispanic_rate', label: 'Hispanic %' },
          { metricId: 'disability_rate', label: 'Disability %' },
          { metricId: 'limited_english_rate', label: 'Limited English %' },
        ],
      },
      {
        id: 'age-distribution',
        type: 'stackedBar',
        label: 'Age distribution',
        denominatorMetricId: 'age_total_pop_base',
        segments: [
          { metricId: 'age_under_20', label: 'Under 20' },
          { metricId: 'age_20_29', label: '20-29' },
          { metricId: 'age_30_49', label: '30-49' },
          { metricId: 'age_50_64', label: '50-64' },
          { metricId: 'age_65_plus', label: '65+' },
        ],
      },
    ],
  },
  {
    id: 'economic',
    label: 'Economic conditions',
    blocks: [
      {
        id: 'economic-comparison',
        type: 'comparisonRows',
        rows: [
          { metricId: 'poverty_rate', label: 'Poverty rate' },
          { metricId: 'bachelors_plus_rate', label: "Bachelor's+" },
          { metricId: 'no_internet_rate', label: 'No internet access' },
          { metricId: 'median_household_income', label: 'Median household income' },
        ],
      },
      {
        id: 'income-distribution',
        type: 'stackedBar',
        label: 'Household income distribution',
        denominatorMetricId: 'hh_income_base',
        segments: [
          { metricId: 'hh_income_less_30K', label: '<$30k' },
          { metricId: 'hh_income_30K_74K', label: '$30k-$74k' },
          { metricId: 'hh_income_75K_99K', label: '$75k-$99k' },
          { metricId: 'hh_income_100K_149K', label: '$100k-$149k' },
          { metricId: 'hh_income_150K_199K', label: '$150k-$199k' },
          { metricId: 'hh_income_200K_plus', label: '$200k+' },
        ],
      },
    ],
  },
  {
    id: 'housing',
    label: 'Housing',
    blocks: [
      {
        id: 'housing-comparison',
        type: 'comparisonRows',
        rows: [
          { metricId: 'home_value_median', label: 'Median home value' },
          { metricId: 'median_rent', label: 'Median rent' },
          { metricId: 'severe_rent_burden_rate', label: 'Severe rent burden' },
          { metricId: 'owner_share', label: 'Owner share' },
          { metricId: 'renter_share', label: 'Renter share' },
        ],
      },
      {
        id: 'year-built-distribution',
        type: 'stackedBar',
        label: 'Housing year built',
        denominatorMetricId: 'housing_year_built_total',
        segments: [
          { metricId: 'housing_year_built_very_new_2010_plus', label: '2010+' },
          { metricId: 'housing_year_built_new_2000_2009', label: '2000-2009' },
          { metricId: 'housing_year_built_1980_1999', label: '1980-1999' },
          { metricId: 'housing_year_built_1960_1979', label: '1960-1979' },
          { metricId: 'housing_year_built_old_pre_1960', label: 'Pre-1960' },
        ],
      },
      {
        id: 'housing-structure-distribution',
        type: 'stackedBar',
        label: 'Housing structure',
        denominatorMetricId: 'housing_units_structure_total_base',
        segments: [
          { metricId: 'housing_units_structure_single_family', label: 'Single family' },
          { metricId: 'housing_units_structure_small_multi_2_to_9', label: '2-9 units' },
          { metricId: 'housing_units_structure_large_multi_10_plus', label: '10+ units' },
          { metricId: 'housing_units_structure_mobile_home', label: 'Mobile home' },
          { metricId: 'housing_units_structure_other', label: 'Other' },
        ],
      },
    ],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    blocks: [
      {
        id: 'mobility-comparison',
        type: 'comparisonRows',
        rows: [
          { metricId: 'work_from_home_rate', label: 'Work from home' },
          { metricId: 'public_transit_rate', label: 'Public transit' },
          { metricId: 'commute_60_plus_rate', label: '60+ minute commute' },
          { metricId: 'no_vehicle_households_rate', label: 'No-vehicle households' },
        ],
      },
      {
        id: 'commute-distribution',
        type: 'stackedBar',
        label: 'Commute time distribution',
        denominatorMetricId: 'commute_base',
        segments: [
          { metricId: 'commute_under_10min', label: '<10 min' },
          { metricId: 'commute_10_29min', label: '10-29 min' },
          { metricId: 'commute_30_59min', label: '30-59 min' },
          { metricId: 'commute_60_plus', label: '60+ min' },
        ],
      },
    ],
  },
]);

const metricIds = new Set();
for (const section of PROFILE_LAYOUT) {
  for (const block of section.blocks ?? []) {
    if (Array.isArray(block.metricIds)) {
      for (const metricId of block.metricIds) {
        metricIds.add(metricId);
      }
    }
    if (Array.isArray(block.rows)) {
      for (const row of block.rows) {
        metricIds.add(row.metricId);
      }
    }
    if (block.denominatorMetricId) {
      metricIds.add(block.denominatorMetricId);
    }
    if (Array.isArray(block.segments)) {
      for (const segment of block.segments) {
        metricIds.add(segment.metricId);
      }
    }
  }
}

export const PROFILE_LAYOUT_METRIC_IDS = Object.freeze(Array.from(metricIds));

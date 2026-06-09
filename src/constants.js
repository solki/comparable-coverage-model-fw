export const SOURCE_DATASET_ALIAS = 'sourceMetrics';

export const COLLECTIONS = {
  metricWeekOverrides: 'ccm_metric_week_overrides',
  selectedScopeMask: 'ccm_selected_scope_mask',
  fullMask: 'ccm_full_mask',
  generationRuns: 'ccm_generation_runs'
};

export const ALGORITHM_VERSION = 'phase1.0';
export const SOURCE_LABEL = 'ccm_phase1_app';

export const FLAGS = {
  yes: 'Y',
  no: 'N'
};

export const COMPARISON_SIDE = {
  current: 'current',
  prior: 'prior'
};

export const REASON_CODES = {
  included: 'INCLUDED',
  manualExcluded: 'MANUAL_EXCLUDED',
  storeMetricWeekPropagated: 'STORE_METRIC_WEEK_PROPAGATED_EXCLUSION',
  pairedSlotExcluded: 'PAIRED_SLOT_EXCLUSION',
  week53Excluded: 'WEEK_53_EXCLUDED',
  missingCommencementDate: 'MISSING_COMMENCEMENT_DATE',
  commencedTooLate: 'COMMENCED_TOO_LATE',
  closedBeforePeriodEnd: 'CLOSED_BEFORE_PERIOD_END',
  invalidCommencementDate: 'INVALID_COMMENCEMENT_DATE',
  invalidClosureDate: 'INVALID_CLOSURE_DATE',
  invalidPeriodDates: 'INVALID_PERIOD_DATES'
};

export const PERIOD_TYPES = {
  lastWeek: 'Last Week',
  lastMonth: 'Last Month',
  lastQuarter: 'Last Quarter',
  yearToDate: 'Year to Date'
};

export const PERIOD_LABELS = {
  [PERIOD_TYPES.lastWeek]: {
    current: 'Last Week',
    prior: '2 Weeks Ago'
  },
  [PERIOD_TYPES.lastMonth]: {
    current: 'Last Month',
    prior: 'Month Before'
  },
  [PERIOD_TYPES.lastQuarter]: {
    current: 'Last Quarter',
    prior: 'Quarter Before'
  },
  [PERIOD_TYPES.yearToDate]: {
    current: 'YTD',
    prior: 'Prior YTD'
  }
};

export const SOURCE_REQUIRED_FIELDS = [
  'Date',
  'Week Ending',
  'Metric',
  'Value',
  'Store Code',
  'Store Name',
  'Region',
  'Month of Year',
  'Week Of Year',
  'Financial Year',
  'FC Current FY Flag',
  'FC Current Month Flag',
  'FC Last Month Flag',
  'FC Last FY Flag',
  'FC YTD Flag',
  'Store Trading Commencement date',
  'Store Closure Date'
];

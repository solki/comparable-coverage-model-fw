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
  unpairedPeriodWeek: 'UNPAIRED_PERIOD_WEEK',
  week53Excluded: 'WEEK_53_EXCLUDED',
  missingCommencementDate: 'MISSING_COMMENCEMENT_DATE',
  commencedTooLate: 'COMMENCED_TOO_LATE',
  closedBeforePeriodEnd: 'CLOSED_BEFORE_PERIOD_END',
  invalidCommencementDate: 'INVALID_COMMENCEMENT_DATE',
  invalidClosureDate: 'INVALID_CLOSURE_DATE',
  invalidPeriodDates: 'INVALID_PERIOD_DATES'
};

export const PERIOD_TYPES = {
  lastCompletedWeek: 'Last Completed Week',
  lastCompletedMonth: 'Last Completed Month',
  lastCompletedQuarter: 'Last Completed Quarter',
  yearToDate: 'Year To Date',
  quarterToDate: 'Quarter To Date',
  monthToDate: 'Month To Date'
};

export const COMPARISON_MODES = {
  previousPeriod: 'Previous Period',
  samePeriodLastYear: 'Same Period Last Year'
};

export const PERIOD_COMPARISON_MODES = {
  [PERIOD_TYPES.lastCompletedWeek]: COMPARISON_MODES.previousPeriod,
  [PERIOD_TYPES.lastCompletedMonth]: COMPARISON_MODES.previousPeriod,
  [PERIOD_TYPES.lastCompletedQuarter]: COMPARISON_MODES.previousPeriod,
  [PERIOD_TYPES.yearToDate]: COMPARISON_MODES.samePeriodLastYear,
  [PERIOD_TYPES.quarterToDate]: COMPARISON_MODES.samePeriodLastYear,
  [PERIOD_TYPES.monthToDate]: COMPARISON_MODES.samePeriodLastYear
};

export const PERIOD_LABELS = {
  [PERIOD_TYPES.lastCompletedWeek]: {
    current: 'Last Completed Week',
    prior: 'Previous Week'
  },
  [PERIOD_TYPES.lastCompletedMonth]: {
    current: 'Last Completed Month',
    prior: 'Previous Month'
  },
  [PERIOD_TYPES.lastCompletedQuarter]: {
    current: 'Last Completed Quarter',
    prior: 'Previous Quarter'
  },
  [PERIOD_TYPES.yearToDate]: {
    current: 'YTD',
    prior: 'Prior Year YTD'
  },
  [PERIOD_TYPES.quarterToDate]: {
    current: 'QTD',
    prior: 'Prior Year QTD'
  },
  [PERIOD_TYPES.monthToDate]: {
    current: 'MTD',
    prior: 'Prior Year MTD'
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

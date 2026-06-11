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

export const CCM_LAYERS = [
  {
    id: 'calendar',
    name: 'Calendar Layer / Time Truth',
    description: 'Defines fiscal periods, comparison windows, comparison sides, and comparable slots.',
    flagField: null,
    reasonField: null,
    produces: ['period_type', 'comparison_side', 'comparable_week_slot', 'comparison_window_id']
  },
  {
    id: 'trading',
    name: 'Trading Expectation / Operational Truth',
    description: 'Determines whether a store was expected to trade in a given store-week.',
    flagField: 'system_include_flag',
    reasonField: 'system_reason_code',
    produces: ['system_include_flag', 'system_reason_code']
  },
  {
    id: 'metricCoverage',
    name: 'Metric Coverage / Data Truth',
    description: 'Indicates whether metric data exists for a store-metric-week. This is a transparency layer — missing data is a warning, not a blocking exclusion.',
    flagField: 'source_data_exists',
    reasonField: null,
    produces: ['source_data_exists', 'source_row_count', 'source_value']
  },
  {
    id: 'comparableCoverage',
    name: 'Comparable Coverage Model / Comparability Truth',
    description: 'Combines trading expectation, manual overrides, slot completeness, and paired propagation into the final LFL inclusion decision.',
    flagField: 'mask_include_flag',
    reasonField: 'final_reason_code',
    produces: ['manual_include_flag', 'is_manual_override', 'paired_slot_include_flag', 'final_include_flag', 'mask_include_flag', 'final_reason_code']
  },
  {
    id: 'presentation',
    name: 'Dashboards & Consumption / Presentation',
    description: 'Defines how the CCM mask is consumed. LFL ON filters to mask_include_flag = Y. LFL OFF is inclusive (no mask filter).',
    flagField: null,
    reasonField: null,
    produces: ['L4L ON filter: mask_include_flag = Y', 'L4L OFF: inclusive view']
  }
];

export const LAYER_STAGE_IDS = {
  calendar: 'calendar',
  trading: 'trading',
  metricCoverage: 'metricCoverage',
  comparableCoverage: 'comparableCoverage',
  presentation: 'presentation'
};

export const LAYER_CONFIG = [
  {
    id: LAYER_STAGE_IDS.calendar,
    num: 1,
    title: 'Calendar Layer',
    subtitle: 'Time Truth',
    icon: 'C',
    color: '#6cb1ff',
    borderColor: 'rgba(108,177,255,0.5)',
    bgColor: 'rgba(108,177,255,0.08)',
    question: 'Which time units belong to which time periods?',
    oneLiner: 'Defines fiscal periods, comparison windows, and comparable slots.',
    outputs: ['period_type', 'comparison_side', 'comparable_week_slot', 'comparison_window_id']
  },
  {
    id: LAYER_STAGE_IDS.trading,
    num: 2,
    title: 'Trading Expectation',
    subtitle: 'Operational Truth',
    icon: 'T',
    color: '#5ad6a8',
    borderColor: 'rgba(90,214,168,0.5)',
    bgColor: 'rgba(90,214,168,0.08)',
    question: 'Was this store expected to be trading during this week?',
    oneLiner: 'Determines whether a store should have been operating during a given week.',
    outputs: ['system_include_flag', 'system_reason_code']
  },
  {
    id: LAYER_STAGE_IDS.metricCoverage,
    num: 3,
    title: 'Metric Coverage',
    subtitle: 'Data Truth',
    icon: 'M',
    color: '#a78bfa',
    borderColor: 'rgba(167,139,250,0.5)',
    bgColor: 'rgba(167,139,250,0.08)',
    question: 'Was this metric complete and valid for this store during this week?',
    oneLiner: 'Indicates whether metric data exists for a store-metric-week.',
    outputs: ['source_data_exists', 'source_row_count', 'source_value']
  },
  {
    id: LAYER_STAGE_IDS.comparableCoverage,
    num: 4,
    title: 'Comparable Coverage',
    subtitle: 'Comparability Truth',
    icon: '★',
    color: '#f5b971',
    borderColor: 'rgba(245,185,113,0.5)',
    bgColor: 'rgba(245,185,113,0.08)',
    question: 'Is it valid to compare this store and metric across the selected time range?',
    oneLiner: 'Combines trading expectation, overrides, and slot completeness into final LFL inclusion.',
    outputs: ['manual_include_flag', 'paired_slot_include_flag', 'final_include_flag', 'mask_include_flag', 'final_reason_code']
  },
  {
    id: LAYER_STAGE_IDS.presentation,
    num: 5,
    title: 'Dashboards & Consumption',
    subtitle: 'Presentation',
    icon: 'D',
    color: '#ef6b75',
    borderColor: 'rgba(239,107,117,0.5)',
    bgColor: 'rgba(239,107,117,0.08)',
    question: 'How do users interact with the governed dataset?',
    oneLiner: 'Consumes the CCM mask via LFL ON/OFF filters for dashboard reporting.',
    outputs: ['L4L ON: mask_include_flag = Y', 'L4L OFF: inclusive view']
  }
];

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

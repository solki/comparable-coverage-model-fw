import { FLAGS } from './constants.js';
import { cleanString, maxDate, minDate, normalizeDate } from './dateUtils.js';
import { profileSourceRows } from './sourceProfiler.js';

export function computeGlobalDatasetOverview(sourceRows, profile = null) {
  if (profile) {
    return {
      source_row_count: Number(profile.source_row_count || 0),
      store_count: Number(profile.store_count || 0),
      week_count: Number(profile.week_count || 0),
      metric_count: Number(profile.metric_count || 0),
      min_week_ending: profile.min_week_ending || null,
      max_week_ending: profile.max_week_ending || null,
      stores_missing_commencement_date: Number(profile.stores_missing_commencement_date || 0),
      stores_with_closure_date: Number(profile.stores_with_closure_date || 0),
      date_parsing_warnings: profile.date_parsing_warnings ?? 0
    };
  }

  const derived = profileSourceRows(Array.isArray(sourceRows) ? sourceRows : []);
  return {
    source_row_count: derived.source_row_count,
    store_count: derived.store_count,
    week_count: derived.week_count,
    metric_count: derived.metric_count,
    min_week_ending: derived.min_week_ending,
    max_week_ending: derived.max_week_ending,
    stores_missing_commencement_date: derived.stores_missing_commencement_date,
    stores_with_closure_date: derived.stores_with_closure_date,
    date_parsing_warnings: derived.date_parsing_warnings
  };
}

export function computeSelectedScopeSummary({
  sourceRows = [],
  sourceFacts = null,
  selectedStore = null,
  selectedMetric = '',
  selectedPeriodType = '',
  periodRows = [],
  manualOverrides = [],
  maskRows = []
} = {}) {
  const storeCode = selectedStore?.store_code || '';
  const scopedPeriodRows = periodRows.filter((row) => !selectedPeriodType || row.period_type === selectedPeriodType);
  const scopedFacts = matchingSourceFacts({
    sourceRows,
    sourceFacts,
    storeCode,
    metric: selectedMetric,
    weekEndings: unique(scopedPeriodRows.map((row) => row.week_ending))
  });
  const scopedMaskRows = matchingMaskRows(maskRows, storeCode, selectedMetric, selectedPeriodType);
  const periodWeeks = unique(scopedPeriodRows.map((row) => normalizeDate(row.week_ending)).filter(Boolean));
  const factWeeks = new Set(scopedFacts.map((fact) => normalizeDate(fact.week_ending)).filter(Boolean));

  return {
    selected_period_type: selectedPeriodType || '',
    scoped_source_row_count: sumSourceRowCounts(scopedFacts),
    scoped_store_count: storeCode ? 1 : 0,
    scoped_metric_count: selectedMetric ? 1 : 0,
    current_side_week_count: countPeriodSide(scopedPeriodRows, 'current'),
    prior_side_week_count: countPeriodSide(scopedPeriodRows, 'prior'),
    scoped_min_week_ending: minDate(scopedPeriodRows.map((row) => row.week_ending)),
    scoped_max_week_ending: maxDate(scopedPeriodRows.map((row) => row.week_ending)),
    missing_commencement_count: selectedStoreMissingCommencement(selectedStore) ? 1 : 0,
    selected_store_closure_status: selectedStoreClosureStatus(selectedStore),
    source_rows_available: sumSourceRowCounts(scopedFacts),
    source_week_count_available: factWeeks.size,
    weekly_coverage_record_count: factWeeks.size,
    missing_source_week_count: periodWeeks.filter((weekEnding) => !factWeeks.has(weekEnding)).length,
    active_manual_override_count: countActiveOverrides({
      manualOverrides,
      storeCode,
      metric: selectedMetric,
      weekEndings: periodWeeks
    }),
    system_excluded_week_count: scopedMaskRows.filter((row) => row.system_include_flag === FLAGS.no).length,
    final_included_rows: scopedMaskRows.filter((row) => finalIncludeFlag(row) === FLAGS.yes).length,
    final_excluded_rows: scopedMaskRows.filter((row) => finalIncludeFlag(row) === FLAGS.no).length
  };
}

export function getSourceFactForScope({ sourceRows = [], sourceFacts = null, storeCode = '', metric = '', weekEnding = '' } = {}) {
  const facts = matchingSourceFacts({
    sourceRows,
    sourceFacts,
    storeCode,
    metric,
    weekEndings: [weekEnding]
  });

  if (!facts.length) return hasSourceFactShape(sourceRows, sourceFacts) ? nullFact() : null;

  return {
    source_value: facts.reduce((total, fact) => total + Number(fact.source_value || 0), 0),
    source_row_count: sumSourceRowCounts(facts),
    source_data_exists: FLAGS.yes
  };
}

function matchingSourceFacts({ sourceRows, sourceFacts, storeCode, metric, weekEndings }) {
  const normalizedWeekEndings = new Set(weekEndings.map(normalizeDate).filter(Boolean));
  if (!storeCode || !metric || normalizedWeekEndings.size === 0) return [];

  return normalizeSourceFacts(sourceFacts || sourceRows)
    .filter((fact) => (
      fact.store_code === storeCode
      && fact.metric === metric
      && normalizedWeekEndings.has(normalizeDate(fact.week_ending))
    ));
}

function normalizeSourceFacts(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      store_code: cleanString(row.store_code ?? row['Store Code']),
      metric: cleanString(row.metric ?? row.Metric),
      week_ending: normalizeDate(row.week_ending ?? row['Week Ending']),
      source_value: Number(row.source_value ?? row.Value ?? 0),
      source_row_count: Number(row.source_row_count ?? 1),
      source_data_exists: row.source_data_exists || FLAGS.yes
    }))
    .filter((row) => row.store_code && row.metric && row.week_ending);
}

function matchingMaskRows(maskRows, storeCode, metric, periodType) {
  return (Array.isArray(maskRows) ? maskRows : []).filter((row) => (
    (!storeCode || row.store_code === storeCode)
    && (!metric || row.metric === metric)
    && (!periodType || row.period_type === periodType)
  ));
}

function selectedStoreMissingCommencement(store) {
  if (!store) return false;
  return !cleanString(store.store_trading_commencement_date ?? store['Store Trading Commencement date']);
}

function selectedStoreClosureStatus(store) {
  if (!store) return 'No store selected';
  const closureDate = cleanString(store.store_closure_date ?? store['Store Closure Date']);
  return closureDate ? `Closure date ${closureDate}` : 'No closure date';
}

function countPeriodSide(rows, side) {
  return rows.filter((row) => row.comparison_side === side).length;
}

function countActiveOverrides({ manualOverrides, storeCode, metric, weekEndings }) {
  const weekSet = new Set(weekEndings);
  return (Array.isArray(manualOverrides) ? manualOverrides : []).filter((override) => (
    override.store_code === storeCode
    && override.metric === metric
    && weekSet.has(normalizeDate(override.week_ending))
    && override.active_flag !== FLAGS.no
  )).length;
}

function sumSourceRowCounts(facts) {
  return facts.reduce((total, fact) => total + Number(fact.source_row_count || 0), 0);
}

function finalIncludeFlag(row) {
  return row.final_include_flag || row.mask_include_flag;
}

function hasSourceFactShape(sourceRows, sourceFacts) {
  return Boolean(sourceFacts)
    || (Array.isArray(sourceRows) && sourceRows.some((row) => (
      row.store_code
      || row['Store Code']
      || row.metric
      || row.Metric
      || row.Value !== undefined
      || row.source_value !== undefined
    )));
}

function nullFact() {
  return {
    source_value: null,
    source_row_count: 0,
    source_data_exists: FLAGS.no
  };
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

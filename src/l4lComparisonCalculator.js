import { getMetricDisplayName } from './metricDisplay.js';

const YES = 'Y';
const NO = 'N';

export function getRowsForCoverageMode(rows, { comparableCoverageOn = true } = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (!comparableCoverageOn) return sourceRows;
  return sourceRows.filter((row) => normalizeFlag(row.mask_include_flag) === YES);
}

export function calculateComparisonSummary(rows, { comparableCoverageOn = true } = {}) {
  const filteredRows = getRowsForCoverageMode(rows, { comparableCoverageOn });
  const currentRows = filteredRows.filter((row) => isCurrent(row));
  const priorRows = filteredRows.filter((row) => isPrior(row));
  const currentValue = sumNumeric(currentRows, 'source_value');
  const priorValue = sumNumeric(priorRows, 'source_value');
  const absoluteVariance = currentValue - priorValue;
  const sourceRecordsMatched = sumNumeric(filteredRows, 'source_row_count');
  const weeksWithoutSourceData = filteredRows.filter((row) => numeric(row.source_row_count) <= 0).length;
  const percentChange = priorValue === 0 ? null : absoluteVariance / Math.abs(priorValue);

  return {
    comparable_coverage_on: comparableCoverageOn,
    row_count: filteredRows.length,
    current_value: currentValue,
    prior_value: priorValue,
    absolute_variance: absoluteVariance,
    percent_change: percentChange,
    percent_change_display: formatPercentChange(percentChange),
    included_current_weeks: currentRows.length,
    included_prior_weeks: priorRows.length,
    weeks_without_source_data: weeksWithoutSourceData,
    source_records_matched: sourceRecordsMatched,
    comparison_status: getComparisonStatus({ currentValue, priorValue, currentWeeks: currentRows.length, priorWeeks: priorRows.length })
  };
}

export function getExcludedWeeks(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => normalizeFlag(row.mask_include_flag) === NO);
}

export function inferComparisonContext(rows) {
  const row = (Array.isArray(rows) ? rows : []).find(Boolean) || {};
  return {
    store_code: row.store_code || '',
    store_name: row.store_name || '',
    region: row.region || '',
    metric: row.metric || '',
    metric_display_name: getMetricDisplayName(row.metric),
    period_type: row.period_type || '',
    period_label_current: row.period_label_current || '',
    period_label_prior: row.period_label_prior || ''
  };
}

export function formatNumber(value) {
  return numeric(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatSignedNumber(value) {
  const number = numeric(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${formatNumber(number)}`;
}

export function formatPercentChange(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'N/A';
  const percent = Number(value) * 100;
  const prefix = percent > 0 ? '+' : '';
  return `${prefix}${percent.toFixed(1)}%`;
}

function getComparisonStatus({ currentValue, priorValue, currentWeeks, priorWeeks }) {
  if (priorValue === 0 && currentValue !== 0) return 'PRIOR_ZERO';
  if (priorValue === 0 && currentValue === 0) return 'BOTH_ZERO';
  if (currentWeeks !== priorWeeks) return 'WEEK_COUNT_MISMATCH';
  return 'OK';
}

function sumNumeric(rows, fieldName) {
  return rows.reduce((total, row) => total + numeric(row[fieldName]), 0);
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isCurrent(row) {
  return String(row.comparison_side || '').toLowerCase() === 'current';
}

function isPrior(row) {
  return String(row.comparison_side || '').toLowerCase() === 'prior';
}

function normalizeFlag(value) {
  return String(value || '').trim().toUpperCase();
}

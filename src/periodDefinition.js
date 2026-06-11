import {
  COMPARISON_SIDE,
  FLAGS,
  PERIOD_COMPARISON_MODES,
  PERIOD_LABELS,
  PERIOD_TYPES
} from './constants.js';
import { addDays, cleanString, maxDate, minDate, normalizeDate, subtractDays } from './dateUtils.js';

const FISCAL_WEEKS_PER_QUARTER = 13;

export function deriveRuntimePeriodDefinitions(sourceRows) {
  const rows = Array.isArray(sourceRows) ? sourceRows : [];
  const definitions = [
    ...deriveLastCompletedWeek(rows),
    ...deriveLastCompletedMonth(rows),
    ...deriveLastCompletedQuarter(rows),
    ...deriveYearToDate(rows),
    ...deriveQuarterToDate(rows),
    ...deriveMonthToDate(rows)
  ];

  return definitions.map((definition, index) => ({
    ...definition,
    display_order: index + 1
  }));
}

export const deriveDefaultPeriodDefinitions = deriveRuntimePeriodDefinitions;

export function validatePeriodDefinitions(periodRows) {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (const row of periodRows.filter((item) => item.active_flag !== FLAGS.no)) {
    const key = [row.period_type, row.comparison_side, row.comparable_week_slot, row.week_ending].join('|');
    if (seen.has(key)) errors.push({ type: 'duplicate_period_week', key });
    seen.add(key);

    if (![COMPARISON_SIDE.current, COMPARISON_SIDE.prior].includes(row.comparison_side)) {
      errors.push({ type: 'invalid_comparison_side', key });
    }

    if (!row.week_ending) warnings.push({ type: 'missing_week_ending', key });
  }

  return { valid: errors.length === 0, errors, warnings };
}

function deriveLastCompletedWeek(rows) {
  const currentFyRows = currentFiscalRows(rows);
  const targetWeek = targetCompletedWeek(rows);
  const currentRows = currentFyRows.filter((row) => numberValue(row['Week Of Year']) === targetWeek);
  const priorRows = currentFyRows.filter((row) => numberValue(row['Week Of Year']) === targetWeek - 1);
  return rowsToDefinitions(PERIOD_TYPES.lastCompletedWeek, currentRows, priorRows);
}

function deriveLastCompletedMonth(rows) {
  const lastMonthRows = rows.filter((row) => isYes(row['FC Last Month Flag']));
  const currentMonth = maxNumber(lastMonthRows.map((row) => row['Month of Year']));
  const currentRows = selectRowsForMonths(rows, [currentMonth], { preferCurrentFy: true });
  const priorRows = selectRowsForMonths(rows, [previousFiscalMonth(currentMonth, 1)], { preferCurrentFy: true });
  return rowsToDefinitions(PERIOD_TYPES.lastCompletedMonth, currentRows, priorRows);
}

function deriveLastCompletedQuarter(rows) {
  const currentFyRows = currentFiscalRows(rows);
  const targetWeek = targetCompletedWeek(rows);
  const currentStartWeek = targetWeek - FISCAL_WEEKS_PER_QUARTER + 1;
  const priorEndWeek = currentStartWeek - 1;
  const priorStartWeek = priorEndWeek - FISCAL_WEEKS_PER_QUARTER + 1;

  const currentRows = rowsBetweenWeeks(currentFyRows, currentStartWeek, targetWeek);
  const priorRows = rowsBetweenWeeks(currentFyRows, priorStartWeek, priorEndWeek);
  return rowsToDefinitions(PERIOD_TYPES.lastCompletedQuarter, currentRows, priorRows);
}

function deriveYearToDate(rows) {
  const targetWeek = targetCompletedWeek(rows);
  const currentRows = rowsBetweenWeeks(currentFiscalRows(rows), 1, targetWeek);
  const priorRows = rowsBetweenWeeks(lastFiscalRows(rows), 1, targetWeek);
  return rowsToDefinitions(PERIOD_TYPES.yearToDate, currentRows, priorRows);
}

function deriveQuarterToDate(rows) {
  const targetWeek = targetCompletedWeek(rows);
  const quarterStartWeek = quarterStartForWeek(targetWeek);
  const currentRows = rowsBetweenWeeks(currentFiscalRows(rows), quarterStartWeek, targetWeek);
  const priorRows = rowsBetweenWeeks(lastFiscalRows(rows), quarterStartWeek, targetWeek);
  return rowsToDefinitions(PERIOD_TYPES.quarterToDate, currentRows, priorRows);
}

function deriveMonthToDate(rows) {
  const targetWeek = targetCompletedWeek(rows);
  const currentMonthRows = rows.filter((row) => isYes(row['FC Current Month Flag']));
  const currentMonth = maxNumber(currentMonthRows.map((row) => row['Month of Year']));
  const currentRows = currentFiscalRows(rows)
    .filter((row) => numberValue(row['Month of Year']) === currentMonth)
    .filter((row) => numberValue(row['Week Of Year']) <= targetWeek);
  const priorRows = lastFiscalRows(rows)
    .filter((row) => numberValue(row['Month of Year']) === currentMonth)
    .filter((row) => numberValue(row['Week Of Year']) <= targetWeek);
  return rowsToDefinitions(PERIOD_TYPES.monthToDate, currentRows, priorRows);
}

function rowsToDefinitions(periodType, currentRows, priorRows) {
  const currentUnique = uniqueWeeks(currentRows);
  const priorUnique = uniqueWeeks(priorRows);
  const currentBounds = boundsForRows(currentUnique);
  const priorBounds = boundsForRows(priorUnique);
  const labels = PERIOD_LABELS[periodType];

  const currentDefinitions = currentUnique.map((row, index) => buildDefinition({
    periodType,
    labels,
    comparisonSide: COMPARISON_SIDE.current,
    comparableWeekSlot: index + 1,
    row,
    currentBounds,
    priorBounds
  }));

  const priorDefinitions = priorUnique.map((row, index) => buildDefinition({
    periodType,
    labels,
    comparisonSide: COMPARISON_SIDE.prior,
    comparableWeekSlot: index + 1,
    row,
    currentBounds,
    priorBounds
  }));

  return [...currentDefinitions, ...priorDefinitions];
}

function buildDefinition({ periodType, labels, comparisonSide, comparableWeekSlot, row, currentBounds, priorBounds }) {
  const weekEnding = normalizeDate(row['Week Ending']);
  const comparisonMode = PERIOD_COMPARISON_MODES[periodType];
  const weekOfYear = numberValue(row['Week Of Year']);
  return {
    id: `${periodType}_${comparisonSide}_${comparableWeekSlot}_${weekEnding}`,
    comparison_window_id: comparisonWindowId(periodType, comparisonMode),
    period_type: periodType,
    period_lens: periodType,
    comparison_mode: comparisonMode,
    history_offset: 1,
    period_label_current: labels.current,
    period_label_prior: labels.prior,
    comparison_side: comparisonSide,
    comparable_week_slot: comparableWeekSlot,
    comparable_slot: comparableWeekSlot,
    week_ending: weekEnding,
    week_of_year: weekOfYear,
    fiscal_week: weekOfYear,
    month_of_year: numberValue(row['Month of Year']),
    financial_year: cleanString(row['Financial Year']),
    current_period_start_date: currentBounds.start,
    current_period_end_date: currentBounds.end,
    prior_period_start_date: priorBounds.start,
    prior_period_end_date: priorBounds.end,
    display_order: 0
  };
}

function boundsForRows(rows) {
  const weekEndings = rows.map((row) => row['Week Ending']).filter(Boolean);
  const end = maxDate(weekEndings);
  const firstEnding = minDate(weekEndings);
  return {
    start: firstEnding ? subtractDays(firstEnding, 6) : null,
    end: end ? addDays(end, 0) : null
  };
}

function uniqueWeeks(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = normalizeDate(row['Week Ending']);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique.sort((a, b) => normalizeDate(a['Week Ending']).localeCompare(normalizeDate(b['Week Ending'])));
}

function selectRowsForMonths(rows, months, { preferCurrentFy = false } = {}) {
  const selected = [];
  for (const month of months) {
    const monthRows = rows.filter((row) => numberValue(row['Month of Year']) === month);
    const currentRows = monthRows.filter((row) => isYes(row['FC Current FY Flag']));
    const lastRows = monthRows.filter((row) => isYes(row['FC Last FY Flag']));
    selected.push(...(preferCurrentFy && currentRows.length ? currentRows : lastRows.length ? lastRows : currentRows));
  }

  return selected.sort((a, b) => normalizeDate(a['Week Ending']).localeCompare(normalizeDate(b['Week Ending'])));
}

function rowsBetweenWeeks(rows, startWeek, endWeek) {
  return rows
    .filter((row) => numberValue(row['Week Of Year']) >= startWeek && numberValue(row['Week Of Year']) <= endWeek)
    .sort((a, b) => normalizeDate(a['Week Ending']).localeCompare(normalizeDate(b['Week Ending'])));
}

function currentFiscalRows(rows) {
  return rows.filter((row) => isYes(row['FC Current FY Flag']));
}

function lastFiscalRows(rows) {
  return rows.filter((row) => isYes(row['FC Last FY Flag']));
}

function targetCompletedWeek(rows) {
  return maxNumber(currentFiscalRows(rows).map((row) => row['Week Of Year'])) - 1;
}

function quarterStartForWeek(week) {
  const normalized = numberValue(week);
  return Math.floor((normalized - 1) / FISCAL_WEEKS_PER_QUARTER) * FISCAL_WEEKS_PER_QUARTER + 1;
}

function previousFiscalMonth(month, offset) {
  const normalized = numberValue(month);
  return ((normalized - offset - 1 + 12) % 12) + 1;
}

function comparisonWindowId(periodType, comparisonMode) {
  return [periodType, comparisonMode]
    .map((value) => cleanString(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
    .filter(Boolean)
    .join('__');
}

function maxNumber(values) {
  const numbers = values.map(numberValue).filter((value) => Number.isFinite(value));
  return numbers.length ? Math.max(...numbers) : 0;
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isYes(value) {
  return cleanString(value).toUpperCase() === FLAGS.yes;
}

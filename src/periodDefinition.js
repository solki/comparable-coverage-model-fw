import { COMPARISON_SIDE, FLAGS, PERIOD_LABELS, PERIOD_TYPES } from './constants.js';
import { addDays, cleanString, maxDate, minDate, normalizeDate, subtractDays } from './dateUtils.js';

export function deriveRuntimePeriodDefinitions(sourceRows) {
  const rows = Array.isArray(sourceRows) ? sourceRows : [];
  const definitions = [
    ...deriveLastWeek(rows),
    ...deriveLastMonth(rows),
    ...deriveLastQuarter(rows),
    ...deriveYearToDate(rows)
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

function deriveLastWeek(rows) {
  const currentFyRows = rows.filter((row) => isYes(row['FC Current FY Flag']));
  const maxWeek = maxNumber(currentFyRows.map((row) => row['Week Of Year']));
  const currentRows = currentFyRows.filter((row) => numberValue(row['Week Of Year']) === maxWeek - 1);
  const priorRows = currentFyRows.filter((row) => numberValue(row['Week Of Year']) === maxWeek - 2);
  return rowsToDefinitions(PERIOD_TYPES.lastWeek, currentRows, priorRows);
}

function deriveLastMonth(rows) {
  const lastMonthRows = rows.filter((row) => isYes(row['FC Last Month Flag']));
  const currentMonth = maxNumber(lastMonthRows.map((row) => row['Month of Year']));
  const currentRows = selectRowsForMonths(rows, [currentMonth]);
  const priorRows = selectRowsForMonths(rows, [previousFiscalMonth(currentMonth, 1)]);
  return rowsToDefinitions(PERIOD_TYPES.lastMonth, currentRows, priorRows);
}

function deriveLastQuarter(rows) {
  const currentMonthRows = rows.filter((row) => isYes(row['FC Current Month Flag']));
  const anchorMonth = maxNumber(currentMonthRows.map((row) => row['Month of Year']));
  const currentMonths = [1, 2, 3].map((offset) => previousFiscalMonth(anchorMonth, offset));
  const priorMonths = [4, 5, 6].map((offset) => previousFiscalMonth(anchorMonth, offset));
  const currentRows = selectRowsForMonths(rows, currentMonths);
  const priorRows = selectRowsForMonths(rows, priorMonths);
  return rowsToDefinitions(PERIOD_TYPES.lastQuarter, currentRows, priorRows);
}

function deriveYearToDate(rows) {
  const currentFyRows = rows.filter((row) => isYes(row['FC Current FY Flag']));
  const targetWeek = maxNumber(currentFyRows.map((row) => row['Week Of Year'])) - 1;
  const currentRows = currentFyRows.filter((row) => numberValue(row['Week Of Year']) <= targetWeek);
  const priorRows = rows.filter((row) => isYes(row['FC Last FY Flag']) && numberValue(row['Week Of Year']) <= targetWeek);
  return rowsToDefinitions(PERIOD_TYPES.yearToDate, currentRows, priorRows);
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
    priorBounds,
  }));

  const priorDefinitions = priorUnique.map((row, index) => buildDefinition({
    periodType,
    labels,
    comparisonSide: COMPARISON_SIDE.prior,
    comparableWeekSlot: index + 1,
    row,
    currentBounds,
    priorBounds,
  }));

  return [...currentDefinitions, ...priorDefinitions];
}

function buildDefinition({ periodType, labels, comparisonSide, comparableWeekSlot, row, currentBounds, priorBounds }) {
  const weekEnding = normalizeDate(row['Week Ending']);
  return {
    id: `${periodType}_${comparisonSide}_${comparableWeekSlot}_${weekEnding}`,
    period_type: periodType,
    period_label_current: labels.current,
    period_label_prior: labels.prior,
    comparison_side: comparisonSide,
    comparable_week_slot: comparableWeekSlot,
    week_ending: weekEnding,
    week_of_year: numberValue(row['Week Of Year']),
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

function previousFiscalMonth(month, offset) {
  const normalized = numberValue(month);
  return ((normalized - offset - 1 + 12) % 12) + 1;
}

function selectRowsForMonths(rows, months) {
  const selected = [];
  for (const month of months) {
    const monthRows = rows.filter((row) => numberValue(row['Month of Year']) === month);
    const currentFyRows = monthRows.filter((row) => isYes(row['FC Current FY Flag']));
    const fallbackRows = currentFyRows.length > 0
      ? currentFyRows
      : monthRows.filter((row) => isYes(row['FC Last FY Flag']));
    selected.push(...fallbackRows);
  }

  return selected.sort((a, b) => normalizeDate(a['Week Ending']).localeCompare(normalizeDate(b['Week Ending'])));
}

function maxNumber(values) {
  return Math.max(...values.map(numberValue).filter((value) => Number.isFinite(value)));
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isYes(value) {
  return cleanString(value).toUpperCase() === FLAGS.yes;
}

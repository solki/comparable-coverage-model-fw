import test from 'node:test';
import assert from 'node:assert/strict';

import { COMPARISON_MODES, PERIOD_TYPES } from '../src/constants.js';
import { deriveRuntimePeriodDefinitions } from '../src/periodDefinition.js';

const sourceRows = buildFiscalRows();

function buildFiscalRows() {
  const rows = [];
  const baseCurrent = Date.UTC(2025, 6, 6);
  const basePrior = Date.UTC(2024, 6, 7);

  for (let week = 1; week <= 40; week += 1) {
    rows.push(row({
      week,
      month: fiscalMonthForWeek(week),
      fy: '24-25',
      weekEnding: addWeeks(basePrior, week - 1),
      lastFy: 'Y'
    }));
    rows.push(row({
      week,
      month: fiscalMonthForWeek(week),
      fy: '25-26',
      weekEnding: addWeeks(baseCurrent, week - 1),
      currentFy: 'Y',
      currentMonth: week >= 37 && week <= 40 ? 'Y' : 'N',
      lastMonth: week >= 33 && week <= 36 ? 'Y' : 'N'
    }));
  }

  return rows;
}

function fiscalMonthForWeek(week) {
  return Math.min(12, Math.floor((week - 1) / 4) + 1);
}

function addWeeks(baseDate, offset) {
  const date = new Date(baseDate + offset * 7 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function row({ week, month, fy, weekEnding, currentFy = 'N', currentMonth = 'N', lastMonth = 'N', lastFy = 'N' }) {
  return {
    Date: weekEnding,
    'Week Ending': weekEnding,
    Metric: 'Sales',
    Value: 1,
    'Store Code': 'S001',
    'Store Name': 'Demo Store',
    Region: 'NSW/ACT',
    'Month of Year': month,
    'Week Of Year': week,
    'Financial Year': fy,
    'FC Current FY Flag': currentFy,
    'FC Current Month Flag': currentMonth,
    'FC Last Month Flag': lastMonth,
    'FC Last FY Flag': lastFy,
    'FC YTD Flag': currentFy,
    'Store Trading Commencement date': '2020-01-01',
    'Store Closure Date': ''
  };
}

function weeksFor(definitions, periodType, side) {
  return definitions
    .filter((item) => item.period_type === periodType && item.comparison_side === side)
    .map((item) => item.week_of_year);
}

function firstFor(definitions, periodType, side = 'current') {
  return definitions.find((item) => item.period_type === periodType && item.comparison_side === side);
}

test('derives the six approved active period options in display order', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);
  const periodTypes = Array.from(new Set(definitions.map((item) => item.period_type)));

  assert.deepEqual(periodTypes, [
    PERIOD_TYPES.lastCompletedWeek,
    PERIOD_TYPES.lastCompletedMonth,
    PERIOD_TYPES.lastCompletedQuarter,
    PERIOD_TYPES.yearToDate,
    PERIOD_TYPES.quarterToDate,
    PERIOD_TYPES.monthToDate
  ]);
});

test('fixed comparison mapping is derived from the selected period lens', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  for (const periodType of [
    PERIOD_TYPES.lastCompletedWeek,
    PERIOD_TYPES.lastCompletedMonth,
    PERIOD_TYPES.lastCompletedQuarter
  ]) {
    assert.equal(firstFor(definitions, periodType).comparison_mode, COMPARISON_MODES.previousPeriod);
  }

  for (const periodType of [
    PERIOD_TYPES.yearToDate,
    PERIOD_TYPES.quarterToDate,
    PERIOD_TYPES.monthToDate
  ]) {
    assert.equal(firstFor(definitions, periodType).comparison_mode, COMPARISON_MODES.samePeriodLastYear);
  }
});

test('derives Last Completed Week as current FY max week minus one and previous week', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);
  const current = firstFor(definitions, PERIOD_TYPES.lastCompletedWeek, 'current');
  const prior = firstFor(definitions, PERIOD_TYPES.lastCompletedWeek, 'prior');

  assert.equal(current.period_label_current, 'Last Completed Week');
  assert.equal(current.period_label_prior, 'Previous Week');
  assert.equal(current.week_of_year, 39);
  assert.equal(prior.week_of_year, 38);
});

test('derives Last Completed Month from FC Last Month Flag and previous fiscal month', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.lastCompletedMonth, 'current'), [33, 34, 35, 36]);
  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.lastCompletedMonth, 'prior'), [29, 30, 31, 32]);
});

test('derives Last Completed Quarter as two 13-fiscal-week completed periods', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.lastCompletedQuarter, 'current'), [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]);
  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.lastCompletedQuarter, 'prior'), [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
});

test('derives YTD using the same weeks in current and prior fiscal years', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.yearToDate, 'current'), Array.from({ length: 39 }, (_, index) => index + 1));
  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.yearToDate, 'prior'), Array.from({ length: 39 }, (_, index) => index + 1));
});

test('derives QTD using a 13-week quarter boundary and same period last year', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.quarterToDate, 'current'), [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]);
  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.quarterToDate, 'prior'), [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]);
});

test('derives MTD using current fiscal month-to-date and same month last year', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.monthToDate, 'current'), [37, 38, 39]);
  assert.deepEqual(weeksFor(definitions, PERIOD_TYPES.monthToDate, 'prior'), [37, 38, 39]);
});

test('derived rows preserve compatibility fields and expose runtime comparison concepts', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  assert.ok(definitions.length > 0);
  for (const definition of definitions) {
    assert.equal(definition.period_lens, definition.period_type);
    assert.equal(definition.fiscal_week, definition.week_of_year);
    assert.equal(definition.comparable_slot, definition.comparable_week_slot);
    assert.ok(definition.comparison_window_id);
    assert.equal(definition.history_offset, 1);
    assert.equal(Object.hasOwn(definition, 'week_include_flag'), false);
    assert.equal(Object.hasOwn(definition, 'week_exclusion_reason'), false);
    assert.equal(Object.hasOwn(definition, 'active_flag'), false);
    assert.equal(Object.hasOwn(definition, 'updated_at'), false);
  }
});

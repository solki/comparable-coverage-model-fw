import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveRuntimePeriodDefinitions } from '../src/periodDefinition.js';

const sourceRows = [
  row({ week: 1, month: 1, fy: '24-25', weekEnding: '2024-07-07', lastFy: 'Y' }),
  row({ week: 2, month: 2, fy: '24-25', weekEnding: '2024-07-14', lastFy: 'Y' }),
  row({ week: 3, month: 3, fy: '24-25', weekEnding: '2024-07-21', lastFy: 'Y' }),
  row({ week: 4, month: 11, fy: '24-25', weekEnding: '2025-05-04', lastFy: 'Y' }),
  row({ week: 5, month: 12, fy: '24-25', weekEnding: '2025-06-01', lastFy: 'Y' }),
  row({ week: 9, month: 2, fy: '25-26', weekEnding: '2025-08-31', currentFy: 'Y' }),
  row({ week: 10, month: 3, fy: '25-26', weekEnding: '2025-09-07', currentFy: 'Y' }),
  row({ week: 11, month: 4, fy: '25-26', weekEnding: '2025-09-14', currentFy: 'Y', lastMonth: 'Y' }),
  row({ week: 12, month: 5, fy: '25-26', weekEnding: '2025-09-21', currentFy: 'Y', currentMonth: 'Y' })
];

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

test('derives Last Week as current FY max week minus one and prior as minus two', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  const current = definitions.find((item) => item.period_type === 'Last Week' && item.comparison_side === 'current');
  const prior = definitions.find((item) => item.period_type === 'Last Week' && item.comparison_side === 'prior');

  assert.equal(current.period_label_current, 'Last Week');
  assert.equal(current.period_label_prior, '2 Weeks Ago');
  assert.equal(current.week_of_year, 11);
  assert.equal(current.week_ending, '2025-09-14');
  assert.equal(prior.week_of_year, 10);
  assert.equal(prior.week_ending, '2025-09-07');
});

test('derives Last Month from FC Last Month Flag and prior from the previous fiscal month', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  const currentRows = definitions.filter((item) => item.period_type === 'Last Month' && item.comparison_side === 'current');
  const priorRows = definitions.filter((item) => item.period_type === 'Last Month' && item.comparison_side === 'prior');

  assert.deepEqual(currentRows.map((item) => item.month_of_year), [4]);
  assert.deepEqual(currentRows.map((item) => item.week_ending), ['2025-09-14']);
  assert.deepEqual(priorRows.map((item) => item.month_of_year), [3]);
  assert.deepEqual(priorRows.map((item) => item.week_ending), ['2025-09-07']);
});

test('derives Last Quarter as rolling three complete fiscal months before the current month anchor', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  const currentMonths = definitions
    .filter((item) => item.period_type === 'Last Quarter' && item.comparison_side === 'current')
    .map((item) => item.month_of_year);
  const priorMonths = definitions
    .filter((item) => item.period_type === 'Last Quarter' && item.comparison_side === 'prior')
    .map((item) => item.month_of_year);

  assert.deepEqual(currentMonths, [2, 3, 4]);
  assert.deepEqual(priorMonths, [1, 11, 12]);
});

test('derives YTD using target week current FY max week minus one for both current and prior FY', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  const currentWeeks = definitions
    .filter((item) => item.period_type === 'Year to Date' && item.comparison_side === 'current')
    .map((item) => item.week_of_year);
  const priorWeeks = definitions
    .filter((item) => item.period_type === 'Year to Date' && item.comparison_side === 'prior')
    .map((item) => item.week_of_year);

  assert.deepEqual(currentWeeks, [9, 10, 11]);
  assert.deepEqual(priorWeeks, [1, 2, 3, 4, 5]);
});

test('derived period definitions are runtime rows and do not carry persisted include fields', () => {
  const definitions = deriveRuntimePeriodDefinitions(sourceRows);

  assert.ok(definitions.length > 0);
  for (const definition of definitions) {
    assert.equal(Object.hasOwn(definition, 'week_include_flag'), false);
    assert.equal(Object.hasOwn(definition, 'week_exclusion_reason'), false);
    assert.equal(Object.hasOwn(definition, 'active_flag'), false);
    assert.equal(Object.hasOwn(definition, 'updated_at'), false);
  }
});

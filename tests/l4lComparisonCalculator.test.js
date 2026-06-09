import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateComparisonSummary,
  getExcludedWeeks,
  getRowsForCoverageMode,
  inferComparisonContext
} from '../src/l4lComparisonCalculator.js';

const rows = [
  factRow({ side: 'current', slot: 1, weekEnding: '2026-06-07', value: 100, rowCount: 4, mask: 'Y' }),
  factRow({ side: 'current', slot: 2, weekEnding: '2026-06-14', value: 200, rowCount: 5, mask: 'N', reason: 'MANUAL_EXCLUDED' }),
  factRow({ side: 'prior', slot: 1, weekEnding: '2025-06-08', value: 80, rowCount: 3, mask: 'Y' }),
  factRow({ side: 'prior', slot: 2, weekEnding: '2025-06-15', value: 120, rowCount: 0, mask: 'N', reason: 'WEEK_53_EXCLUDED' })
];

test('L4L ON uses only rows where mask_include_flag is Y', () => {
  const filtered = getRowsForCoverageMode(rows, { comparableCoverageOn: true });

  assert.deepEqual(filtered.map((row) => row.week_ending), ['2026-06-07', '2025-06-08']);
});

test('L4L OFF uses all rows in the comparison window', () => {
  const filtered = getRowsForCoverageMode(rows, { comparableCoverageOn: false });

  assert.equal(filtered.length, rows.length);
});

test('comparison summary calculates current, prior, variance, week counts, and source records', () => {
  const summary = calculateComparisonSummary(rows, { comparableCoverageOn: false });

  assert.equal(summary.current_value, 300);
  assert.equal(summary.prior_value, 200);
  assert.equal(summary.absolute_variance, 100);
  assert.equal(summary.percent_change, 0.5);
  assert.equal(summary.percent_change_display, '+50.0%');
  assert.equal(summary.included_current_weeks, 2);
  assert.equal(summary.included_prior_weeks, 2);
  assert.equal(summary.weeks_without_source_data, 1);
  assert.equal(summary.source_records_matched, 12);
  assert.equal(summary.comparison_status, 'OK');
});

test('prior zero and current non-zero returns PRIOR_ZERO with N/A percent display', () => {
  const summary = calculateComparisonSummary([
    factRow({ side: 'current', value: 10, mask: 'Y' }),
    factRow({ side: 'prior', value: 0, mask: 'Y' })
  ], { comparableCoverageOn: true });

  assert.equal(summary.percent_change, null);
  assert.equal(summary.percent_change_display, 'N/A');
  assert.equal(summary.comparison_status, 'PRIOR_ZERO');
});

test('prior zero and current zero returns BOTH_ZERO with N/A percent display', () => {
  const summary = calculateComparisonSummary([
    factRow({ side: 'current', value: 0, mask: 'Y' }),
    factRow({ side: 'prior', value: 0, mask: 'Y' })
  ], { comparableCoverageOn: true });

  assert.equal(summary.percent_change, null);
  assert.equal(summary.percent_change_display, 'N/A');
  assert.equal(summary.comparison_status, 'BOTH_ZERO');
});

test('week count mismatch returns WEEK_COUNT_MISMATCH when no higher-priority status applies', () => {
  const summary = calculateComparisonSummary([
    factRow({ side: 'current', value: 10, mask: 'Y' }),
    factRow({ side: 'current', value: 20, mask: 'Y' }),
    factRow({ side: 'prior', value: 5, mask: 'Y' })
  ], { comparableCoverageOn: true });

  assert.equal(summary.comparison_status, 'WEEK_COUNT_MISMATCH');
});

test('excluded weeks use rows where mask_include_flag is N', () => {
  const excluded = getExcludedWeeks(rows);

  assert.deepEqual(excluded.map((row) => row.week_ending), ['2026-06-14', '2025-06-15']);
  assert.equal(excluded[0].final_reason_code, 'MANUAL_EXCLUDED');
});

test('comparison context infers store, metric, and period from the dataset', () => {
  const context = inferComparisonContext(rows);

  assert.equal(context.store_code, '21AL');
  assert.equal(context.store_name, 'Alexandria');
  assert.equal(context.metric, 'S - Line Sell Total');
  assert.equal(context.metric_display_name, 'Sales');
  assert.equal(context.period_label_current, 'Last Week');
  assert.equal(context.period_label_prior, '2 Weeks Ago');
});

function factRow({
  side,
  slot = 1,
  weekEnding = side === 'current' ? '2026-06-07' : '2025-06-08',
  value = 0,
  rowCount = 1,
  mask = 'Y',
  reason = 'INCLUDED'
}) {
  return {
    comparison_side: side,
    metric: 'S - Line Sell Total',
    period_type: 'Last Week',
    period_label_current: 'Last Week',
    period_label_prior: '2 Weeks Ago',
    store_code: '21AL',
    store_name: 'Alexandria',
    region: 'NSW/ACT',
    comparable_week_slot: slot,
    week_ending: weekEnding,
    week_of_year: 50,
    financial_year: weekEnding.startsWith('2026') ? '25-26' : '24-25',
    source_value: value,
    source_row_count: rowCount,
    system_include_flag: 'Y',
    manual_include_flag: mask,
    final_include_flag: mask,
    mask_include_flag: mask,
    final_reason_code: reason
  };
}

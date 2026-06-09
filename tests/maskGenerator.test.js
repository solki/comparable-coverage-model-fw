import test from 'node:test';
import assert from 'node:assert/strict';

import { generateMaskRows } from '../src/maskGenerator.js';

const eligibleStore = {
  store_code: 'S001',
  store_name: 'Demo Store',
  region: 'NSW/ACT',
  store_trading_commencement_date: '2020-01-01',
  store_closure_date: ''
};

const metric = 'S - Line Sell Total';

const periodRows = [
  periodRow({ periodType: 'Last Week', side: 'current', slot: 1, week: 11, weekEnding: '2025-09-14' }),
  periodRow({ periodType: 'Last Week', side: 'prior', slot: 1, week: 10, weekEnding: '2025-09-07' }),
  periodRow({ periodType: 'Last Month', side: 'current', slot: 1, week: 11, weekEnding: '2025-09-14' }),
  periodRow({ periodType: 'Last Month', side: 'prior', slot: 1, week: 9, weekEnding: '2025-08-31' }),
  periodRow({ periodType: 'Last Quarter', side: 'current', slot: 2, week: 11, weekEnding: '2025-09-14' })
];

function periodRow({ periodType, side, slot, week, weekEnding }) {
  return {
    id: `${periodType}-${side}-${slot}-${weekEnding}`,
    period_type: periodType,
    period_label_current: periodType === 'Last Week' ? 'Last Week' : 'Last Month',
    period_label_prior: periodType === 'Last Week' ? '2 Weeks Ago' : 'Month Before',
    comparison_side: side,
    comparable_week_slot: slot,
    week_ending: weekEnding,
    week_of_year: week,
    month_of_year: 4,
    financial_year: '25-26',
    current_period_start_date: '2025-09-08',
    current_period_end_date: '2025-09-14',
    prior_period_start_date: '2025-09-01',
    prior_period_end_date: '2025-09-07'
  };
}

function generate(options = {}) {
  return generateMaskRows({
    stores: [eligibleStore],
    metrics: [metric],
    periodRows,
    manualOverrides: [],
    runId: 'run_1',
    generatedAt: '2026-06-08T00:00:00.000Z',
    ...options
  });
}

test('manual override defaults to Y when no active AppDB override exists', () => {
  const rows = generate({ periodRows: [periodRows[0]] });

  assert.equal(rows[0].metric, metric);
  assert.equal(rows[0].system_include_flag, 'Y');
  assert.equal(rows[0].manual_include_flag, 'Y');
  assert.equal(rows[0].effective_include_flag, 'Y');
  assert.equal(rows[0].mask_include_flag, 'Y');
  assert.equal(rows[0].is_manual_override, 'N');
  assert.equal(rows[0].final_reason_code, 'INCLUDED');
});

test('manual override N requires a reason', () => {
  assert.throws(
    () => generate({
      periodRows: [periodRows[0]],
      manualOverrides: [{
        store_code: eligibleStore.store_code,
        metric,
        week_ending: '2025-09-14',
        manual_include_flag: 'N',
        manual_reason: ''
      }]
    }),
    /manual_reason is required/
  );
});

test('saved manual override is loaded and applied to the matching store metric week', () => {
  const rows = generate({
    periodRows: [periodRows[0]],
    manualOverrides: [{
      store_code: eligibleStore.store_code,
      metric,
      week_ending: '2025-09-14',
      manual_include_flag: 'N',
      manual_reason: 'Renovation',
      active_flag: 'Y'
    }]
  });

  assert.equal(rows[0].manual_include_flag, 'N');
  assert.equal(rows[0].is_manual_override, 'Y');
  assert.equal(rows[0].manual_reason, 'Renovation');
  assert.equal(rows[0].final_include_flag, 'N');
  assert.equal(rows[0].mask_include_flag, 'N');
});

test('store metric week exclusion propagates anywhere the same week appears', () => {
  const rows = generate({
    manualOverrides: [{
      store_code: eligibleStore.store_code,
      metric,
      week_ending: '2025-09-14',
      manual_include_flag: 'N',
      manual_reason: 'Renovation',
      active_flag: 'Y'
    }]
  });

  const sameWeekRows = rows.filter((row) => row.week_ending === '2025-09-14');

  assert.deepEqual(sameWeekRows.map((row) => row.period_type), ['Last Week', 'Last Month', 'Last Quarter']);
  assert.ok(sameWeekRows.every((row) => row.effective_include_flag === 'N'));
  assert.ok(sameWeekRows.every((row) => row.final_include_flag === 'N'));
});

test('period context fields are display audit fields and do not scope overrides', () => {
  const rows = generate({
    manualOverrides: [{
      store_code: eligibleStore.store_code,
      metric,
      week_ending: '2025-09-14',
      period_type: 'Year to Date',
      comparison_side: 'current',
      comparable_week_slot: 4,
      financial_year: '25-26',
      week_of_year: 11,
      month_of_year: 4,
      manual_include_flag: 'N',
      manual_reason: 'YTD decision',
      active_flag: 'Y',
      override_scope: 'STORE_METRIC_WEEK'
    }]
  });

  const lastMonth = rows.find((row) => row.period_type === 'Last Month' && row.week_ending === '2025-09-14');
  const lastQuarter = rows.find((row) => row.period_type === 'Last Quarter' && row.week_ending === '2025-09-14');

  assert.equal(lastMonth.manual_include_flag, 'N');
  assert.equal(lastMonth.manual_reason, 'YTD decision');
  assert.equal(lastMonth.final_include_flag, 'N');
  assert.equal(lastQuarter.manual_include_flag, 'N');
  assert.equal(lastQuarter.final_include_flag, 'N');
});

test('paired slot exclusion applies only within the same period type and comparable slot', () => {
  const rows = generate({
    manualOverrides: [{
      store_code: eligibleStore.store_code,
      metric,
      week_ending: '2025-09-07',
      manual_include_flag: 'N',
      manual_reason: 'Traffic outage',
      active_flag: 'Y'
    }]
  });

  const lastWeekCurrent = rows.find((row) => row.period_type === 'Last Week' && row.comparison_side === 'current');
  const lastWeekPrior = rows.find((row) => row.period_type === 'Last Week' && row.comparison_side === 'prior');
  const lastMonthCurrent = rows.find((row) => row.period_type === 'Last Month' && row.comparison_side === 'current');

  assert.equal(lastWeekPrior.effective_include_flag, 'N');
  assert.equal(lastWeekCurrent.effective_include_flag, 'Y');
  assert.equal(lastWeekCurrent.paired_slot_include_flag, 'N');
  assert.equal(lastWeekCurrent.final_include_flag, 'N');
  assert.equal(lastMonthCurrent.final_include_flag, 'Y');
});

test('missing source data does not automatically set include N', () => {
  const rows = generate({
    periodRows: [periodRows[0], periodRows[1]]
  });

  const prior = rows.find((row) => row.comparison_side === 'prior');

  assert.equal(prior.system_include_flag, 'Y');
  assert.equal(prior.manual_include_flag, 'Y');
  assert.equal(prior.mask_include_flag, 'Y');
});

test('week 53 is shown but system-excluded without a manual override', () => {
  const rows = generate({
    periodRows: [
      periodRow({ periodType: 'Year to Date', side: 'current', slot: 53, week: 53, weekEnding: '2026-06-28' }),
      periodRow({ periodType: 'Year to Date', side: 'prior', slot: 53, week: 53, weekEnding: '2025-06-29' })
    ]
  });

  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.week_of_year === 53));
  assert.ok(rows.every((row) => row.system_include_flag === 'N'));
  assert.ok(rows.every((row) => row.manual_include_flag === 'Y'));
  assert.ok(rows.every((row) => row.effective_include_flag === 'N'));
  assert.ok(rows.every((row) => row.final_include_flag === 'N'));
  assert.ok(rows.every((row) => row.system_reason_code === 'WEEK_53_EXCLUDED'));
  assert.ok(rows.every((row) => row.final_reason_code === 'WEEK_53_EXCLUDED'));
});

test('mask generation does not mutate source store, metric, period, or override inputs', () => {
  const stores = [structuredClone(eligibleStore)];
  const metrics = [metric];
  const periods = structuredClone(periodRows);
  const overrides = [{
    store_code: eligibleStore.store_code,
    metric,
    week_ending: '2025-09-14',
    manual_include_flag: 'N',
    manual_reason: 'Renovation',
    active_flag: 'Y'
  }];
  const before = JSON.stringify({ stores, metrics, periods, overrides });

  generateMaskRows({
    stores,
    metrics,
    periodRows: periods,
    manualOverrides: overrides,
    runId: 'run_3',
    generatedAt: '2026-06-08T00:00:00.000Z'
  });

  assert.equal(JSON.stringify({ stores, metrics, periods, overrides }), before);
});

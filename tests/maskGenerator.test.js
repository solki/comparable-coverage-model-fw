import test from 'node:test';
import assert from 'node:assert/strict';

import { PERIOD_TYPES, REASON_CODES } from '../src/constants.js';
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
  periodRow({ periodType: PERIOD_TYPES.lastCompletedWeek, side: 'current', slot: 1, week: 11, weekEnding: '2025-09-14' }),
  periodRow({ periodType: PERIOD_TYPES.lastCompletedWeek, side: 'prior', slot: 1, week: 10, weekEnding: '2025-09-07' }),
  periodRow({ periodType: PERIOD_TYPES.lastCompletedMonth, side: 'current', slot: 1, week: 11, weekEnding: '2025-09-14' }),
  periodRow({ periodType: PERIOD_TYPES.lastCompletedMonth, side: 'prior', slot: 1, week: 9, weekEnding: '2025-08-31' }),
  periodRow({ periodType: PERIOD_TYPES.lastCompletedQuarter, side: 'current', slot: 2, week: 11, weekEnding: '2025-09-14' })
];

function periodRow({ periodType, side, slot, week, weekEnding }) {
  return {
    id: `${periodType}-${side}-${slot}-${weekEnding}`,
    period_type: periodType,
    period_label_current: periodType,
    period_label_prior: periodType === PERIOD_TYPES.lastCompletedWeek ? 'Previous Week' : 'Previous Period',
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
  const rows = generate({ periodRows: [periodRows[0], periodRows[1]] });

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

  assert.deepEqual(sameWeekRows.map((row) => row.period_type), [
    PERIOD_TYPES.lastCompletedWeek,
    PERIOD_TYPES.lastCompletedMonth,
    PERIOD_TYPES.lastCompletedQuarter
  ]);
  assert.ok(sameWeekRows.every((row) => row.effective_include_flag === 'N'));
  assert.ok(sameWeekRows.every((row) => row.final_include_flag === 'N'));
});

test('period context fields are display audit fields and do not scope overrides', () => {
  const rows = generate({
    manualOverrides: [{
      store_code: eligibleStore.store_code,
      metric,
      week_ending: '2025-09-14',
      period_type: PERIOD_TYPES.yearToDate,
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

  const lastMonth = rows.find((row) => row.period_type === PERIOD_TYPES.lastCompletedMonth && row.week_ending === '2025-09-14');
  const lastQuarter = rows.find((row) => row.period_type === PERIOD_TYPES.lastCompletedQuarter && row.week_ending === '2025-09-14');

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

  const lastWeekCurrent = rows.find((row) => row.period_type === PERIOD_TYPES.lastCompletedWeek && row.comparison_side === 'current');
  const lastWeekPrior = rows.find((row) => row.period_type === PERIOD_TYPES.lastCompletedWeek && row.comparison_side === 'prior');
  const lastMonthCurrent = rows.find((row) => row.period_type === PERIOD_TYPES.lastCompletedMonth && row.comparison_side === 'current');

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
      periodRow({ periodType: PERIOD_TYPES.yearToDate, side: 'current', slot: 53, week: 53, weekEnding: '2026-06-28' }),
      periodRow({ periodType: PERIOD_TYPES.yearToDate, side: 'prior', slot: 53, week: 53, weekEnding: '2025-06-29' })
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

test('unpaired comparable slots remain visible but are excluded from LFL ON', () => {
  const rows = generate({
    periodRows: [
      periodRow({ periodType: PERIOD_TYPES.monthToDate, side: 'current', slot: 1, week: 37, weekEnding: '2026-03-15' }),
      periodRow({ periodType: PERIOD_TYPES.monthToDate, side: 'prior', slot: 1, week: 37, weekEnding: '2025-03-16' }),
      periodRow({ periodType: PERIOD_TYPES.monthToDate, side: 'current', slot: 2, week: 38, weekEnding: '2026-03-22' })
    ]
  });

  const pairedRows = rows.filter((row) => row.comparable_week_slot === 1);
  const unpairedRow = rows.find((row) => row.comparable_week_slot === 2);

  assert.ok(pairedRows.every((row) => row.mask_include_flag === 'Y'));
  assert.equal(unpairedRow.system_include_flag, 'Y');
  assert.equal(unpairedRow.effective_include_flag, 'Y');
  assert.equal(unpairedRow.paired_slot_include_flag, 'N');
  assert.equal(unpairedRow.final_include_flag, 'N');
  assert.equal(unpairedRow.mask_include_flag, 'N');
  assert.equal(unpairedRow.final_reason_code, REASON_CODES.unpairedPeriodWeek);
});

test('generation supports multiple stores and multiple metrics with correct row counts', () => {
  const stores = [
    eligibleStore,
    { store_code: 'S002', store_name: 'Store Two', region: 'VIC/TAS', store_trading_commencement_date: '2019-06-01', store_closure_date: '' }
  ];
  const metrics = ['S - Line Sell Total', 'S - Other Metric', 'S - Third Metric'];
  const rows = generateMaskRows({
    stores,
    metrics,
    periodRows,
    manualOverrides: [],
    runId: 'run_multi',
    generatedAt: '2026-06-08T00:00:00.000Z'
  });

  const expectedPerStore = periodRows.length * metrics.length;
  const expectedTotal = expectedPerStore * stores.length;
  assert.equal(rows.length, expectedTotal);
  assert.equal(rows.filter((row) => row.store_code === 'S001').length, expectedPerStore);
  assert.equal(rows.filter((row) => row.store_code === 'S002').length, expectedPerStore);
  assert.equal(rows.filter((row) => row.metric === 'S - Line Sell Total').length, periodRows.length * stores.length);

  const storeCodes = new Set(rows.map((row) => row.store_code));
  const metricNames = new Set(rows.map((row) => row.metric));
  assert.deepEqual(Array.from(storeCodes).sort(), ['S001', 'S002']);
  assert.deepEqual(Array.from(metricNames).sort(), ['S - Line Sell Total', 'S - Other Metric', 'S - Third Metric']);
});

test('manual override scopes to a single store even during broad multi-store multi-metric generation', () => {
  const stores = [
    eligibleStore,
    { store_code: 'S002', store_name: 'Store Two', region: 'VIC/TAS', store_trading_commencement_date: '2019-06-01', store_closure_date: '' }
  ];
  const metrics = ['S - Line Sell Total', 'S - Other Metric'];
  const overrides = [{
    store_code: 'S001',
    metric: 'S - Line Sell Total',
    week_ending: '2025-09-14',
    manual_include_flag: 'N',
    manual_reason: 'Renovation at S001',
    active_flag: 'Y'
  }];

  const rows = generateMaskRows({
    stores,
    metrics,
    periodRows,
    manualOverrides: overrides,
    runId: 'run_scoped',
    generatedAt: '2026-06-08T00:00:00.000Z'
  });

  // S001/S - Line Sell Total/2025-09-14: should be excluded by manual override
  const overriddenRows = rows.filter((row) => row.week_ending === '2025-09-14' && row.store_code === 'S001' && row.metric === 'S - Line Sell Total');
  assert.ok(overriddenRows.length > 0);
  assert.ok(overriddenRows.every((row) => row.manual_include_flag === 'N'));
  assert.ok(overriddenRows.every((row) => row.is_manual_override === 'Y'));
  assert.ok(overriddenRows.every((row) => row.final_include_flag === 'N'));
  assert.ok(overriddenRows.every((row) => row.mask_include_flag === 'N'));

  // S002/S - Line Sell Total/2025-09-14 (paired slots only): override does NOT cross stores
  const unaffectedSameWeekS002 = rows.filter((row) => row.week_ending === '2025-09-14' && row.store_code === 'S002' && row.metric === 'S - Line Sell Total' && row.comparable_week_slot !== 2);
  assert.ok(unaffectedSameWeekS002.length > 0);
  assert.ok(unaffectedSameWeekS002.every((row) => row.manual_include_flag === 'Y'));
  assert.ok(unaffectedSameWeekS002.every((row) => row.is_manual_override === 'N'));
  assert.ok(unaffectedSameWeekS002.every((row) => row.mask_include_flag === 'Y'));

  // S001/S - Other Metric/2025-09-14 (paired slots only): override does NOT cross metrics
  const unaffectedOtherMetric = rows.filter((row) => row.week_ending === '2025-09-14' && row.store_code === 'S001' && row.metric === 'S - Other Metric' && row.comparable_week_slot !== 2);
  assert.ok(unaffectedOtherMetric.length > 0);
  assert.ok(unaffectedOtherMetric.every((row) => row.manual_include_flag === 'Y'));
  assert.ok(unaffectedOtherMetric.every((row) => row.is_manual_override === 'N'));
  assert.ok(unaffectedOtherMetric.every((row) => row.mask_include_flag === 'Y'));
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

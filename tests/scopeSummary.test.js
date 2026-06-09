import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeGlobalDatasetOverview,
  computeSelectedScopeSummary
} from '../src/scopeSummary.js';

const sourceRows = [
  sourceRow({ storeCode: 'S001', storeName: 'Ready Store', metric: 'Sales', weekEnding: '2025-09-14', value: 100, commencementDate: '2020-01-01' }),
  sourceRow({ storeCode: 'S001', storeName: 'Ready Store', metric: 'Traffic', weekEnding: '2025-09-14', value: 10, commencementDate: '2020-01-01' }),
  sourceRow({ storeCode: 'S002', storeName: 'Missing Date Store', metric: 'Sales', weekEnding: '2025-09-07', value: 200, commencementDate: '' })
];

const periodRows = [
  periodRow({ periodType: 'Last Week', side: 'current', slot: 1, week: 11, weekEnding: '2025-09-14' }),
  periodRow({ periodType: 'Last Week', side: 'prior', slot: 1, week: 10, weekEnding: '2025-09-07' }),
  periodRow({ periodType: 'Last Month', side: 'current', slot: 1, week: 11, weekEnding: '2025-09-14' }),
  periodRow({ periodType: 'Last Month', side: 'prior', slot: 1, week: 9, weekEnding: '2025-08-31' }),
  periodRow({ periodType: 'Year to Date', side: 'current', slot: 1, week: 9, weekEnding: '2025-08-31' }),
  periodRow({ periodType: 'Year to Date', side: 'current', slot: 2, week: 10, weekEnding: '2025-09-07' }),
  periodRow({ periodType: 'Year to Date', side: 'prior', slot: 1, week: 9, weekEnding: '2024-08-31' })
];

test('global dataset overview remains unfiltered and clearly global', () => {
  const overview = computeGlobalDatasetOverview(sourceRows);

  assert.equal(overview.source_row_count, 3);
  assert.equal(overview.store_count, 2);
  assert.equal(overview.metric_count, 2);
  assert.equal(overview.stores_missing_commencement_date, 1);
  assert.equal(overview.min_week_ending, '2025-09-07');
  assert.equal(overview.max_week_ending, '2025-09-14');
});

test('selected scope summary counts a single selected store and metric', () => {
  const summary = computeSelectedScopeSummary({
    sourceRows,
    selectedStore: { store_code: 'S001', store_name: 'Ready Store', region: 'NSW/ACT', store_trading_commencement_date: '2020-01-01', store_closure_date: '' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week',
    periodRows,
    manualOverrides: [],
    maskRows: []
  });

  assert.equal(summary.scoped_store_count, 1);
  assert.equal(summary.scoped_metric_count, 1);
  assert.equal(summary.missing_commencement_count, 0);
  assert.equal(summary.current_side_week_count, 1);
  assert.equal(summary.prior_side_week_count, 1);
  assert.equal(summary.scoped_min_week_ending, '2025-09-07');
  assert.equal(summary.scoped_max_week_ending, '2025-09-14');
  assert.equal(summary.source_rows_available, 1);
  assert.equal(summary.weekly_coverage_record_count, 1);
  assert.equal(summary.missing_source_week_count, 1);
  assert.equal(summary.active_manual_override_count, 0);
});

test('selected scope summary separates source records from weekly coverage records', () => {
  const summary = computeSelectedScopeSummary({
    sourceFacts: [
      { store_code: 'S001', metric: 'Sales', week_ending: '2025-09-14', source_value: 150, source_row_count: 400, source_data_exists: 'Y' }
    ],
    selectedStore: { store_code: 'S001', store_name: 'Ready Store', region: 'NSW/ACT', store_trading_commencement_date: '2020-01-01', store_closure_date: '' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week',
    periodRows,
    manualOverrides: [],
    maskRows: []
  });

  assert.equal(summary.scoped_source_row_count, 400);
  assert.equal(summary.source_rows_available, 400);
  assert.equal(summary.weekly_coverage_record_count, 1);
  assert.equal(summary.missing_source_week_count, 1);
});

test('selected scope missing commencement follows selected store only', () => {
  const summary = computeSelectedScopeSummary({
    sourceRows,
    selectedStore: { store_code: 'S002', store_name: 'Missing Date Store', region: 'NSW/ACT', store_trading_commencement_date: '', store_closure_date: '' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week',
    periodRows,
    manualOverrides: [],
    maskRows: []
  });

  assert.equal(summary.scoped_store_count, 1);
  assert.equal(summary.scoped_metric_count, 1);
  assert.equal(summary.missing_commencement_count, 1);
});

test('changing metric updates selected scope source row and missing week counts', () => {
  const sales = computeSelectedScopeSummary({
    sourceRows,
    selectedStore: { store_code: 'S001', store_name: 'Ready Store', region: 'NSW/ACT', store_trading_commencement_date: '2020-01-01', store_closure_date: '' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week',
    periodRows,
    manualOverrides: [],
    maskRows: []
  });
  const traffic = computeSelectedScopeSummary({
    sourceRows,
    selectedStore: { store_code: 'S001', store_name: 'Ready Store', region: 'NSW/ACT', store_trading_commencement_date: '2020-01-01', store_closure_date: '' },
    selectedMetric: 'Traffic',
    selectedPeriodType: 'Last Week',
    periodRows,
    manualOverrides: [],
    maskRows: []
  });

  assert.equal(sales.source_rows_available, 1);
  assert.equal(traffic.source_rows_available, 1);
  assert.equal(sales.missing_source_week_count, 1);
  assert.equal(traffic.missing_source_week_count, 1);
});

test('changing period type updates selected scope week counts and date range', () => {
  const lastWeek = computeSelectedScopeSummary({
    sourceRows,
    selectedStore: { store_code: 'S001', store_name: 'Ready Store', region: 'NSW/ACT', store_trading_commencement_date: '2020-01-01', store_closure_date: '' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week',
    periodRows,
    manualOverrides: [],
    maskRows: []
  });
  const ytd = computeSelectedScopeSummary({
    sourceRows,
    selectedStore: { store_code: 'S001', store_name: 'Ready Store', region: 'NSW/ACT', store_trading_commencement_date: '2020-01-01', store_closure_date: '' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Year to Date',
    periodRows,
    manualOverrides: [],
    maskRows: []
  });

  assert.equal(lastWeek.current_side_week_count, 1);
  assert.equal(lastWeek.prior_side_week_count, 1);
  assert.equal(ytd.current_side_week_count, 2);
  assert.equal(ytd.prior_side_week_count, 1);
  assert.equal(ytd.scoped_min_week_ending, '2024-08-31');
  assert.equal(ytd.scoped_max_week_ending, '2025-09-07');
});

function sourceRow({ storeCode, storeName, metric, weekEnding, value, commencementDate }) {
  return {
    Date: weekEnding,
    'Week Ending': weekEnding,
    Metric: metric,
    Value: value,
    'Store Code': storeCode,
    'Store Name': storeName,
    Region: 'NSW/ACT',
    'Month of Year': 4,
    'Week Of Year': 11,
    'Financial Year': '25-26',
    'FC Current FY Flag': 'Y',
    'FC Current Month Flag': 'N',
    'FC Last Month Flag': 'Y',
    'FC Last FY Flag': 'N',
    'FC YTD Flag': 'Y',
    'Store Trading Commencement date': commencementDate,
    'Store Closure Date': ''
  };
}

function periodRow({ periodType, side, slot, week, weekEnding }) {
  return {
    id: `${periodType}-${side}-${slot}-${weekEnding}`,
    period_type: periodType,
    period_label_current: periodType,
    period_label_prior: `${periodType} Prior`,
    comparison_side: side,
    comparable_week_slot: slot,
    week_ending: weekEnding,
    week_of_year: week,
    month_of_year: 4,
    financial_year: weekEnding.startsWith('2024') ? '24-25' : '25-26',
    current_period_start_date: '2025-09-08',
    current_period_end_date: '2025-09-14',
    prior_period_start_date: '2025-09-01',
    prior_period_end_date: '2025-09-07'
  };
}

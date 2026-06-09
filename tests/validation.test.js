import test from 'node:test';
import assert from 'node:assert/strict';

import { buildValidationSummary, computeSelectedScopeValidation } from '../src/validation.js';
import { COLLECTIONS } from '../src/constants.js';

const readyMaskRows = [
  maskRow({ storeCode: 'S001', metric: 'Sales', periodType: 'Last Week', side: 'current', reason: 'INCLUDED', systemReason: 'INCLUDED', included: 'Y' }),
  maskRow({ storeCode: 'S001', metric: 'Sales', periodType: 'Last Week', side: 'prior', reason: 'INCLUDED', systemReason: 'INCLUDED', included: 'Y' })
];

const missingDateMaskRows = [
  maskRow({ storeCode: 'S002', metric: 'Sales', periodType: 'Last Week', side: 'current', reason: 'MISSING_COMMENCEMENT_DATE', systemReason: 'MISSING_COMMENCEMENT_DATE', included: 'N' }),
  maskRow({ storeCode: 'S002', metric: 'Sales', periodType: 'Last Week', side: 'prior', reason: 'MISSING_COMMENCEMENT_DATE', systemReason: 'MISSING_COMMENCEMENT_DATE', included: 'N' })
];

test('selected scope validation counts missing commencement for selected mask rows only', () => {
  const ready = computeSelectedScopeValidation({
    maskRows: readyMaskRows,
    selectedStore: { store_code: 'S001' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week'
  });
  const missing = computeSelectedScopeValidation({
    maskRows: missingDateMaskRows,
    selectedStore: { store_code: 'S002' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week'
  });

  assert.equal(ready.missing_commencement_date_warnings, 0);
  assert.equal(missing.missing_commencement_date_warnings, 1);
});

test('buildValidationSummary does not reuse global profile warnings in scoped mode', () => {
  const summary = buildValidationSummary({
    runId: 'run_1',
    profile: {
      stores_missing_commencement_date: 13,
      date_parsing_warnings: 99
    },
    periodRows: [],
    maskRows: readyMaskRows,
    selectedStore: { store_code: 'S001' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week',
    outputCollection: COLLECTIONS.selectedScopeMask
  });

  assert.equal(summary.output_collection, COLLECTIONS.selectedScopeMask);
  assert.equal(summary.missing_commencement_date_warnings, 0);
  assert.equal(summary.invalid_date_warnings, 0);
});

test('buildValidationSummary carries business validation counts', () => {
  const summary = buildValidationSummary({
    runId: 'run_2',
    profile: {},
    periodRows: [],
    maskRows: [
      ...readyMaskRows,
      maskRow({ storeCode: 'S001', metric: 'Sales', periodType: 'Last Week', side: 'current', reason: 'MANUAL_EXCLUDED', systemReason: 'INCLUDED', included: 'N' })
    ],
    selectedStore: { store_code: 'S001' },
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week',
    selectedScopeSummary: {
      missing_source_week_count: 3,
      active_manual_override_count: 1
    }
  });

  assert.equal(summary.total_mask_rows, 3);
  assert.equal(summary.included_mask_rows, 2);
  assert.equal(summary.excluded_mask_rows, 1);
  assert.equal(summary.weeks_without_source_data, 3);
  assert.equal(summary.manual_coverage_adjustments_applied, 1);
});

function maskRow({ storeCode, metric, periodType, side, reason, systemReason, included }) {
  return {
    store_code: storeCode,
    metric,
    period_type: periodType,
    comparison_side: side,
    region: 'NSW/ACT',
    system_reason_code: systemReason,
    final_reason_code: reason,
    mask_include_flag: included
  };
}

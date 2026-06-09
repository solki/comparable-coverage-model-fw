import test from 'node:test';
import assert from 'node:assert/strict';

import {
  L4L_COMPARISON_ALIAS,
  buildComparisonDataEndpoint,
  loadComparisonRows,
  normalizeComparisonRows,
  validateComparisonFields
} from '../src/comparisonDataService.js';

test('comparison data service queries the l4lComparisonFact alias without fragile field aliases', async () => {
  const calls = [];
  const domoClient = {
    get(endpoint) {
      calls.push(endpoint);
      return Promise.resolve([rawRow()]);
    }
  };

  const result = await loadComparisonRows({ domoClient, runtimeAvailable: true });

  assert.equal(result.source, 'domo');
  assert.equal(result.rows.length, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0], new RegExp(`/data/v1/${L4L_COMPARISON_ALIAS}`));
  assert.doesNotMatch(calls[0], /fields=/);
});

test('comparison data validation reports missing required fields', () => {
  const validation = validateComparisonFields([{ comparison_side: 'current' }]);

  assert.equal(validation.valid, false);
  assert.ok(validation.missingFields.includes('metric'));
  assert.ok(validation.missingFields.includes('mask_include_flag'));
});

test('empty comparison dataset returns clear empty state diagnostics', async () => {
  const domoClient = {
    get() {
      return Promise.resolve([]);
    }
  };

  const result = await loadComparisonRows({ domoClient, runtimeAvailable: true });

  assert.equal(result.rows.length, 0);
  assert.equal(result.empty, true);
  assert.match(result.message, /No L4L comparison data is available/);
});

test('comparison rows normalize numeric values and source data status', () => {
  const [available, missing] = normalizeComparisonRows([
    rawRow({ source_value: '123.45', source_row_count: '4' }),
    rawRow({ week_ending: '2026-06-14', source_value: null, source_row_count: null })
  ]);

  assert.equal(available.source_value, 123.45);
  assert.equal(available.source_row_count, 4);
  assert.equal(available.source_data_status, 'Available');
  assert.equal(missing.source_value, 0);
  assert.equal(missing.source_row_count, 0);
  assert.equal(missing.source_data_status, 'Missing / Zero-filled');
});

test('comparison rows can load when optional comparable slot is not mapped', async () => {
  const row = rawRow();
  delete row.comparable_week_slot;

  const domoClient = {
    get() {
      return Promise.resolve([row]);
    }
  };

  const result = await loadComparisonRows({ domoClient, runtimeAvailable: true });

  assert.equal(result.rows.length, 1);
  assert.equal(result.validation.valid, true);
  assert.equal(result.rows[0].comparable_week_slot, null);
});

test('comparison data endpoint uses the alias and does not include the dataset id', () => {
  const endpoint = buildComparisonDataEndpoint();

  assert.match(endpoint, /l4lComparisonFact/);
  assert.doesNotMatch(endpoint, /e5dffb5a/);
});

function rawRow(overrides = {}) {
  return {
    comparison_side: 'current',
    metric: 'S - Line Sell Total',
    period_type: 'Last Week',
    period_label_current: 'Last Week',
    period_label_prior: '2 Weeks Ago',
    store_code: '21AL',
    store_name: 'Alexandria',
    region: 'NSW/ACT',
    comparable_week_slot: 1,
    week_ending: '2026-06-07',
    week_of_year: 50,
    financial_year: '25-26',
    source_value: 100,
    source_row_count: 3,
    system_include_flag: 'Y',
    manual_include_flag: 'Y',
    final_include_flag: 'Y',
    mask_include_flag: 'Y',
    final_reason_code: 'INCLUDED',
    ...overrides
  };
}

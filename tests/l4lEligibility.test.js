import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateStoreEligibility } from '../src/l4lEligibility.js';

const period = {
  current_period_start_date: '2025-09-08',
  current_period_end_date: '2025-09-14'
};

test('includes a store opened on or before current period start minus six days', () => {
  const result = evaluateStoreEligibility({
    store_code: 'S001',
    store_trading_commencement_date: '2025-09-02',
    store_closure_date: ''
  }, period);

  assert.equal(result.eligible, true);
  assert.equal(result.reason_code, 'INCLUDED');
});

test('excludes a store opened after current period start minus six days', () => {
  const result = evaluateStoreEligibility({
    store_code: 'S002',
    store_trading_commencement_date: '2025-09-03',
    store_closure_date: ''
  }, period);

  assert.equal(result.eligible, false);
  assert.equal(result.reason_code, 'COMMENCED_TOO_LATE');
});

test('excludes a store closed before current period end', () => {
  const result = evaluateStoreEligibility({
    store_code: 'S003',
    store_trading_commencement_date: '2020-01-01',
    store_closure_date: '2025-09-13'
  }, period);

  assert.equal(result.eligible, false);
  assert.equal(result.reason_code, 'CLOSED_BEFORE_PERIOD_END');
});


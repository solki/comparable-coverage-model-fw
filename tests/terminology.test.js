import test from 'node:test';
import assert from 'node:assert/strict';

import { helperText, labels } from '../src/terminology.js';

test('business terminology labels expose CCM wording', () => {
  assert.equal(labels.sourceRecords, 'Source Records');
  assert.equal(labels.weeklyCoverageRecords, 'Weekly Coverage Records');
  assert.equal(labels.tradingExpectation, 'Trading Expectation');
  assert.equal(labels.weeksNotExpectedToTrade, 'Weeks Not Expected to Trade');
  assert.equal(labels.finalCcmOutcome, 'Final CCM Outcome');
  assert.equal(labels.comparableWeekRecordsToWrite, 'Comparable Week Records to Write');
});

test('business terminology helper text describes CCM layers', () => {
  assert.match(helperText.sourceRecords, /raw rows/);
  assert.match(helperText.weeklyCoverageRecords, /Store × Metric × Fiscal Week/);
  assert.match(helperText.tradingExpectation, /underlying system flag/);
  assert.match(helperText.selectedScopeMask, /Phase 1 validation/);
});

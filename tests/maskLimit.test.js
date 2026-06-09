import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMaskGenerationLimit } from '../src/maskLimit.js';

test('applyMaskGenerationLimit keeps only the first configured rows when enabled', () => {
  const rows = Array.from({ length: 105 }, (_, index) => ({ id: `row-${index + 1}` }));

  const result = applyMaskGenerationLimit(rows, { enabled: true, limit: 100 });

  assert.equal(result.rows.length, 100);
  assert.equal(result.fullRowCount, 105);
  assert.equal(result.limitApplied, true);
  assert.equal(result.rows[0].id, 'row-1');
  assert.equal(result.rows[99].id, 'row-100');
});

test('applyMaskGenerationLimit returns all rows when disabled', () => {
  const rows = Array.from({ length: 105 }, (_, index) => ({ id: `row-${index + 1}` }));

  const result = applyMaskGenerationLimit(rows, { enabled: false, limit: 100 });

  assert.equal(result.rows.length, 105);
  assert.equal(result.fullRowCount, 105);
  assert.equal(result.limitApplied, false);
});

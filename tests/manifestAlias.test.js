import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SOURCE_DATASET_ALIAS } from '../src/constants.js';
import { L4L_COMPARISON_ALIAS } from '../src/comparisonDataService.js';

test('source dataset alias uses only letters and numbers', () => {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  const sourceMapping = manifest.datasetsMapping.find((mapping) => mapping.alias === SOURCE_DATASET_ALIAS);

  assert.equal(SOURCE_DATASET_ALIAS, 'sourceMetrics');
  assert.match(SOURCE_DATASET_ALIAS, /^[A-Za-z][A-Za-z0-9]*$/);
  assert.ok(sourceMapping, 'manifest must include the source dataset alias used by app code');
  assert.deepEqual(sourceMapping.fields, []);
});

test('Phase 2 comparison dataset alias uses manifest mapping only', () => {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  const comparisonMapping = manifest.datasetsMapping.find((mapping) => mapping.alias === L4L_COMPARISON_ALIAS);

  assert.equal(L4L_COMPARISON_ALIAS, 'l4lComparisonFact');
  assert.match(L4L_COMPARISON_ALIAS, /^[A-Za-z][A-Za-z0-9]*$/);
  assert.ok(comparisonMapping, 'manifest must include the L4L comparison dataset alias used by app code');
  assert.equal(comparisonMapping.dataSetId, 'e5dffb5a-176f-4564-a147-c0d7311a6880');
  assert.deepEqual(comparisonMapping.fields, []);
});

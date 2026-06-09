import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SOURCE_DATASET_ALIAS } from '../src/constants.js';

test('source dataset alias uses only letters and numbers', () => {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  const sourceMapping = manifest.datasetsMapping.find((mapping) => mapping.alias === SOURCE_DATASET_ALIAS);

  assert.equal(SOURCE_DATASET_ALIAS, 'sourceMetrics');
  assert.match(SOURCE_DATASET_ALIAS, /^[A-Za-z][A-Za-z0-9]*$/);
  assert.ok(sourceMapping, 'manifest must include the source dataset alias used by app code');
  assert.deepEqual(sourceMapping.fields, []);
});


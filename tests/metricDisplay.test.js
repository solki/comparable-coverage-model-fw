import test from 'node:test';
import assert from 'node:assert/strict';

import { getMetricDisplayName } from '../src/metricDisplay.js';

test('metric display names map known source metric names', () => {
  assert.equal(getMetricDisplayName('S - Line Sell Total'), 'Sales');
  assert.equal(getMetricDisplayName('Traffic In'), 'Foot Traffic');
  assert.equal(getMetricDisplayName('Bed Match'), 'BedMatch');
});

test('metric display name falls back to raw metric name', () => {
  assert.equal(getMetricDisplayName('Average Order Value'), 'Average Order Value');
});

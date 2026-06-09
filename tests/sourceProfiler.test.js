import test from 'node:test';
import assert from 'node:assert/strict';

import { profileSourceRows } from '../src/sourceProfiler.js';

test('source profiling does not mutate source dataset rows', () => {
  const rows = [{
    Date: '2025-09-14',
    'Week Ending': '2025-09-14',
    Metric: 'Sales',
    Value: 1,
    'Store Code': 'S001',
    'Store Name': 'Demo Store',
    Region: 'NSW/ACT',
    'Month of Year': 4,
    'Week Of Year': 11,
    'Financial Year': '25-26',
    'FC Current FY Flag': 'Y',
    'FC Current Month Flag': 'N',
    'FC Last Month Flag': 'Y',
    'FC Last FY Flag': 'N',
    'FC YTD Flag': 'Y',
    'Store Trading Commencement date': '2020-01-01',
    'Store Closure Date': ''
  }];
  const before = JSON.stringify(rows);

  const profile = profileSourceRows(rows);

  assert.equal(JSON.stringify(rows), before);
  assert.equal(profile.store_count, 1);
  assert.equal(profile.week_count, 1);
  assert.equal(profile.metric_count, 1);
});


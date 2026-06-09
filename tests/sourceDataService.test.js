import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSourceSqlEndpoint,
  buildSourceSqlQueries,
  fetchSourceRowsFromDomo,
  loadSourceRows
} from '../src/sourceDataService.js';
import { SOURCE_DATASET_ALIAS } from '../src/constants.js';

test('source SQL queries aggregate source data into small result sets', () => {
  const queries = buildSourceSqlQueries();

  assert.match(queries.summary, /COUNT\(\*\) AS source_row_count/);
  assert.match(queries.metricList, /GROUP BY `Metric`/);
  assert.match(queries.storeLifecycle, /GROUP BY `Store Code`/);
  assert.match(queries.weekCalendar, /GROUP BY `Week Ending`/);
  assert.match(queries.sourceFacts, /GROUP BY `Store Code`, `Metric`, `Week Ending`/);
  assert.doesNotMatch(Object.values(queries).join('\n'), /LIMIT 50000/i);
});

test('source SQL endpoint uses the manifest alias instead of a dataset id', () => {
  const endpoint = buildSourceSqlEndpoint();

  assert.equal(endpoint, `/sql/v1/${SOURCE_DATASET_ALIAS}`);
  assert.doesNotMatch(endpoint, /86e3e588/);
});

test('source aggregates are queried through domo.post SQL using the manifest alias', async () => {
  const calls = [];
  const responses = [
    {
      columns: ['source_row_count', 'metric_count', 'min_week_ending', 'max_week_ending'],
      rows: [[4537603, 3, '2010-07-04', '2026-06-28']]
    },
    {
      columns: ['store_code', 'store_name', 'region', 'store_trading_commencement_date', 'store_closure_date', 'source_row_count'],
      rows: [
        ['21AL', 'Alexandria', 'NSW/ACT', '2010-01-01', '', 46134],
        ['21BE', 'Belrose', 'NSW/ACT', '', '', 522]
      ]
    },
    {
      columns: ['metric', 'source_row_count'],
      rows: [
        ['S - Line Sell Total', 3000000],
        ['Traffic In', 1537603]
      ]
    },
    {
      columns: ['Week Ending', 'Week Of Year', 'Month of Year', 'Financial Year', 'FC Current FY Flag', 'FC Current Month Flag', 'FC Last Month Flag', 'FC Last FY Flag', 'FC YTD Flag'],
      rows: [
        ['2026-06-21', 51, 12, '25-26', 'Y', 'Y', 'N', 'N', 'N'],
        ['2026-06-28', 52, 12, '25-26', 'Y', 'Y', 'N', 'N', 'N']
      ]
    },
    {
      columns: ['store_code', 'metric', 'week_ending', 'source_value', 'source_row_count'],
      rows: [
        ['21AL', 'S - Line Sell Total', '2026-06-21', 1200.5, 12],
        ['21AL', 'Traffic In', '2026-06-21', 80, 12]
      ]
    }
  ];
  const domoClient = {
    post(endpoint, sql, options) {
      calls.push({ endpoint, sql, options });
      return Promise.resolve(responses[calls.length - 1]);
    }
  };

  const result = await fetchSourceRowsFromDomo(domoClient);

  assert.equal(result.rows.length, 2);
  assert.equal(result.profile.source_row_count, 4537603);
  assert.equal(result.profile.store_count, 2);
  assert.equal(result.profile.week_count, 2);
  assert.deepEqual(result.profile.metrics, [
    { metric: 'S - Line Sell Total', source_row_count: 3000000 },
    { metric: 'Traffic In', source_row_count: 1537603 }
  ]);
  assert.equal(result.profile.stores_missing_commencement_date, 1);
  assert.equal(result.profile.stores_with_closure_date, 0);
  assert.deepEqual(result.profile.sourceFacts, [
    {
      store_code: '21AL',
      metric: 'S - Line Sell Total',
      week_ending: '2026-06-21',
      source_value: 1200.5,
      source_row_count: 12,
      source_data_exists: 'Y'
    },
    {
      store_code: '21AL',
      metric: 'Traffic In',
      week_ending: '2026-06-21',
      source_value: 80,
      source_row_count: 12,
      source_data_exists: 'Y'
    }
  ]);
  assert.deepEqual(result.profile.stores[0], {
    store_code: '21AL',
    store_name: 'Alexandria',
    region: 'NSW/ACT',
    store_trading_commencement_date: '2010-01-01',
    store_closure_date: null,
    source_row_count: 46134
  });
  assert.equal(calls.length, 5);
  assert.ok(calls.every((call) => call.endpoint === buildSourceSqlEndpoint()));
  assert.ok(calls.every((call) => call.options.contentType === 'text/plain'));
});

test('loadSourceRows falls back to mock rows with diagnostics when alias is not queryable', async () => {
  const domoClient = {
    post() {
      const error = new Error('Method Not Allowed');
      error.status = 405;
      return Promise.reject(error);
    }
  };

  const result = await loadSourceRows({
    domoClient,
    runtimeAvailable: true
  });

  assert.equal(result.source, 'mock');
  assert.equal(result.diagnostics.source.queryable, false);
  assert.equal(result.diagnostics.source.alias, SOURCE_DATASET_ALIAS);
  assert.equal(result.diagnostics.source.errorStatus, 405);
  assert.match(result.warning, /Method Not Allowed/);
});

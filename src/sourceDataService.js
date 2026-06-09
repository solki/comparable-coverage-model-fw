import { SOURCE_DATASET_ALIAS } from './constants.js';
import { getDomoClient } from './domoClient.js';
import { mockSourceRows } from './mockData.js';
import { profileSourceRows } from './sourceProfiler.js';

export async function loadSourceRows({
  forceMock = false,
  domoClient = null,
  runtimeAvailable = isBrowserDomoRuntime()
} = {}) {
  if (forceMock || !runtimeAvailable) {
    return {
      rows: mockSourceRows,
      source: 'mock',
      diagnostics: buildSourceDiagnostics({
        queryable: false,
        mapped: false,
        message: forceMock ? 'Mock mode requested.' : 'Local runtime detected; using mock source rows.'
      })
    };
  }

  try {
    const sourceResult = await fetchSourceRowsFromDomo(domoClient || getDomoClient());

    return {
      rows: sourceResult.rows,
      profile: sourceResult.profile,
      source: 'domo',
      diagnostics: buildSourceDiagnostics({
        queryable: true,
        mapped: true,
        message: `Alias ${SOURCE_DATASET_ALIAS} is queryable through aggregated SQL.`
      })
    };
  } catch (error) {
    const warning = readableError(error);
    console.warn(`Falling back to mock source rows because ${SOURCE_DATASET_ALIAS} could not be loaded: ${warning}`);
    return {
      rows: mockSourceRows,
      source: 'mock',
      warning,
      diagnostics: buildSourceDiagnostics({
        queryable: false,
        mapped: false,
        error,
        message: `Alias ${SOURCE_DATASET_ALIAS} is not mapped or not queryable.`
      })
    };
  }
}

export function buildSourceSqlEndpoint() {
  return `/sql/v1/${encodeURIComponent(SOURCE_DATASET_ALIAS)}`;
}

export function buildSourceSqlQueries() {
  const sourceTable = SOURCE_DATASET_ALIAS;
  return {
    summary: `
      SELECT
        COUNT(*) AS source_row_count,
        COUNT(DISTINCT \`Metric\`) AS metric_count,
        MIN(\`Week Ending\`) AS min_week_ending,
        MAX(\`Week Ending\`) AS max_week_ending
      FROM ${sourceTable}
    `,
    storeLifecycle: `
      SELECT
        \`Store Code\` AS store_code,
        MIN(\`Store Name\`) AS store_name,
        MIN(\`Region\`) AS region,
        MIN(\`Store Trading Commencement date\`) AS store_trading_commencement_date,
        MIN(\`Store Closure Date\`) AS store_closure_date,
        COUNT(*) AS source_row_count
      FROM ${sourceTable}
      WHERE \`Store Code\` IS NOT NULL
        AND \`Store Code\` <> ''
      GROUP BY \`Store Code\`
      ORDER BY \`Store Code\`
    `,
    metricList: `
      SELECT
        \`Metric\` AS metric,
        COUNT(*) AS source_row_count
      FROM ${sourceTable}
      WHERE \`Metric\` IS NOT NULL
        AND \`Metric\` <> ''
      GROUP BY \`Metric\`
      ORDER BY \`Metric\`
    `,
    weekCalendar: `
      SELECT
        \`Week Ending\` AS \`Week Ending\`,
        MIN(\`Week Of Year\`) AS \`Week Of Year\`,
        MIN(\`Month of Year\`) AS \`Month of Year\`,
        MIN(\`Financial Year\`) AS \`Financial Year\`,
        MAX(\`FC Current FY Flag\`) AS \`FC Current FY Flag\`,
        MAX(\`FC Current Month Flag\`) AS \`FC Current Month Flag\`,
        MAX(\`FC Last Month Flag\`) AS \`FC Last Month Flag\`,
        MAX(\`FC Last FY Flag\`) AS \`FC Last FY Flag\`,
        MAX(\`FC YTD Flag\`) AS \`FC YTD Flag\`
      FROM ${sourceTable}
      WHERE \`Week Ending\` IS NOT NULL
      GROUP BY \`Week Ending\`
      ORDER BY \`Week Ending\`
    `,
    sourceFacts: `
      SELECT
        \`Store Code\` AS store_code,
        \`Metric\` AS metric,
        \`Week Ending\` AS week_ending,
        SUM(\`Value\`) AS source_value,
        COUNT(*) AS source_row_count
      FROM ${sourceTable}
      WHERE \`Store Code\` IS NOT NULL
        AND \`Store Code\` <> ''
        AND \`Metric\` IS NOT NULL
        AND \`Metric\` <> ''
        AND \`Week Ending\` IS NOT NULL
      GROUP BY \`Store Code\`, \`Metric\`, \`Week Ending\`
      ORDER BY \`Store Code\`, \`Metric\`, \`Week Ending\`
    `
  };
}

export async function fetchSourceRowsFromDomo(domoClient = null) {
  const resolvedClient = domoClient || getDomoClient();
  if (!resolvedClient || typeof resolvedClient.post !== 'function') {
    throw new Error('Domo post client is unavailable; sourceMetrics cannot be queried in this runtime.');
  }

  const endpoint = buildSourceSqlEndpoint();
  const queries = buildSourceSqlQueries();
  const [summaryRows, storeRows, metricRows, weekRows, sourceFactRows] = await Promise.all([
    executeSourceSql(resolvedClient, endpoint, queries.summary),
    executeSourceSql(resolvedClient, endpoint, queries.storeLifecycle),
    executeSourceSql(resolvedClient, endpoint, queries.metricList),
    executeSourceSql(resolvedClient, endpoint, queries.weekCalendar),
    executeSourceSql(resolvedClient, endpoint, queries.sourceFacts)
  ]);

  const stores = normalizeStoreLifecycleRows(storeRows);
  const metrics = normalizeMetricRows(metricRows);
  const sourceFacts = normalizeSourceFactRows(sourceFactRows);

  return {
    rows: weekRows,
    profile: buildAggregatedSourceProfile(summaryRows[0], stores, metrics, weekRows, sourceFacts)
  };
}

export function normalizeQueryRows(response) {
  if (Array.isArray(response)) return response;

  const body = response?.body ?? response;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.rows)) return normalizeRowsWithColumns(body.rows, body.columns);
  if (Array.isArray(body?.data)) return normalizeRowsWithColumns(body.data, body.columns);
  if (Array.isArray(response?.rows)) return normalizeRowsWithColumns(response.rows, response.columns);
  if (Array.isArray(response?.result?.rows)) {
    return normalizeRowsWithColumns(response.result.rows, response.result.columns);
  }

  return [];
}

export async function profileSource({ forceMock = false } = {}) {
  const loaded = await loadSourceRows({ forceMock });
  return {
    ...loaded,
    profile: loaded.profile || profileSourceRows(loaded.rows)
  };
}

async function executeSourceSql(domoClient, endpoint, sql) {
  const response = await domoClient.post(endpoint, normalizeSql(sql), {
    contentType: 'text/plain'
  });
  return normalizeQueryRows(response);
}

function normalizeSql(sql) {
  return sql
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

function buildAggregatedSourceProfile(summaryRow = {}, stores, metrics, weekRows, sourceFacts = []) {
  return {
    source_row_count: Number(summaryRow.source_row_count || 0),
    store_count: stores.length,
    week_count: weekRows.length,
    min_week_ending: normalizeNullable(summaryRow.min_week_ending),
    max_week_ending: normalizeNullable(summaryRow.max_week_ending),
    metric_count: Number(summaryRow.metric_count || 0),
    stores_missing_commencement_date: stores.filter((store) => !store.store_trading_commencement_date).length,
    stores_with_closure_date: stores.filter((store) => Boolean(store.store_closure_date)).length,
    date_parsing_warnings: 'not checked in aggregate mode',
    warnings: [],
    stores,
    metrics,
    sourceFacts
  };
}

function normalizeStoreLifecycleRows(rows) {
  return rows.map((row) => ({
    store_code: normalizeNullable(row.store_code),
    store_name: normalizeNullable(row.store_name) || '',
    region: normalizeNullable(row.region) || '',
    store_trading_commencement_date: normalizeNullable(row.store_trading_commencement_date),
    store_closure_date: normalizeNullable(row.store_closure_date),
    source_row_count: Number(row.source_row_count || 0)
  })).filter((store) => Boolean(store.store_code));
}

function normalizeMetricRows(rows) {
  return rows.map((row) => ({
    metric: normalizeNullable(row.metric),
    source_row_count: Number(row.source_row_count || 0)
  })).filter((metric) => Boolean(metric.metric));
}

function normalizeSourceFactRows(rows) {
  return rows.map((row) => ({
    store_code: normalizeNullable(row.store_code),
    metric: normalizeNullable(row.metric),
    week_ending: normalizeNullable(row.week_ending),
    source_value: Number(row.source_value || 0),
    source_row_count: Number(row.source_row_count || 0),
    source_data_exists: row.source_row_count ? 'Y' : 'N'
  })).filter((row) => Boolean(row.store_code && row.metric && row.week_ending));
}

function normalizeRowsWithColumns(rows, columns) {
  if (!Array.isArray(columns) || !rows.some(Array.isArray)) return rows;

  const columnNames = columns.map((column) => (
    typeof column === 'string' ? column : column?.name || column?.field || column?.label
  ));

  return rows.map((row) => {
    if (!Array.isArray(row)) return row;
    return Object.fromEntries(row.map((value, index) => [columnNames[index] || `column_${index}`, value]));
  });
}

function buildSourceDiagnostics({ queryable, mapped, message, error = null }) {
  return {
    source: {
      alias: SOURCE_DATASET_ALIAS,
      endpoint: buildSourceSqlEndpoint(),
      mapped,
      queryable,
      errorStatus: getErrorStatus(error),
      errorMessage: error ? readableError(error) : '',
      message
    }
  };
}

function readableError(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || error.statusText || JSON.stringify(error);
}

function getErrorStatus(error) {
  return error?.status || error?.statusCode || error?.response?.status || '';
}

function normalizeNullable(value) {
  if (value === '' || value === undefined) return null;
  return value;
}

function isBrowserDomoRuntime() {
  return Boolean(
    typeof window !== 'undefined'
      && window.location
      && !['localhost', '127.0.0.1'].includes(window.location.hostname)
  );
}

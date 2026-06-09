import fs from 'node:fs';
import path from 'node:path';

import { createRunId } from '../src/maskWriteService.js';
import { deriveDefaultPeriodDefinitions } from '../src/periodDefinition.js';
import { generateMaskRows, summarizeMaskRows } from '../src/maskGenerator.js';
import { buildValidationSummary } from '../src/validation.js';

const DATASET_ID = '86e3e588-91c3-487b-8d9f-d585dbdbaf10';
const INSTANCE = 'fortywinks-com-au.domo.com';
const RYUU_CLIENT_PATH = '/opt/homebrew/lib/node_modules/ryuu/node_modules/ryuu-client/lib/domoapps-client.js';
const RYUU_CLIENT_ID = 'domo:internal:devstudio';
const OUTPUT_PATH = path.resolve('MISC/source-aggregate-validation-result.json');

const SQL = {
  summary: `
    SELECT
      COUNT(*) AS source_row_count,
      COUNT(DISTINCT \`Metric\`) AS metric_count,
      MIN(\`Week Ending\`) AS min_week_ending,
      MAX(\`Week Ending\`) AS max_week_ending
    FROM table
  `,
  storeLifecycle: `
    SELECT
      \`Store Code\` AS store_code,
      MIN(\`Store Name\`) AS store_name,
      MIN(\`Region\`) AS region,
      MIN(\`Store Trading Commencement date\`) AS store_trading_commencement_date,
      MIN(\`Store Closure Date\`) AS store_closure_date,
      COUNT(*) AS source_row_count
    FROM table
    WHERE \`Store Code\` IS NOT NULL
      AND \`Store Code\` <> ''
    GROUP BY \`Store Code\`
    ORDER BY \`Store Code\`
  `,
  metricList: `
    SELECT
      \`Metric\` AS metric,
      COUNT(*) AS source_row_count
    FROM table
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
    FROM table
    WHERE \`Week Ending\` IS NOT NULL
    GROUP BY \`Week Ending\`
    ORDER BY \`Week Ending\`
  `
};

const domo = await createDomoClient();

const sourceSummaryRows = await executeSql(SQL.summary);
const storeRows = await executeSql(SQL.storeLifecycle);
const metricRows = await executeSql(SQL.metricList);
const weekRows = await executeSql(SQL.weekCalendar);

const sourceSummary = {
  ...sourceSummaryRows[0],
  store_count: storeRows.length,
  week_count: weekRows.length,
  stores_missing_commencement_date: storeRows.filter((store) => !store.store_trading_commencement_date).length,
  stores_with_closure_date: storeRows.filter((store) => Boolean(store.store_closure_date)).length,
  date_parsing_warnings: null,
  warning_note: 'Date parsing warning parity was not validated because the SQL endpoint returns typed date values, not raw date strings.'
};

const periodRows = deriveDefaultPeriodDefinitions(weekRows, {
  updatedAt: new Date().toISOString()
});

const runId = createRunId();
const generatedAt = new Date().toISOString();
const maskRows = generateMaskRows({
  stores: storeRows,
  metrics: metricRows.map((row) => row.metric),
  periodRows,
  manualOverrides: [],
  runId,
  generatedAt
});

const maskSummary = summarizeMaskRows(maskRows);
const validationSummary = buildValidationSummary({
  runId,
  profile: {
    ...sourceSummary,
    stores: storeRows
  },
  periodRows,
  maskRows
});

const result = {
  datasetId: DATASET_ID,
  instance: INSTANCE,
  sourceSummary,
  queryResultSizes: {
    summary_rows: sourceSummaryRows.length,
    store_lifecycle_rows: storeRows.length,
    metric_rows: metricRows.length,
    week_calendar_rows: weekRows.length
  },
  generatedCounts: {
    period_week_count: periodRows.length,
    mask_row_count: maskRows.length,
    included_mask_row_count: maskSummary.included_mask_row_count,
    excluded_store_count: maskSummary.excluded_store_count
  },
  sampleRows: {
    stores: storeRows.slice(0, 5),
    metrics: metricRows,
    weeks: weekRows.slice(-5),
    periods: periodRows.slice(0, 10)
  },
  validationSummary,
  sql: SQL
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath: OUTPUT_PATH,
  sourceSummary,
  queryResultSizes: result.queryResultSizes,
  generatedCounts: result.generatedCounts,
  validationSummary
}, null, 2));

async function createDomoClient() {
  const configPath = path.join(
    process.env.HOME,
    '.config/configstore/ryuu/fortywinks-com-au.domo.com.json'
  );
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.refreshToken) {
    throw new Error('Ryuu OAuth refresh token is missing. Run domo login before validation.');
  }

  const DomoModule = await import(RYUU_CLIENT_PATH);
  const Domo = DomoModule.default || DomoModule;
  return new Domo(config.instance || INSTANCE, config.refreshToken, RYUU_CLIENT_ID, undefined, false);
}

async function executeSql(sql) {
  const response = await domo.processRequestRaw({
    url: `https://${INSTANCE}/api/query/v1/execute/${DATASET_ID}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    data: { sql }
  });

  return toRowObjects(response.data);
}

function toRowObjects(response) {
  const columns = response?.columns || [];
  const rows = response?.rows || [];
  return rows.map((row) => Object.fromEntries(
    columns.map((column, index) => [column, normalizeValue(row[index])])
  ));
}

function normalizeValue(value) {
  return value === '' ? null : value;
}

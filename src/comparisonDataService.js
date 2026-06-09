import { getDomoClient, isDomoRuntime } from './domoClient.js';

export const L4L_COMPARISON_ALIAS = 'l4lComparisonFact';

export const L4L_REQUIRED_FIELDS = [
  'comparison_side',
  'metric',
  'period_type',
  'period_label_current',
  'period_label_prior',
  'store_code',
  'store_name',
  'region',
  'week_ending',
  'week_of_year',
  'financial_year',
  'source_value',
  'source_row_count',
  'system_include_flag',
  'manual_include_flag',
  'final_include_flag',
  'mask_include_flag',
  'final_reason_code'
];

const OPTIONAL_FIELDS = [
  'comparable_week_slot',
  'month_of_year',
  'manual_reason',
  'system_reason_code',
  'effective_include_flag',
  'paired_slot_include_flag',
  'is_manual_override',
  'period_label'
];

export function buildComparisonDataEndpoint() {
  return `/data/v1/${L4L_COMPARISON_ALIAS}`;
}

export async function loadComparisonRows({
  domoClient = getDomoClient(),
  runtimeAvailable = isDomoRuntime()
} = {}) {
  if (!runtimeAvailable || !domoClient || typeof domoClient.get !== 'function') {
    return emptyComparisonResult({
      source: 'local',
      message: 'No L4L comparison data is available. Run the Prepare L4L Comparison Facts Workflow first.',
      diagnostics: {
        alias: L4L_COMPARISON_ALIAS,
        mapped: false,
        queryable: false,
        message: 'L4L comparison data is available only inside Domo after the output dataset alias is mapped.'
      }
    });
  }

  try {
    const rows = await domoClient.get(buildComparisonDataEndpoint());
    const normalizedRows = normalizeComparisonRows(Array.isArray(rows) ? rows : []);
    const validation = validateComparisonFields(normalizedRows);

    if (!normalizedRows.length) {
      return emptyComparisonResult({
        source: 'domo',
        message: 'No L4L comparison data is available. Run the Prepare L4L Comparison Facts Workflow first.',
        diagnostics: {
          alias: L4L_COMPARISON_ALIAS,
          mapped: true,
          queryable: true,
          message: 'The L4L comparison dataset alias is queryable but returned no rows.'
        }
      });
    }

    return {
      rows: normalizedRows,
      source: 'domo',
      empty: false,
      validation,
      diagnostics: {
        alias: L4L_COMPARISON_ALIAS,
        mapped: true,
        queryable: true,
        message: validation.valid
          ? 'The L4L comparison dataset alias is queryable.'
          : `Missing required L4L comparison fields: ${validation.missingFields.join(', ')}.`
      }
    };
  } catch (error) {
    return emptyComparisonResult({
      source: 'domo',
      message: `Unable to load L4L comparison rows: ${readableError(error)}`,
      diagnostics: {
        alias: L4L_COMPARISON_ALIAS,
        mapped: true,
        queryable: false,
        errorStatus: getErrorStatus(error),
        errorMessage: readableError(error),
        message: 'The L4L comparison dataset alias is not mapped or not queryable.'
      }
    });
  }
}

export function normalizeComparisonRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const sourceRowCount = numeric(row.source_row_count);
    return {
      ...row,
      source_value: numeric(row.source_value),
      source_row_count: sourceRowCount,
      comparable_week_slot: numericOrNull(row.comparable_week_slot),
      week_of_year: numericOrNull(row.week_of_year),
      month_of_year: numericOrNull(row.month_of_year),
      source_data_status: sourceRowCount > 0 ? 'Available' : 'Missing / Zero-filled'
    };
  });
}

export function validateComparisonFields(rows) {
  const firstRow = (Array.isArray(rows) ? rows : []).find(Boolean);
  if (!firstRow) return { valid: true, missingFields: [] };

  const missingFields = L4L_REQUIRED_FIELDS.filter((fieldName) => !(fieldName in firstRow));
  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

function emptyComparisonResult({ source, message, diagnostics }) {
  return {
    rows: [],
    source,
    empty: true,
    message,
    validation: { valid: true, missingFields: [] },
    diagnostics
  };
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getErrorStatus(error) {
  return error?.status || error?.statusCode || error?.response?.status || '';
}

function readableError(error) {
  if (!error) return 'Unknown error';
  return error.message || String(error);
}

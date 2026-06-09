import { COLLECTIONS, FLAGS } from './constants.js';

export function buildValidationSummary({
  runId,
  profile,
  periodRows,
  maskRows,
  selectedStore = null,
  selectedMetric = '',
  selectedPeriodType = '',
  selectedScopeSummary = {},
  generationMode = 'SELECTED_SCOPE',
  outputCollection = COLLECTIONS.selectedScopeMask,
  maskRowsDeleted = 0,
  maskRowsInserted = 0,
  rebuildStatus = 'pending'
}) {
  const scoped = computeSelectedScopeValidation({
    maskRows,
    selectedStore,
    selectedMetric,
    selectedPeriodType
  });

  return {
    run_id: runId,
    generation_mode: generationMode,
    output_collection: outputCollection,
    selected_store: selectedStore?.store_code || '',
    selected_metric: selectedMetric || '',
    selected_period_type: selectedPeriodType || '',
    total_mask_rows: scoped.total_mask_rows,
    included_mask_rows: scoped.included_mask_rows,
    excluded_mask_rows: scoped.excluded_mask_rows,
    weeks_without_source_data: Number(selectedScopeSummary.missing_source_week_count || 0),
    manual_coverage_adjustments_applied: Number(selectedScopeSummary.active_manual_override_count || 0),
    mask_rows_deleted: maskRowsDeleted,
    mask_rows_inserted: maskRowsInserted,
    rebuild_status: rebuildStatus,
    excluded_stores_by_reason_code: countDistinctStoresBy(scoped.maskRows, 'final_reason_code'),
    rows_by_period_type_and_side: countRowsBy(scoped.maskRows, (row) => `${row.period_type} / ${row.comparison_side}`),
    rows_by_region: countRowsBy(scoped.maskRows, (row) => row.region || 'Unknown'),
    missing_commencement_date_warnings: scoped.missing_commencement_date_warnings,
    invalid_date_warnings: scoped.invalid_date_warnings,
    zero_fill_note: 'Missing Store x Week x Metric source facts are not exclusions. Downstream Magic ETL will zero-fill values.'
  };
}

export function computeSelectedScopeValidation({
  maskRows = [],
  selectedStore = null,
  selectedMetric = '',
  selectedPeriodType = ''
} = {}) {
  const scopedRows = filterMaskRows(maskRows, selectedStore?.store_code || '', selectedMetric, selectedPeriodType);

  return {
    maskRows: scopedRows,
    total_mask_rows: scopedRows.length,
    included_mask_rows: scopedRows.filter((row) => row.mask_include_flag === FLAGS.yes).length,
    excluded_mask_rows: scopedRows.filter((row) => row.mask_include_flag === FLAGS.no).length,
    missing_commencement_date_warnings: countDistinctStoresWithReason(scopedRows, 'MISSING_COMMENCEMENT_DATE'),
    invalid_date_warnings: countRowsWithReasons(scopedRows, [
      'INVALID_COMMENCEMENT_DATE',
      'INVALID_CLOSURE_DATE',
      'INVALID_PERIOD_DATES'
    ])
  };
}

function countRowsBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function countDistinctStoresBy(rows, field) {
  const grouped = {};
  for (const row of rows) {
    if (row.mask_include_flag === FLAGS.yes) continue;
    const key = row[field] || 'Unknown';
    if (!grouped[key]) grouped[key] = new Set();
    grouped[key].add(row.store_code);
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([key, stores]) => [key, stores.size])
  );
}

function filterMaskRows(maskRows, storeCode, metric, periodType) {
  return (Array.isArray(maskRows) ? maskRows : []).filter((row) => (
    (!storeCode || row.store_code === storeCode)
    && (!metric || row.metric === metric)
    && (!periodType || row.period_type === periodType)
  ));
}

function countDistinctStoresWithReason(rows, reasonCode) {
  return new Set(
    rows
      .filter((row) => row.system_reason_code === reasonCode || row.final_reason_code === reasonCode)
      .map((row) => row.store_code)
      .filter(Boolean)
  ).size;
}

function countRowsWithReasons(rows, reasonCodes) {
  const reasonSet = new Set(reasonCodes);
  return rows.filter((row) => (
    reasonSet.has(row.system_reason_code)
    || reasonSet.has(row.final_reason_code)
  )).length;
}

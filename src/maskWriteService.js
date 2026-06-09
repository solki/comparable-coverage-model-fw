import { ALGORITHM_VERSION, COLLECTIONS, SOURCE_DATASET_ALIAS } from './constants.js';
import { clearCollectionDocuments, createAppDbClients, createDocumentsInBatches } from './appdbClient.js';
import { summarizeMaskRows } from './maskGenerator.js';

export function createRunId(date = new Date()) {
  return `ccm_phase1_${date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
}

export function buildRunRecord({
  runId,
  startedAt,
  completedAt = null,
  status,
  profile,
  periodRows,
  maskRows,
  errorMessage = null,
  generationMode = 'SELECTED_SCOPE',
  selectedStore = '',
  selectedMetric = '',
  selectedPeriodType = '',
  outputCollection = COLLECTIONS.selectedScopeMask,
  maskRowsDeleted = 0,
  maskRowsInserted = 0,
  rebuildStatus = 'pending'
}) {
  const summary = summarizeMaskRows(maskRows);
  return {
    id: runId,
    run_id: runId,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    generation_mode: generationMode,
    output_collection: outputCollection,
    selected_store: selectedStore,
    selected_metric: selectedMetric,
    selected_period_type: selectedPeriodType,
    source_dataset_alias: SOURCE_DATASET_ALIAS,
    source_row_count: profile?.source_row_count || 0,
    store_count: profile?.store_count || 0,
    period_count: new Set((periodRows || []).map((row) => row.period_type)).size,
    period_week_count: (periodRows || []).length,
    mask_row_count: summary.mask_row_count,
    included_mask_row_count: summary.included_mask_row_count,
    excluded_store_count: summary.excluded_store_count,
    mask_rows_deleted: maskRowsDeleted,
    mask_rows_inserted: maskRowsInserted,
    rebuild_status: rebuildStatus,
    error_message: errorMessage,
    version: ALGORITHM_VERSION
  };
}

export async function writeMaskRun({ runRecord, maskRows, dryRun }) {
  const outputCollection = runRecord.output_collection || COLLECTIONS.selectedScopeMask;
  const rowsForOutput = prepareMaskRowsForOutput(maskRows, {
    generationMode: runRecord.generation_mode || 'SELECTED_SCOPE',
    outputCollection
  });

  if (dryRun) {
    return {
      wrote: false,
      runRecord: { ...runRecord, status: 'dry_run', completed_at: new Date().toISOString() },
      touchedCollections: []
    };
  }

  const clients = createAppDbClients();
  const touchedCollections = [
    COLLECTIONS.selectedScopeMask,
    COLLECTIONS.generationRuns
  ];

  const createdRun = await clients.generationRuns.create({ ...runRecord, status: 'running' });
  const runDocumentId = createdRun?.body?.id || createdRun?.id;
  let clearCompleted = false;
  let maskRowsDeleted = 0;

  try {
    const clearResult = await clearCollectionDocuments(clients.selectedScopeMask, { batchSize: 100 });
    clearCompleted = true;
    maskRowsDeleted = clearResult.deleted;
    await createDocumentsInBatches(clients.selectedScopeMask, rowsForOutput, 100);

    const completed = {
      ...runRecord,
      status: 'completed',
      completed_at: new Date().toISOString(),
      mask_rows_deleted: maskRowsDeleted,
      mask_rows_inserted: rowsForOutput.length,
      rebuild_status: 'completed'
    };
    await updateRunDocument(clients.generationRuns, runDocumentId, completed);

    return {
      wrote: true,
      runRecord: completed,
      touchedCollections,
      maskRowsDeleted,
      maskRowsInserted: rowsForOutput.length
    };
  } catch (error) {
    const failed = {
      ...runRecord,
      status: 'failed',
      completed_at: new Date().toISOString(),
      mask_rows_deleted: maskRowsDeleted,
      mask_rows_inserted: 0,
      rebuild_status: clearCompleted ? 'insert_failed' : 'clear_failed',
      error_message: error.message || String(error)
    };
    await updateRunDocument(clients.generationRuns, runDocumentId, failed);
    throw error;
  }
}

async function updateRunDocument(client, documentId, content) {
  if (documentId && typeof client.update === 'function') {
    return client.update({ id: documentId, content });
  }

  return client.create(content);
}

function prepareMaskRowsForOutput(rows, { generationMode, outputCollection }) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    generation_mode: row.generation_mode || generationMode,
    output_collection: row.output_collection || outputCollection,
    inclusion_key: row.inclusion_key || [row.store_code, row.metric, row.week_ending].filter(Boolean).join('|')
  }));
}

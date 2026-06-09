import test from 'node:test';
import assert from 'node:assert/strict';

import { COLLECTIONS } from '../src/constants.js';
import { buildRunRecord, writeMaskRun } from '../src/maskWriteService.js';

const selectedMaskRows = [
  maskRow({ id: 'row-1', side: 'current', weekEnding: '2026-06-21' }),
  maskRow({ id: 'row-2', side: 'prior', weekEnding: '2025-06-22' })
];

test('selected-scope rebuild clears selected-scope mask before inserting selected rows only', async () => {
  const calls = [];
  globalThis.domo = {
    post(endpoint, payload) {
      calls.push({ method: 'post', endpoint, payload });
      if (endpoint.includes(`${COLLECTIONS.selectedScopeMask}/documents/query`)) {
        return Promise.resolve([
          { id: 'old-1', content: { active_flag: 'Y' } },
          { id: 'old-2', content: { active_flag: 'Y' } }
        ]);
      }
      if (endpoint.endsWith(`${COLLECTIONS.generationRuns}/documents/`)) {
        return Promise.resolve({ body: { id: 'run-doc-1' } });
      }
      return Promise.resolve({ body: { id: payload.content.id } });
    },
    delete(endpoint) {
      calls.push({ method: 'delete', endpoint });
      return Promise.resolve({ ok: true });
    },
    put(endpoint, payload) {
      calls.push({ method: 'put', endpoint, payload });
      return Promise.resolve({ ok: true });
    }
  };

  try {
    const result = await writeMaskRun({
      runRecord: runRecord(),
      maskRows: selectedMaskRows,
      dryRun: false
    });

    const deleteIndex = calls.findIndex((call) => call.method === 'delete');
    const firstMaskInsertIndex = calls.findIndex((call) => (
      call.method === 'post'
      && call.endpoint.endsWith(`${COLLECTIONS.selectedScopeMask}/documents/`)
    ));
    const maskInserts = calls.filter((call) => (
      call.method === 'post'
      && call.endpoint.endsWith(`${COLLECTIONS.selectedScopeMask}/documents/`)
    ));

    assert.ok(deleteIndex >= 0);
    assert.ok(firstMaskInsertIndex > deleteIndex);
    assert.equal(maskInserts.length, selectedMaskRows.length);
    assert.ok(maskInserts.every((call) => call.payload.content.store_code === 'S001'));
    assert.ok(maskInserts.every((call) => call.payload.content.metric === 'Sales'));
    assert.ok(maskInserts.every((call) => call.payload.content.period_type === 'Last Week'));
    assert.ok(maskInserts.every((call) => call.payload.content.output_collection === COLLECTIONS.selectedScopeMask));
    assert.equal(result.maskRowsDeleted, 2);
    assert.equal(result.maskRowsInserted, 2);
    assert.equal(result.runRecord.generation_mode, 'SELECTED_SCOPE');
    assert.equal(result.runRecord.output_collection, COLLECTIONS.selectedScopeMask);
    assert.equal(result.runRecord.mask_rows_deleted, 2);
    assert.equal(result.runRecord.mask_rows_inserted, 2);
    assert.equal(result.runRecord.rebuild_status, 'completed');
  } finally {
    delete globalThis.domo;
  }
});

test('selected-scope rebuild clears only selected-scope output collection', async () => {
  const deleteEndpoints = [];
  globalThis.domo = {
    post(endpoint, payload) {
      if (endpoint.includes(`${COLLECTIONS.selectedScopeMask}/documents/query`)) {
        return Promise.resolve([{ id: 'old-1', content: { active_flag: 'Y' } }]);
      }
      if (endpoint.endsWith(`${COLLECTIONS.generationRuns}/documents/`)) {
        return Promise.resolve({ body: { id: 'run-doc-1' } });
      }
      return Promise.resolve({ body: { id: payload.content.id } });
    },
    delete(endpoint) {
      deleteEndpoints.push(endpoint);
      return Promise.resolve({ ok: true });
    },
    put() {
      return Promise.resolve({ ok: true });
    }
  };

  try {
    await writeMaskRun({
      runRecord: runRecord(),
      maskRows: selectedMaskRows,
      dryRun: false
    });

    assert.ok(deleteEndpoints.every((endpoint) => endpoint.includes(COLLECTIONS.selectedScopeMask)));
    assert.ok(deleteEndpoints.every((endpoint) => !endpoint.includes(COLLECTIONS.metricWeekOverrides)));
    assert.ok(deleteEndpoints.every((endpoint) => !endpoint.includes(COLLECTIONS.generationRuns)));
    assert.ok(deleteEndpoints.every((endpoint) => !endpoint.includes(COLLECTIONS.fullMask)));
    assert.ok(deleteEndpoints.every((endpoint) => !endpoint.includes('ccm_l4l_week_mask')));
  } finally {
    delete globalThis.domo;
  }
});

test('selected-scope rebuild does not insert mask rows when clear fails', async () => {
  const calls = [];
  globalThis.domo = {
    post(endpoint, payload) {
      calls.push({ method: 'post', endpoint, payload });
      if (endpoint.includes(`${COLLECTIONS.selectedScopeMask}/documents/query`)) {
        return Promise.resolve([{ id: 'old-1', content: { active_flag: 'Y' } }]);
      }
      if (endpoint.endsWith(`${COLLECTIONS.generationRuns}/documents/`)) {
        return Promise.resolve({ body: { id: 'run-doc-1' } });
      }
      return Promise.resolve({ body: { id: payload.content.id } });
    },
    delete(endpoint) {
      calls.push({ method: 'delete', endpoint });
      return Promise.reject(new Error('clear failed'));
    },
    put(endpoint, payload) {
      calls.push({ method: 'put', endpoint, payload });
      return Promise.resolve({ ok: true });
    }
  };

  try {
    await assert.rejects(
      () => writeMaskRun({
        runRecord: runRecord(),
        maskRows: selectedMaskRows,
        dryRun: false
      }),
      /clear failed/
    );

    const maskInserts = calls.filter((call) => (
      call.method === 'post'
      && call.endpoint.endsWith(`${COLLECTIONS.selectedScopeMask}/documents/`)
    ));
    const failedRunUpdate = calls.find((call) => (
      call.method === 'put'
      && call.endpoint.includes(COLLECTIONS.generationRuns)
    ));
    const touchedDeprecatedMask = calls.some((call) => call.endpoint.includes('ccm_l4l_week_mask'));
    const touchedFullMask = calls.some((call) => call.endpoint.includes(COLLECTIONS.fullMask));

    assert.equal(maskInserts.length, 0);
    assert.equal(touchedDeprecatedMask, false);
    assert.equal(touchedFullMask, false);
    assert.equal(failedRunUpdate.payload.content.status, 'failed');
    assert.equal(failedRunUpdate.payload.content.output_collection, COLLECTIONS.selectedScopeMask);
    assert.equal(failedRunUpdate.payload.content.rebuild_status, 'clear_failed');
    assert.match(failedRunUpdate.payload.content.error_message, /clear failed/);
  } finally {
    delete globalThis.domo;
  }
});

function runRecord() {
  return buildRunRecord({
    runId: 'run_1',
    startedAt: '2026-06-09T00:00:00.000Z',
    status: 'running',
    profile: { source_row_count: 100, store_count: 1 },
    periodRows: selectedMaskRows,
    maskRows: selectedMaskRows,
    generationMode: 'SELECTED_SCOPE',
    selectedStore: 'S001',
    selectedMetric: 'Sales',
    selectedPeriodType: 'Last Week',
    outputCollection: COLLECTIONS.selectedScopeMask
  });
}

function maskRow({ id, side, weekEnding }) {
  return {
    id,
    run_id: 'run_1',
    active_flag: 'Y',
    period_type: 'Last Week',
    comparison_side: side,
    comparable_week_slot: 1,
    store_code: 'S001',
    store_name: 'Demo Store',
    region: 'NSW/ACT',
    metric: 'Sales',
    week_ending: weekEnding,
    week_of_year: 12,
    month_of_year: 12,
    financial_year: '25-26',
    system_include_flag: 'Y',
    manual_include_flag: 'Y',
    final_include_flag: 'Y',
    mask_include_flag: 'Y',
    final_reason_code: 'INCLUDED'
  };
}

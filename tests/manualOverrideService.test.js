import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildManualOverrideDocuments,
  manualOverrideKey,
  loadManualOverrides,
  validateManualOverride
} from '../src/manualOverrideService.js';
import { COLLECTIONS } from '../src/constants.js';

test('manual override N requires a manual reason', () => {
  assert.throws(
    () => validateManualOverride({ manual_include_flag: 'N', manual_reason: '' }),
    /manual_reason is required/
  );
  assert.doesNotThrow(
    () => validateManualOverride({ manual_include_flag: 'N', manual_reason: 'Renovation' })
  );
});

test('default manual include Y rows are not saved as override documents', () => {
  const docs = buildManualOverrideDocuments({
    store: { store_code: 'S001', store_name: 'Demo Store', region: 'NSW/ACT' },
    metric: 'Sales',
    overrides: [
      { week_ending: '2025-09-14', manual_include_flag: 'Y', manual_reason: '', manual_note: '' },
      { week_ending: '2025-09-21', manual_include_flag: 'N', manual_reason: 'Renovation', manual_note: '' }
    ],
    updatedBy: 'tester',
    updatedAt: '2026-06-08T00:00:00.000Z'
  });

  assert.deepEqual(docs.map((doc) => doc.week_ending), ['2025-09-21']);
  assert.equal(docs[0].store_code, 'S001');
  assert.equal(docs[0].metric, 'Sales');
  assert.equal(docs[0].active_flag, 'Y');
});

test('manual override documents store period context snapshot fields', () => {
  const docs = buildManualOverrideDocuments({
    store: { store_code: 'S001', store_name: 'Demo Store', region: 'NSW/ACT' },
    metric: 'Sales',
    overrides: [{
      week_ending: '2025-09-21',
      period_type: 'Year to Date',
      comparison_side: 'current',
      comparable_week_slot: 4,
      financial_year: '25-26',
      week_of_year: 12,
      month_of_year: 5,
      manual_include_flag: 'N',
      manual_reason: 'Renovation',
      manual_note: 'Decision made from YTD review'
    }],
    updatedBy: 'tester',
    updatedAt: '2026-06-09T00:00:00.000Z'
  });

  assert.deepEqual(docs[0], {
    id: 'S001_Sales_2025_09_21',
    store_code: 'S001',
    store_name: 'Demo Store',
    region: 'NSW/ACT',
    metric: 'Sales',
    week_ending: '2025-09-21',
    period_type: 'Year to Date',
    comparison_side: 'current',
    comparable_week_slot: 4,
    financial_year: '25-26',
    week_of_year: 12,
    month_of_year: 5,
    manual_include_flag: 'N',
    manual_reason: 'Renovation',
    manual_note: 'Decision made from YTD review',
    updated_by: 'tester',
    updated_at: '2026-06-09T00:00:00.000Z',
    active_flag: 'Y',
    source: 'ccm_phase1_app',
    version: 'phase1.0',
    override_scope: 'STORE_METRIC_WEEK'
  });
});

test('manual override business key ignores period context fields', () => {
  const base = {
    store_code: 'S001',
    metric: 'Sales',
    week_ending: '2025-09-21'
  };

  assert.equal(
    manualOverrideKey({
      ...base,
      period_type: 'Year to Date',
      comparison_side: 'current',
      comparable_week_slot: 4
    }),
    manualOverrideKey({
      ...base,
      period_type: 'Last Month',
      comparison_side: 'prior',
      comparable_week_slot: 1
    })
  );
});

test('manual overrides load active rows for selected store and metric from AppDB', async () => {
  const calls = [];
  globalThis.domo = {
    post(endpoint, payload) {
      calls.push({ endpoint, payload });
      return Promise.resolve([
        {
          id: 'doc-1',
          content: {
            store_code: 'S001',
            metric: 'Sales',
            week_ending: '2025-09-14',
            manual_include_flag: 'N',
            manual_reason: 'Renovation',
            active_flag: 'Y'
          }
        }
      ]);
    }
  };

  try {
    const rows = await loadManualOverrides({ storeCode: 'S001', metric: 'Sales' });

    assert.deepEqual(rows, [{
      _document_id: 'doc-1',
      store_code: 'S001',
      metric: 'Sales',
      week_ending: '2025-09-14',
      manual_include_flag: 'N',
      manual_reason: 'Renovation',
      active_flag: 'Y'
    }]);
    assert.equal(
      calls[0].endpoint,
      `/domo/datastores/v1/collections/${COLLECTIONS.metricWeekOverrides}/documents/query`
    );
    assert.deepEqual(calls[0].payload, {
      $and: [
        { 'content.active_flag': { $eq: 'Y' } },
        { 'content.store_code': { $eq: 'S001' } },
        { 'content.metric': { $eq: 'Sales' } }
      ]
    });
  } finally {
    delete globalThis.domo;
  }
});

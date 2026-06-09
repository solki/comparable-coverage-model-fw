import test from 'node:test';
import assert from 'node:assert/strict';

import { COLLECTIONS } from '../src/constants.js';
import {
  clearCollectionDocuments,
  createAppDbClients,
  createDocumentsClient,
  deactivateActiveDocuments,
  getDocuments
} from '../src/appdbClient.js';

test('AppDB document client uses collection name REST paths', async () => {
  const calls = [];
  globalThis.domo = {
    get(endpoint) {
      calls.push(endpoint);
      return Promise.resolve([
        { id: 'doc-1', content: { period_type: 'last_week' } }
      ]);
    }
  };

  try {
    const client = createDocumentsClient(COLLECTIONS.metricWeekOverrides);
    const docs = await getDocuments(client);

    assert.deepEqual(calls, [
      `/domo/datastores/v1/collections/${COLLECTIONS.metricWeekOverrides}/documents/`
    ]);
    assert.deepEqual(docs, [
      { _document_id: 'doc-1', period_type: 'last_week' }
    ]);
  } finally {
    delete globalThis.domo;
  }
});

test('AppDB clients expose only 1.0.2 active AppDB clients', () => {
  const clients = createAppDbClients();

  assert.deepEqual(Object.keys(clients), [
    'metricWeekOverrides',
    'selectedScopeMask',
    'generationRuns'
  ]);
  assert.equal(clients.metricWeekOverrides.collectionName, COLLECTIONS.metricWeekOverrides);
  assert.equal(clients.selectedScopeMask.collectionName, COLLECTIONS.selectedScopeMask);
  assert.equal(clients.generationRuns.collectionName, COLLECTIONS.generationRuns);
  assert.equal(Object.hasOwn(clients, 'fullMask'), false);
  assert.equal(Object.hasOwn(clients, 'deprecatedL4lWeekMask'), false);
});

test('AppDB partial update only sets fields inside document content', async () => {
  const calls = [];
  globalThis.domo = {
    put(endpoint, payload) {
      calls.push({ endpoint, payload });
      return Promise.resolve({ count: 4 });
    }
  };

  try {
    const client = createDocumentsClient(COLLECTIONS.selectedScopeMask);
    await deactivateActiveDocuments(client);

    assert.deepEqual(calls, [{
      endpoint: `/domo/datastores/v1/collections/${COLLECTIONS.selectedScopeMask}/documents/update`,
      payload: {
        query: { 'content.active_flag': { $eq: 'Y' } },
        operation: { $set: { 'content.active_flag': 'N' } }
      }
    }]);
  } finally {
    delete globalThis.domo;
  }
});

test('clearCollectionDocuments deletes documents in batches and reports progress', async () => {
  const calls = [];
  const progress = [];
  globalThis.domo = {
    post(endpoint, payload) {
      calls.push({ method: 'post', endpoint, payload });
      if (endpoint.endsWith('offset=0')) {
        return Promise.resolve([
          { id: 'doc-1', content: { active_flag: 'Y' } },
          { id: 'doc-2', content: { active_flag: 'Y' } }
        ]);
      }
      return Promise.resolve([
        { id: 'doc-3', content: { active_flag: 'Y' } }
      ]);
    },
    delete(endpoint) {
      calls.push({ method: 'delete', endpoint });
      return Promise.resolve({ ok: true });
    }
  };

  try {
    const client = createDocumentsClient(COLLECTIONS.selectedScopeMask);
    const result = await clearCollectionDocuments(client, {
      batchSize: 2,
      pageSize: 2,
      onProgress: (update) => progress.push(update)
    });

    assert.deepEqual(result, {
      collectionName: COLLECTIONS.selectedScopeMask,
      total: 3,
      deleted: 3
    });
    assert.deepEqual(calls, [
      { method: 'post', endpoint: `/domo/datastores/v1/collections/${COLLECTIONS.selectedScopeMask}/documents/query?limit=2&offset=0`, payload: {} },
      { method: 'post', endpoint: `/domo/datastores/v1/collections/${COLLECTIONS.selectedScopeMask}/documents/query?limit=2&offset=2`, payload: {} },
      { method: 'delete', endpoint: `/domo/datastores/v1/collections/${COLLECTIONS.selectedScopeMask}/documents/bulk?ids=doc-1,doc-2` },
      { method: 'delete', endpoint: `/domo/datastores/v1/collections/${COLLECTIONS.selectedScopeMask}/documents/bulk?ids=doc-3` }
    ]);
    assert.deepEqual(progress.map((item) => `${item.phase}:${item.deleted}/${item.total}`), [
      'listing:0/2',
      'listing:0/3',
      'listed:0/3',
      'deleting:0/3',
      'deleted:2/3',
      'deleting:2/3',
      'deleted:3/3',
      'complete:3/3'
    ]);
  } finally {
    delete globalThis.domo;
  }
});

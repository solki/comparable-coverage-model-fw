import { COLLECTIONS } from './constants.js';
import { getDomoClient } from './domoClient.js';

const ALLOWED_COLLECTIONS = new Set([
  COLLECTIONS.metricWeekOverrides,
  COLLECTIONS.selectedScopeMask,
  COLLECTIONS.generationRuns
]);

export function createAppDbClients() {
  return {
    metricWeekOverrides: createDocumentsClient(COLLECTIONS.metricWeekOverrides),
    selectedScopeMask: createDocumentsClient(COLLECTIONS.selectedScopeMask),
    generationRuns: createDocumentsClient(COLLECTIONS.generationRuns)
  };
}

export function createDocumentsClient(collectionName) {
  assertAllowedCollection(collectionName);
  return {
    collectionName,
    get(query = undefined, queryParams = undefined) {
      return query !== undefined
        ? queryDocuments(collectionName, query, queryParams)
        : getCollectionDocuments(collectionName);
    },
    create(document) {
      return createCollectionDocument(collectionName, document);
    },
    update({ id, content }) {
      return updateCollectionDocument(collectionName, id, content);
    },
    partialUpdate(query, operation) {
      return partialUpdateCollectionDocuments(collectionName, query, operation);
    },
    bulkDelete(documentIds) {
      return deleteCollectionDocumentBatch(collectionName, documentIds);
    }
  };
}

export function unwrapDocuments(response) {
  const raw = response?.body || response;
  const docs = Array.isArray(raw) ? raw : [];
  return docs.map((doc) => ({
    _document_id: doc.id,
    ...(doc.content || doc)
  }));
}

export async function getDocuments(client, query = undefined, queryParams = undefined) {
  const response = query !== undefined ? await client.get(query, queryParams) : await client.get();
  return unwrapDocuments(response);
}

export async function createDocumentsInBatches(client, documents, batchSize = 100) {
  const created = [];
  for (let index = 0; index < documents.length; index += batchSize) {
    const batch = documents.slice(index, index + batchSize);
    for (const document of batch) {
      const response = await client.create(document);
      created.push(response?.body || response);
    }
  }
  return created;
}

export async function deactivateActiveDocuments(client) {
  if (typeof client.partialUpdate !== 'function') {
    throw new Error('AppDB partialUpdate is not available. Stop: do not delete records as a workaround.');
  }

  return client.partialUpdate(
    { 'content.active_flag': { $eq: 'Y' } },
    { $set: { 'content.active_flag': 'N' } }
  );
}

export async function clearCollectionDocuments(client, { batchSize = 100, pageSize = 500, onProgress = () => {} } = {}) {
  if (!client || typeof client.get !== 'function' || typeof client.bulkDelete !== 'function') {
    throw new Error('AppDB clear requires a document client with get and bulkDelete methods.');
  }

  const documentIds = await listCollectionDocumentIds(client, { pageSize, onProgress });
  const total = documentIds.length;
  let deleted = 0;

  onProgress({
    phase: 'listed',
    collectionName: client.collectionName,
    total,
    deleted
  });

  for (let index = 0; index < documentIds.length; index += batchSize) {
    const batchIds = documentIds.slice(index, index + batchSize);
    onProgress({
      phase: 'deleting',
      collectionName: client.collectionName,
      total,
      deleted,
      batchSize: batchIds.length
    });
    await client.bulkDelete(batchIds);
    deleted += batchIds.length;
    onProgress({
      phase: 'deleted',
      collectionName: client.collectionName,
      total,
      deleted,
      batchSize: batchIds.length
    });
  }

  onProgress({
    phase: 'complete',
    collectionName: client.collectionName,
    total,
    deleted
  });

  return {
    collectionName: client.collectionName,
    total,
    deleted
  };
}

async function listCollectionDocumentIds(client, { pageSize, onProgress }) {
  const documentIds = [];
  let offset = 0;

  while (true) {
    const documents = await getDocuments(client, {}, { limit: pageSize, offset });
    const pageIds = documents.map((document) => document._document_id).filter(Boolean);
    documentIds.push(...pageIds);

    onProgress({
      phase: 'listing',
      collectionName: client.collectionName,
      total: documentIds.length,
      deleted: 0,
      batchSize: pageIds.length
    });

    if (documents.length < pageSize) break;
    offset += pageSize;
  }

  return documentIds;
}

export function assertAllowedCollection(collectionName) {
  if (!ALLOWED_COLLECTIONS.has(collectionName)) {
    throw new Error(`Blocked AppDB action for non-project collection: ${collectionName}`);
  }
}

function getCollectionDocuments(collectionName) {
  const domo = requireDomoClient('get');
  return domo.get(documentsEndpoint(collectionName));
}

function queryDocuments(collectionName, query, queryParams = undefined) {
  const domo = requireDomoClient('post');
  const params = buildQueryParams(queryParams);
  const suffix = params ? `?${params}` : '';
  return domo.post(`${collectionEndpoint(collectionName)}/documents/query${suffix}`, query);
}

function createCollectionDocument(collectionName, document) {
  const domo = requireDomoClient('post');
  return domo.post(documentsEndpoint(collectionName), wrapDocument(document));
}

function updateCollectionDocument(collectionName, documentId, content) {
  if (!documentId) return createCollectionDocument(collectionName, content);

  const domo = requireDomoClient('put');
  return domo.put(`${documentsEndpoint(collectionName)}${encodeURIComponent(documentId)}`, wrapDocument(content));
}

function partialUpdateCollectionDocuments(collectionName, query, operation) {
  const domo = requireDomoClient('put');
  return domo.put(`${collectionEndpoint(collectionName)}/documents/update`, { query, operation });
}

function deleteCollectionDocumentBatch(collectionName, documentIds) {
  if (!Array.isArray(documentIds) || documentIds.length === 0) return Promise.resolve();

  const domo = requireDomoClient('delete');
  const idsQuery = documentIds.map(encodeURIComponent).join(',');
  return domo.delete(`${collectionEndpoint(collectionName)}/documents/bulk?ids=${idsQuery}`);
}

function documentsEndpoint(collectionName) {
  return `${collectionEndpoint(collectionName)}/documents/`;
}

function collectionEndpoint(collectionName) {
  assertAllowedCollection(collectionName);
  return `/domo/datastores/v1/collections/${encodeURIComponent(collectionName)}`;
}

function wrapDocument(document) {
  return Object.hasOwn(document || {}, 'content') ? document : { content: document };
}

function buildQueryParams(queryParams = undefined) {
  const params = new URLSearchParams();
  Object.entries(queryParams || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  return params.toString();
}

function requireDomoClient(methodName) {
  const domo = getDomoClient();
  if (!domo || typeof domo[methodName] !== 'function') {
    throw new Error(`Domo AppDB ${methodName} client is unavailable in this runtime.`);
  }
  return domo;
}

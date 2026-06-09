import { ALGORITHM_VERSION, COLLECTIONS, FLAGS, SOURCE_LABEL } from './constants.js';
import { createAppDbClients, getDocuments } from './appdbClient.js';
import { cleanString, normalizeDate } from './dateUtils.js';

export async function loadManualOverrides({ storeCode, metric }) {
  if (!storeCode || !metric) return [];

  const clients = createAppDbClients();
  return getDocuments(clients.metricWeekOverrides, {
    $and: [
      { 'content.active_flag': { $eq: FLAGS.yes } },
      { 'content.store_code': { $eq: storeCode } },
      { 'content.metric': { $eq: metric } }
    ]
  });
}

export async function saveManualOverrides({ store, metric, overrides, updatedBy = '', updatedAt = new Date().toISOString() }) {
  const clients = createAppDbClients();
  const documents = buildManualOverrideDocuments({ store, metric, overrides, updatedBy, updatedAt });
  const saved = [];

  for (const document of documents) {
    if (document._document_id) {
      const { _document_id, ...content } = document;
      saved.push(await clients.metricWeekOverrides.update({ id: _document_id, content }));
    } else {
      saved.push(await clients.metricWeekOverrides.create(document));
    }
  }

  return {
    collectionName: COLLECTIONS.metricWeekOverrides,
    savedCount: saved.length,
    saved
  };
}

export function buildManualOverrideDocuments({ store, metric, overrides, updatedBy = '', updatedAt = new Date().toISOString() }) {
  return (Array.isArray(overrides) ? overrides : [])
    .filter((override) => shouldPersistOverride(override))
    .map((override) => {
      validateManualOverride(override);
      const weekEnding = normalizeDate(override.week_ending);
      return {
        ...(override._document_id ? { _document_id: override._document_id } : {}),
        id: override.id || `${store.store_code}_${metric}_${weekEnding}`.replace(/[^A-Za-z0-9_]/g, '_'),
        store_code: store.store_code,
        store_name: store.store_name || '',
        region: store.region || '',
        metric,
        week_ending: weekEnding,
        period_type: cleanString(override.period_type),
        comparison_side: cleanString(override.comparison_side),
        comparable_week_slot: numberOrNull(override.comparable_week_slot),
        financial_year: cleanString(override.financial_year),
        week_of_year: numberOrNull(override.week_of_year),
        month_of_year: numberOrNull(override.month_of_year),
        manual_include_flag: normalizeFlag(override.manual_include_flag),
        manual_reason: cleanString(override.manual_reason),
        manual_note: cleanString(override.manual_note),
        updated_by: updatedBy,
        updated_at: updatedAt,
        active_flag: FLAGS.yes,
        source: SOURCE_LABEL,
        version: ALGORITHM_VERSION,
        override_scope: 'STORE_METRIC_WEEK'
      };
    });
}

export function buildManualOverrideMap(overrides) {
  const map = new Map();
  for (const override of Array.isArray(overrides) ? overrides : []) {
    if (override.active_flag && normalizeFlag(override.active_flag) !== FLAGS.yes) continue;
    const key = manualOverrideKey(override);
    if (key) map.set(key, override);
  }
  return map;
}

export function manualOverrideKey({ store_code, storeCode, metric, week_ending, weekEnding }) {
  const resolvedStoreCode = cleanString(store_code || storeCode);
  const resolvedMetric = cleanString(metric);
  const resolvedWeekEnding = normalizeDate(week_ending || weekEnding);
  if (!resolvedStoreCode || !resolvedMetric || !resolvedWeekEnding) return '';
  return [resolvedStoreCode, resolvedMetric, resolvedWeekEnding].join('|');
}

export function validateManualOverride(override) {
  const flag = normalizeFlag(override?.manual_include_flag);
  if (![FLAGS.yes, FLAGS.no].includes(flag)) {
    throw new Error('manual_include_flag must be Y or N.');
  }

  if (flag === FLAGS.no && !cleanString(override?.manual_reason)) {
    throw new Error('manual_reason is required when manual_include_flag is N.');
  }
}

function shouldPersistOverride(override) {
  const flag = normalizeFlag(override?.manual_include_flag);
  if (flag === FLAGS.no) return true;
  return Boolean(override?._document_id || cleanString(override?.manual_reason) || cleanString(override?.manual_note));
}

function normalizeFlag(value) {
  return cleanString(value).toUpperCase() === FLAGS.no ? FLAGS.no : FLAGS.yes;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

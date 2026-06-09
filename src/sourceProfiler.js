import { SOURCE_REQUIRED_FIELDS } from './constants.js';
import { cleanString, maxDate, minDate, normalizeDate, parseDateOnly } from './dateUtils.js';

export function profileSourceRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  validateRequiredFields(safeRows);

  const weeks = new Set();
  const metrics = new Set();
  const storeMap = new Map();
  const warnings = [];

  for (const row of safeRows) {
    const storeCode = cleanString(row['Store Code']);
    const weekEnding = parseDateOnly(row['Week Ending']);
    const metric = cleanString(row.Metric);

    if (weekEnding.valid && weekEnding.iso) {
      weeks.add(weekEnding.iso);
    } else if (!weekEnding.empty) {
      warnings.push({ type: 'invalid_week_ending', store_code: storeCode, value: row['Week Ending'] });
    }

    if (metric) metrics.add(metric);
    if (!storeCode) continue;

    if (!storeMap.has(storeCode)) {
      storeMap.set(storeCode, {
        store_code: storeCode,
        store_name_values: new Set(),
        region_values: new Set(),
        commencement_dates: [],
        closure_dates: [],
        warnings: []
      });
    }

    const store = storeMap.get(storeCode);
    addNonEmpty(store.store_name_values, row['Store Name']);
    addNonEmpty(store.region_values, row.Region);
    collectDate(store.commencement_dates, row['Store Trading Commencement date'], 'commencement', storeCode, warnings);
    collectDate(store.closure_dates, row['Store Closure Date'], 'closure', storeCode, warnings);
  }

  const stores = Array.from(storeMap.values()).map(normalizeStore);

  return {
    source_row_count: safeRows.length,
    store_count: stores.length,
    week_count: weeks.size,
    min_week_ending: minDate(weeks),
    max_week_ending: maxDate(weeks),
    metric_count: metrics.size,
    stores_missing_commencement_date: stores.filter((store) => !store.store_trading_commencement_date).length,
    stores_with_closure_date: stores.filter((store) => Boolean(store.store_closure_date)).length,
    date_parsing_warnings: warnings.length,
    warnings,
    stores,
    metrics: Array.from(metrics).sort().map((metric) => ({
      metric,
      source_row_count: safeRows.filter((row) => cleanString(row.Metric) === metric).length
    }))
  };
}

export function validateRequiredFields(rows) {
  if (rows.length === 0) return;
  const present = new Set(Object.keys(rows[0]));
  const missing = SOURCE_REQUIRED_FIELDS.filter((field) => !present.has(field));
  if (missing.length > 0) {
    throw new Error(`Missing required source fields: ${missing.join(', ')}`);
  }
}

function addNonEmpty(set, value) {
  const cleaned = cleanString(value);
  if (cleaned) set.add(cleaned);
}

function collectDate(target, value, kind, storeCode, warnings) {
  const cleaned = cleanString(value);
  if (!cleaned) return;

  const parsed = parseDateOnly(cleaned);
  if (parsed.valid && parsed.iso) {
    target.push(parsed.iso);
    return;
  }

  warnings.push({ type: `invalid_${kind}_date`, store_code: storeCode, value });
}

function normalizeStore(store) {
  const commencement = store.commencement_dates.sort()[0] || null;
  const closure = store.closure_dates.sort()[0] || null;

  return {
    store_code: store.store_code,
    store_name: Array.from(store.store_name_values)[0] || '',
    region: Array.from(store.region_values)[0] || '',
    store_trading_commencement_date: commencement,
    store_closure_date: closure,
    has_invalid_lifecycle_date: store.warnings.length > 0
  };
}

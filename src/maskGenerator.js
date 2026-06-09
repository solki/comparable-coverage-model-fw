import { ALGORITHM_VERSION, COLLECTIONS, FLAGS, REASON_CODES, SOURCE_LABEL } from './constants.js';
import { evaluateStoreEligibility } from './l4lEligibility.js';
import { manualOverrideKey, buildManualOverrideMap, validateManualOverride } from './manualOverrideService.js';
import { maxDate, minDate } from './dateUtils.js';

export function generateMaskRows({
  stores,
  metrics,
  periodRows,
  manualOverrides = [],
  runId,
  generatedAt,
  generationMode = 'SELECTED_SCOPE',
  outputCollection = COLLECTIONS.selectedScopeMask
}) {
  const safeStores = Array.isArray(stores) ? stores : [];
  const safeMetrics = normalizeMetrics(metrics);
  const safePeriods = Array.isArray(periodRows) ? periodRows : [];
  const overrideMap = buildManualOverrideMap(manualOverrides);
  const rows = [];

  for (const periodType of unique(safePeriods.map((row) => row.period_type))) {
    const rowsForPeriod = safePeriods.filter((row) => row.period_type === periodType);
    const currentPeriod = deriveCurrentEligibilityPeriod(rowsForPeriod);

    for (const store of safeStores) {
      const eligibility = evaluateStoreEligibility(store, currentPeriod);
      for (const metric of safeMetrics) {
        for (const periodWeek of rowsForPeriod) {
          rows.push(buildMaskRow({
            runId,
            generatedAt,
            generationMode,
            outputCollection,
            store,
            metric,
            periodWeek,
            eligibility,
            currentPeriod,
            manualOverride: overrideMap.get(manualOverrideKey({
              store_code: store.store_code,
              metric,
              week_ending: periodWeek.week_ending
            }))
          }));
        }
      }
    }
  }

  return applyPairedSlotPropagation(applyStoreMetricWeekPropagation(rows));
}

export function summarizeMaskRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return {
    mask_row_count: safeRows.length,
    included_mask_row_count: safeRows.filter((row) => row.mask_include_flag === FLAGS.yes).length,
    excluded_store_count: new Set(
      safeRows
        .filter((row) => row.system_include_flag !== FLAGS.yes)
        .map((row) => row.store_code)
    ).size,
    by_reason_code: countBy(safeRows, 'final_reason_code'),
    by_period_type_and_side: countBy(safeRows, (row) => `${row.period_type}|${row.comparison_side}`),
    by_region: countBy(safeRows, 'region')
  };
}

function buildMaskRow({
  runId,
  generatedAt,
  generationMode,
  outputCollection,
  store,
  metric,
  periodWeek,
  eligibility,
  currentPeriod,
  manualOverride
}) {
  const normalizedOverride = manualOverride || null;
  const manualFlag = normalizedOverride?.manual_include_flag === FLAGS.no ? FLAGS.no : FLAGS.yes;
  if (normalizedOverride) validateManualOverride({ ...normalizedOverride, manual_include_flag: manualFlag });

  const week53Excluded = Number(periodWeek.week_of_year) === 53;
  const systemFlag = eligibility.eligible && !week53Excluded ? FLAGS.yes : FLAGS.no;
  const effectiveFlag = systemFlag === FLAGS.yes && manualFlag === FLAGS.yes ? FLAGS.yes : FLAGS.no;
  const systemReason = week53Excluded ? REASON_CODES.week53Excluded : eligibility.reason_code;
  const baseReason = effectiveFlag === FLAGS.yes
    ? REASON_CODES.included
    : systemFlag === FLAGS.no
      ? systemReason
      : REASON_CODES.manualExcluded;

  return {
    id: [
      runId,
      periodWeek.period_type,
      periodWeek.comparison_side,
      periodWeek.comparable_week_slot,
      store.store_code,
      metric,
      periodWeek.week_ending
    ].join('_').replace(/[^A-Za-z0-9_]/g, '_'),
    run_id: runId,
    active_flag: FLAGS.yes,
    generated_at: generatedAt,
    generation_mode: generationMode,
    output_collection: outputCollection,
    inclusion_key: storeMetricWeekKey({
      store_code: store.store_code,
      metric,
      week_ending: periodWeek.week_ending
    }),
    period_type: periodWeek.period_type,
    period_label_current: periodWeek.period_label_current,
    period_label_prior: periodWeek.period_label_prior,
    comparison_side: periodWeek.comparison_side,
    comparable_week_slot: periodWeek.comparable_week_slot,
    store_code: store.store_code,
    store_name: store.store_name,
    region: store.region,
    metric,
    week_ending: periodWeek.week_ending,
    week_of_year: periodWeek.week_of_year,
    month_of_year: periodWeek.month_of_year,
    financial_year: periodWeek.financial_year,
    system_include_flag: systemFlag,
    manual_include_flag: manualFlag,
    effective_include_flag: effectiveFlag,
    paired_slot_include_flag: FLAGS.yes,
    final_include_flag: effectiveFlag,
    mask_include_flag: effectiveFlag,
    is_manual_override: normalizedOverride ? FLAGS.yes : FLAGS.no,
    manual_reason: normalizedOverride?.manual_reason || '',
    system_reason_code: systemReason,
    final_reason_code: baseReason,
    store_trading_commencement_date: store.store_trading_commencement_date,
    store_closure_date: store.store_closure_date || null,
    current_period_start_date: currentPeriod.current_period_start_date,
    current_period_end_date: currentPeriod.current_period_end_date,
    source: SOURCE_LABEL,
    version: ALGORITHM_VERSION
  };
}

function applyStoreMetricWeekPropagation(rows) {
  const excludedKeys = new Set(
    rows
      .filter((row) => row.effective_include_flag === FLAGS.no)
      .map((row) => storeMetricWeekKey(row))
  );

  return rows.map((row) => {
    if (!excludedKeys.has(storeMetricWeekKey(row))) return row;
    if (row.effective_include_flag === FLAGS.no) return row;

    return {
      ...row,
      effective_include_flag: FLAGS.no,
      final_include_flag: FLAGS.no,
      mask_include_flag: FLAGS.no,
      final_reason_code: REASON_CODES.storeMetricWeekPropagated
    };
  });
}

function applyPairedSlotPropagation(rows) {
  const excludedPairKeys = new Set(
    rows
      .filter((row) => row.effective_include_flag === FLAGS.no)
      .map((row) => pairedSlotKey(row))
  );

  return rows.map((row) => {
    if (!excludedPairKeys.has(pairedSlotKey(row))) return row;

    const finalReason = row.effective_include_flag === FLAGS.no
      ? row.final_reason_code
      : REASON_CODES.pairedSlotExcluded;

    return {
      ...row,
      paired_slot_include_flag: FLAGS.no,
      final_include_flag: FLAGS.no,
      mask_include_flag: FLAGS.no,
      final_reason_code: finalReason
    };
  });
}

function storeMetricWeekKey(row) {
  return [row.store_code, row.metric, row.week_ending].join('|');
}

function pairedSlotKey(row) {
  return [
    row.period_type,
    row.comparable_week_slot,
    row.store_code,
    row.metric
  ].join('|');
}

function deriveCurrentEligibilityPeriod(rowsForPeriod) {
  const currentRows = rowsForPeriod.filter((row) => row.comparison_side === 'current');
  return {
    current_period_start_date: minDate(currentRows.map((row) => row.current_period_start_date || row.week_ending)),
    current_period_end_date: maxDate(currentRows.map((row) => row.current_period_end_date || row.week_ending))
  };
}

function normalizeMetrics(metrics) {
  return (Array.isArray(metrics) ? metrics : [])
    .map((metric) => (typeof metric === 'string' ? metric : metric?.metric))
    .filter(Boolean);
}

function countBy(rows, keyOrFn) {
  const counts = {};
  for (const row of rows) {
    const key = typeof keyOrFn === 'function' ? keyOrFn(row) : row[keyOrFn];
    counts[key || 'Unknown'] = (counts[key || 'Unknown'] || 0) + 1;
  }
  return counts;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

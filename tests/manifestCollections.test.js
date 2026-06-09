import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COLLECTIONS } from '../src/constants.js';

const EXPECTED_SYNC_ENABLED = {
  [COLLECTIONS.metricWeekOverrides]: false,
  [COLLECTIONS.selectedScopeMask]: false,
  [COLLECTIONS.fullMask]: false,
  [COLLECTIONS.generationRuns]: true
};

const EXPECTED_SCHEMA_FIELDS = {
  [COLLECTIONS.metricWeekOverrides]: [
    'id',
    'store_code',
    'store_name',
    'region',
    'metric',
    'week_ending',
    'manual_include_flag',
    'manual_reason',
    'manual_note',
    'updated_by',
    'updated_at',
    'active_flag',
    'source',
    'version'
  ],
  [COLLECTIONS.selectedScopeMask]: [
    'id',
    'run_id',
    'generated_at',
    'generation_mode',
    'output_collection',
    'inclusion_key',
    'active_flag',
    'period_type',
    'period_label_current',
    'period_label_prior',
    'comparison_side',
    'comparable_week_slot',
    'store_code',
    'store_name',
    'region',
    'metric',
    'week_ending',
    'week_of_year',
    'month_of_year',
    'financial_year',
    'system_include_flag',
    'manual_include_flag',
    'effective_include_flag',
    'paired_slot_include_flag',
    'final_include_flag',
    'mask_include_flag',
    'is_manual_override',
    'manual_reason',
    'system_reason_code',
    'final_reason_code',
    'store_trading_commencement_date',
    'store_closure_date',
    'current_period_start_date',
    'current_period_end_date',
    'source',
    'version'
  ],
  [COLLECTIONS.fullMask]: [
    'id',
    'run_id',
    'generated_at',
    'generation_mode',
    'output_collection',
    'inclusion_key',
    'active_flag',
    'period_type',
    'period_label_current',
    'period_label_prior',
    'comparison_side',
    'comparable_week_slot',
    'store_code',
    'store_name',
    'region',
    'metric',
    'week_ending',
    'week_of_year',
    'month_of_year',
    'financial_year',
    'system_include_flag',
    'manual_include_flag',
    'effective_include_flag',
    'paired_slot_include_flag',
    'final_include_flag',
    'mask_include_flag',
    'is_manual_override',
    'manual_reason',
    'system_reason_code',
    'final_reason_code',
    'store_trading_commencement_date',
    'store_closure_date',
    'current_period_start_date',
    'current_period_end_date',
    'source',
    'version'
  ],
  [COLLECTIONS.generationRuns]: [
    'id',
    'run_id',
    'started_at',
    'completed_at',
    'status',
    'generation_mode',
    'output_collection',
    'selected_store',
    'selected_metric',
    'selected_period_type',
    'source_dataset_alias',
    'source_row_count',
    'store_count',
    'period_count',
    'period_week_count',
    'mask_row_count',
    'included_mask_row_count',
    'excluded_store_count',
    'mask_rows_deleted',
    'mask_rows_inserted',
    'rebuild_status',
    'error_message',
    'version'
  ]
};

test('manifest maps selected-scope and reserved full-mask AppDB collections', () => {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

  assert.equal(manifest.fileName, 'manifest.json');
  assert.ok(Array.isArray(manifest.collectionsMapping));
  assert.equal(
    manifest.collectionsMapping.some((collection) => collection.name === 'ccm_period_definition'),
    false
  );

  for (const [name, syncEnabled] of Object.entries(EXPECTED_SYNC_ENABLED)) {
    const mapping = manifest.collectionsMapping.find((collection) => collection.name === name);

    assert.ok(mapping, `manifest must map ${name}`);
    assert.equal(mapping.syncEnabled, syncEnabled);
    if (EXPECTED_SCHEMA_FIELDS[name]) {
      assert.ok(Array.isArray(mapping.schema?.columns), `${name} must include schema.columns`);
      assert.deepEqual(mapping.schema.columns.map((column) => column.name), EXPECTED_SCHEMA_FIELDS[name]);
    }
  }

  assert.equal(
    manifest.collectionsMapping.some((collection) => collection.name === 'ccm_l4l_week_mask'),
    false,
    'ccm_l4l_week_mask must not be mapped by the 1.0.2 manifest'
  );
});

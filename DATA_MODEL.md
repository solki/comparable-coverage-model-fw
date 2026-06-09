# Data Model

## Source Dataset Alias

The app reads source data through manifest alias `sourceMetrics`.

Production dataset mapping after manual publish:

`86e3e588-91c3-487b-8d9f-d585dbdbaf10`

The source dataset is read-only. The app must not mutate, replace, update, delete, rename, sync, or change its schema.

## Runtime Period Lens Definition

Period Lens definition is a derived runtime structure, not an AppDB dependency.

Module: `src/periodDefinition.js`

Derived fields:

| Field | Meaning |
| --- | --- |
| `period_type` | Period Lens: one of `Last Week`, `Last Month`, `Last Quarter`, `Year to Date`. |
| `period_label_current` | Current-side display label. |
| `period_label_prior` | Prior-side display label. |
| `comparison_side` | Comparison Side: `current` or `prior`. |
| `comparable_week_slot` | Comparable Slot between current and prior fiscal weeks. |
| `week_ending` | Fiscal week ending date. |
| `week_of_year` | Source fiscal week number. |
| `month_of_year` | Source fiscal month number. |
| `financial_year` | Source financial year label. |
| `current_period_start_date` | Start date used for system store inclusion checks. |
| `current_period_end_date` | End date used for system store inclusion checks. |
| `prior_period_start_date` | Prior comparison period start date. |
| `prior_period_end_date` | Prior comparison period end date. |

## Runtime Source Records and Weekly Coverage Records

Source Records are raw rows from the mapped source dataset.

The app queries `sourceMetrics` with read-only aggregate SQL to derive Weekly Coverage Records at Store x Metric x Fiscal Week grain. This is the CCM evaluation grain. These records are runtime-only and are not persisted by the app.

Runtime fields:

| Field | Meaning |
| --- | --- |
| `store_code` | Store code from the source dataset. |
| `metric` | Metric name from the source dataset. |
| `week_ending` | Fiscal week ending date. |
| `source_value` | Weekly Metric Value aggregated for Store x Metric x Fiscal Week. |
| `source_row_count` | Count of Source Records contributing to that Weekly Coverage Record. |
| `source_data_exists` | Source Data Status, `Y` when an aggregate fact exists for the selected Store x Metric x Fiscal Week. |

Weekly Coverage Records power the selected-scope summary and Comparable Week Review source data status. They are separate from global dataset overview fields.

## UI Summary Scope

Global Dataset Overview fields are unfiltered totals for the mapped `sourceMetrics` alias.

Selected Scope Summary fields are filtered to the current Store + Metric + Period Lens selection:

- selected source records
- weekly coverage records
- selected store and metric counts
- current/prior week counts
- scoped min/max week ending
- selected store lifecycle status
- source records matched and weeks without source data
- manual coverage adjustments
- trading expectation and final CCM outcome counts

Validation Summary is also selected-scope only and must not reuse global missing commencement or date warning counts.

## Phase 1 Generation Scope

Phase 1 writes only selected-scope output:

- selected Store
- selected Metric
- selected Period Lens

Each selected-scope rebuild clears `ccm_selected_scope_mask` before inserting the new selected-scope rows. During Phase 1 prototype validation, `ccm_selected_scope_mask` therefore contains only the latest selected-scope generated output, not a full CCM mask.

`ccm_metric_week_overrides` persists user decisions and is not cleared by selected-scope rebuilds. `ccm_generation_runs` is a technical log and is not cleared.

Selected Scope and Full Mask outputs are physically separated:

- `ccm_selected_scope_mask`: Phase 1 selected-scope output.
- `ccm_full_mask`: reserved future production full-mask output.
- `ccm_l4l_week_mask`: not used or mapped by version 1.0.2. Keep the Domo AppDB collection for versions 1.0.0 and 1.0.1.

## Collection: `ccm_metric_week_overrides`

Grain: `store_code + metric + week_ending`

Only user-changed manual coverage adjustment rows are saved. Default `Y` rows are not saved.

The fields `period_type`, `comparison_side`, `comparable_week_slot`, `financial_year`, `week_of_year`, and `month_of_year` are context snapshot fields only. They show where the user made the decision in the UI. They do not limit the adjustment to that Period Lens, Comparison Side, or Comparable Slot.

| Field | Meaning |
| --- | --- |
| `id` | Stable override id. |
| `store_code` | Store code. |
| `store_name` | Store name. |
| `region` | Store region. |
| `metric` | Metric name. |
| `week_ending` | Fiscal week ending date. |
| `period_type` | Context snapshot of the Period Lens where the adjustment was created. |
| `comparison_side` | Context snapshot of the side where the override was created. |
| `comparable_week_slot` | Context snapshot of the slot where the override was created. |
| `financial_year` | Context snapshot of the source financial year. |
| `week_of_year` | Context snapshot of the source fiscal week number. |
| `month_of_year` | Context snapshot of the source fiscal month number. |
| `manual_include_flag` | `Y` or `N`; default is runtime `Y` when no active override exists. |
| `manual_reason` | Required when `manual_include_flag = N`. |
| `manual_note` | Optional user note. |
| `updated_by` | User label captured by the app. |
| `updated_at` | Save timestamp. |
| `active_flag` | Active override marker. |
| `source` | App source label. |
| `version` | Algorithm version. |
| `override_scope` | Always `STORE_METRIC_WEEK`. |

If a user marks Store + Metric + Fiscal Week as `N`, that exclusion applies wherever the same Store + Metric + Fiscal Week appears across all Period Lenses.

## Collection: `ccm_selected_scope_mask`

Grain: `period_type + comparison_side + comparable_week_slot + store_code + metric + week_ending`

Phase 1 storage semantics: current generated output only. Rebuild Selected Scope clears the collection, then inserts only selected Store + Metric + Period Lens mask records. This prevents duplicates across repeated selected-scope generation runs.

| Field | Meaning |
| --- | --- |
| `id` | Stable generated row id. |
| `run_id` | Generation run id. |
| `generated_at` | Generation timestamp. |
| `generation_mode` | Always `SELECTED_SCOPE` in Phase 1. |
| `output_collection` | Always `ccm_selected_scope_mask` for selected-scope rows. |
| `inclusion_key` | Store + Metric + Week key used by inclusion propagation. |
| `active_flag` | Active mask marker. |
| `period_type` | Runtime Period Lens. |
| `period_label_current` | Current label. |
| `period_label_prior` | Prior label. |
| `comparison_side` | `current` or `prior`. |
| `comparable_week_slot` | Current/prior pairing slot. |
| `store_code` | Store code. |
| `store_name` | Store name. |
| `region` | Store region. |
| `metric` | Metric name. |
| `week_ending` | Fiscal week ending date. |
| `week_of_year` | Fiscal week number. |
| `month_of_year` | Fiscal month number. |
| `financial_year` | Financial year label. |
| `system_include_flag` | Trading Expectation Y/N from store trading date logic. |
| `manual_include_flag` | Manual Coverage Adjustment from active override or default `Y`. |
| `effective_include_flag` | Coverage Decision before propagation. |
| `paired_slot_include_flag` | Pair-level include after current/prior propagation. |
| `final_include_flag` | Final CCM Outcome after all propagation. |
| `mask_include_flag` | Downstream-compatible copy of Final CCM Outcome. |
| `is_manual_override` | `Y` if an active override supplied the manual flag. |
| `manual_reason` | Manual reason when present. |
| `system_reason_code` | Trading Expectation reason. |
| `final_reason_code` | Outcome Reason for the final include/exclude decision. |
| `store_trading_commencement_date` | Store lifecycle date. |
| `store_closure_date` | Store lifecycle date. |
| `current_period_start_date` | Current period start used for system inclusion. |
| `current_period_end_date` | Current period end used for system inclusion. |
| `source` | App source label. |
| `version` | Algorithm version. |

## Collection: `ccm_generation_runs`

Stores generation run metadata, row counts, status, and error messages. It must not reference a persisted period collection.

Selected-scope run metadata includes:

| Field | Meaning |
| --- | --- |
| `generation_mode` | Always `SELECTED_SCOPE` in Phase 1. |
| `output_collection` | `ccm_selected_scope_mask` for Phase 1 selected-scope rebuilds. |
| `selected_store` | Store code used for the selected-scope rebuild. |
| `selected_metric` | Metric used for the selected-scope rebuild. |
| `selected_period_type` | Period Lens used for the selected-scope rebuild. |
| `mask_rows_deleted` | Previous Mask Records Cleared from `ccm_selected_scope_mask`. |
| `mask_rows_inserted` | Mask Records Written for the selected scope. |
| `rebuild_status` | `pending_confirmation`, `completed`, `clear_failed`, or `insert_failed`. |

## Collection: `ccm_full_mask`

Reserved future production output collection. Phase 1 does not write to or clear this collection. Future production Workflow and Magic ETL should use `ccm_full_mask`, not `ccm_selected_scope_mask`.

## Legacy Collection: `ccm_l4l_week_mask`

Version 1.0.2 does not map, clear, delete, or write this collection. Keep the Domo AppDB collection in place because versions 1.0.0 and 1.0.1 may still use it.

## Downstream Dataset

The Phase 1 generated mask is selected-scope only. Downstream Workflow or Magic ETL should not be considered production-ready until full CCM mask generation writes `ccm_full_mask`.

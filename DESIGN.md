# Design

## Purpose

The custom app is an admin/generator tool for Phase 1 Comparable Coverage Model mask data. It is not the final reporting surface.

The app:

1. Reads `sourceMetrics`.
2. Lets the admin select Store + Metric + Period Lens.
3. Derives comparable fiscal weeks dynamically from source calendar fields.
4. Displays comparable weeks for review.
5. Lets the admin save manual Store + Metric + Fiscal Week coverage adjustments.
6. Generates selected-scope mask records only.
7. Clears and rebuilds `ccm_selected_scope_mask` with selected-scope mask records after confirmation.
8. Writes run metadata.

## Screen: Global Dataset Overview

Shows:

- Source Records
- total store count
- Fiscal Weeks
- total metric count
- First / Latest Week Ending
- Stores Missing Trading Commencement Date
- Stores With Closure Date
- global date parsing warning status

This panel is intentionally not affected by Store, Metric, or Period Lens selections.

## Screen: Selection

Controls:

- Store selector
- Metric selector
- Period Lens selector
- Refresh button

## Screen: Selected Scope Summary

Shows only values scoped to the selected Store + Metric + Period Lens:

- Selected Source Records
- Weekly Coverage Records
- Selected Store
- Selected Metric
- Selected Period Lens
- Current Comparable Weeks
- Prior Comparable Weeks
- First / Latest Comparable Week
- Store Trading Date Warnings
- Store Closure Status
- Source Records Matched
- Weeks Without Source Data
- Manual Coverage Adjustments
- Weeks Not Expected to Trade
- Included Comparable Weeks
- Excluded Comparable Weeks

Global dataset warnings are not shown in this panel. Dataset reads are query/aggregate reads only.

## Screen: Comparable Week Review / Override Editor

This screen replaces persisted period management.

It shows runtime-derived comparable weeks from `sourceMetrics`:

- Period Lens
- Comparison Side
- Comparable Slot
- Financial Year
- Fiscal Week
- Fiscal Month
- Week Ending
- Weekly Metric Value
- Source Data Status
- Trading Expectation
- Manual Coverage Adjustment
- Coverage Decision
- Final CCM Outcome
- Outcome Reason
- Alignment Impact

The admin can edit only manual coverage adjustments. Runtime Period Lens rows themselves are not saved.

Manual coverage adjustment identity remains `store_code + metric + week_ending`. Period Lens, Comparison Side, Comparable Slot, Financial Year, Fiscal Week, and Fiscal Month are saved on override records only as context snapshots showing where the decision was made. They do not limit the adjustment to that period lens or side.

Week 53 rows are shown when relevant and automatically excluded with reason `WEEK_53_EXCLUDED`.

## Screen: Generate Selected Scope

Active control:

- `Rebuild Selected Scope Mask`

Helper text makes clear that this rebuilds the selected-scope CCM output for the current Store, Metric, and Period Lens only. It is intended for Phase 1 validation, not production full-mask processing. Manual coverage adjustments are not affected.

Before execution, the app asks the user to confirm that existing selected-scope mask records will be cleared and replaced with the selected scope only.

Selected-scope rebuild touches:

- `ccm_selected_scope_mask`
- `ccm_generation_runs`

Manual coverage adjustment saves touch:

- `ccm_metric_week_overrides`

`ccm_metric_week_overrides` is never cleared. `ccm_generation_runs` is never cleared. If clearing `ccm_selected_scope_mask` fails, selected-scope rows are not inserted.

## Screen: Generate Full CCM Mask

The UI reserves a disabled `Generate Full CCM Mask` position for production development.

The disabled section shows `Output: Full CCM Mask`, `AppDB collection: ccm_full_mask`, and states that full generation is coming soon, planned for production, would rebuild the mask for all Stores x Metrics x Period Lenses, may take longer, and is intentionally disabled during Phase 1 prototype validation.

## Diagnostics

The app shows:

- whether `sourceMetrics` is queryable
- whether AppDB collections are reachable
- any query or AppDB error status/message

No secrets or tokens are logged.

## Validation Summary

Validation Summary is selected-scope only. It summarizes comparable week records for the selected Store + Metric + Period Lens and does not reuse global missing commencement or global date parsing warning counts.

Business Validation shows:

- Comparable Week Records
- Included Comparable Weeks
- Excluded Comparable Weeks
- Weeks Without Source Data
- Manual Coverage Adjustments Applied
- Store Trading Date Warnings
- Date Quality Warnings

Technical Write Summary shows:

- `generation_mode = SELECTED_SCOPE`
- `output_collection = ccm_selected_scope_mask`
- selected store
- selected metric
- selected period lens
- previous mask records cleared
- mask records written
- run id
- clear/rebuild status

## Data Flow

```text
sourceMetrics
  -> aggregate source summary, stores, metrics, week calendar, Store x Metric x Fiscal Week weekly coverage records
  -> runtime comparable week derivation
  -> active ccm_metric_week_overrides
  -> system + manual + propagation logic
  -> clear ccm_selected_scope_mask
  -> insert latest selected-scope ccm_selected_scope_mask records
  -> ccm_generation_runs
```

`ccm_l4l_week_mask` is not part of version 1.0.2. It is not mapped, cleared, or written by the Phase 1 app, but the Domo AppDB collection should remain for versions 1.0.0 and 1.0.1.

## Downstream Flow

The Phase 1 generated mask is selected-scope only and lives in `ccm_selected_scope_mask`. Workflow and Magic ETL should not be considered production-ready until full CCM mask generation writes `ccm_full_mask`.

## Safety

- The source dataset is read-only.
- The app must not mutate, replace, update, delete, rename, sync, or change the source dataset schema.
- `domo publish` must not be run without explicit approval.
- Domo platform objects are not created or modified automatically by local development work.

# Forty Winks CCM

This Domo custom app generates a Phase 1 Comparable Coverage Model weekly mask for selected Store + Metric + Period Lens scopes.

The app reads the mapped dataset alias `sourceMetrics`, derives comparable fiscal weeks at runtime, applies manual Store + Metric + Fiscal Week coverage adjustments, and writes technical mask records plus run metadata to project AppDB collections.

## Phase 1 Generation Strategy

Phase 1 supports only `Generate Selected Scope`.

Selected scope means the currently selected:

- Store
- Metric
- Period Lens

The active UI action is `Rebuild Selected Scope Mask`. After confirmation, it clears previous selected-scope mask records from `ccm_selected_scope_mask` and writes only the comparable week records for the selected Store + Metric + Period Lens. This means `ccm_selected_scope_mask` contains only the latest selected-scope output during Phase 1 prototype validation.

`ccm_metric_week_overrides` is persistent and is not cleared by selected-scope rebuilds. `ccm_generation_runs` is a technical log and is not cleared.

`Generate Full CCM Mask` is reserved for production development and is intentionally disabled in the Phase 1 prototype because full generation would process all Stores x Metrics x Period Lenses x Fiscal Weeks and may take too long for fast validation. Future full generation output is reserved for `ccm_full_mask`.

## Business Terminology

- Source Records are raw rows from the mapped source dataset.
- Weekly Coverage Records are aggregated to Store x Metric x Fiscal Week, which is the CCM evaluation grain.
- Trading Expectation is the system Y/N flag based on store trading commencement and closure dates.
- Weeks Not Expected to Trade are excluded by trading expectation logic.
- Included Comparable Weeks and Excluded Comparable Weeks refer to comparable weeks, not raw source rows.
- Mask Records are technical AppDB output records.
- Selected Scope Mask is for Phase 1 validation.
- Full CCM Mask is reserved for production.

## UI Scope Rules

The app separates global and selected-scope values:

- Global Dataset Overview shows unfiltered dataset-level totals.
- Selection contains Store, Metric, and Period Lens controls.
- Selected Scope Summary shows only the selected Store + Metric + Period Lens.
- Validation Summary is selected-scope only and does not reuse global missing commencement or global date warning counts.

The Domo runtime uses aggregate SQL for source reads, including Store x Metric x Fiscal Week weekly coverage records for weekly metric value, source data status, and weeks without source data checks. It does not load raw source dataset rows in Domo runtime.

## Phase 2 L4L Comparison Visualization

Phase 2 reads the existing Workflow output dataset through manifest alias `l4lComparisonFact`:

`DomoDev | Phase 2 Metric | L4L Weekly Comparison Fact`

After publishing the app manually, map alias `l4lComparisonFact` to this Domo dataset:

`e5dffb5a-176f-4564-a147-c0d7311a6880`

The app does not modify the Workflow, Magic ETL, DataFlow, source dataset, or AppDB for Phase 2. In Domo runtime, it can trigger the existing Workflow through manifest alias `prepareL4LFacts` with no start-node input parameters. The app polls the Workflow instance status and refreshes `l4lComparisonFact` after completion.

If `domo.workflow` is unavailable in the runtime, the app shows this fallback instruction:

`Run the Workflow manually in Domo, then click Refresh Results.`

The Phase 2 visualization infers Store, Metric, and Period Lens from the output dataset. L4L ON uses `mask_include_flag = Y`; L4L OFF uses all rows in the prepared comparison fact dataset.

The app reads `l4lComparisonFact` without a `fields=` whitelist because Domo card-level dataset mappings can expose a subset of field aliases. Optional display columns such as `comparable_week_slot` are shown when mapped and display `-` when absent.

If Workflow start returns HTTP 500 from `/domo/workflow/v1/models/prepareL4LFacts/start`, the request reached Domo's Workflow service but no instance was created. Check the published app workflow mapping, Workflow enabled/published status, current user execute permission, and whether the Workflow can be started manually in Domo. The app displays the HTTP status, message, and Domo toe when available.

## Source Dataset

After publishing the app manually, map the alias `sourceMetrics` to this Domo dataset:

`86e3e588-91c3-487b-8d9f-d585dbdbaf10`

This dataset is read-only for this project. The app must not mutate, replace, update, rename, delete, sync, or change the schema of the source dataset.

## Runtime Period Logic

Fiscal weeks are not persisted as an AppDB collection. `src/periodDefinition.js` derives the runtime Period Lens / Fiscal Week / Comparable Slot structure from `sourceMetrics`.

Supported Period Lenses:

- `Last Completed Week`
- `Last Completed Month`
- `Last Completed Quarter`
- `Year To Date`
- `Quarter To Date`
- `Month To Date`

The UI does not expose separate comparison or history controls. The comparison mode is derived from Period Lens:

- Last Completed Week, Last Completed Month, and Last Completed Quarter compare against Previous Period.
- Year To Date, Quarter To Date, and Month To Date compare against Same Period Last Year.
- Last Completed Quarter and Quarter To Date use 13 fiscal weeks per quarter.

The UI displays derived comparable weeks for review, but users only save manual Store + Metric + Fiscal Week coverage adjustments.

## AppDB Collections

Project-specific AppDB collections used by the app:

- `ccm_metric_week_overrides`
- `ccm_selected_scope_mask`
- `ccm_full_mask`
- `ccm_generation_runs`

`ccm_metric_week_overrides` stores only user-changed manual coverage adjustments at grain `store_code + metric + week_ending`. Default include `Y` rows are not saved.

Override context fields such as `period_type`, `comparison_side`, `comparable_week_slot`, `financial_year`, `week_of_year`, and `month_of_year` are snapshots of where the decision was made. They do not scope the override. `override_scope` is always `STORE_METRIC_WEEK`.

`ccm_selected_scope_mask` stores the latest selected-scope generated mask records at grain `period_type + comparison_side + comparable_week_slot + store_code + metric + week_ending`. Rebuilding selected scope clears this collection before inserting the new selected-scope mask records, preventing duplicates.

`ccm_full_mask` is reserved for future production full-mask output. Phase 1 does not write to it.

`ccm_l4l_week_mask` is not used by version 1.0.2 and is not mapped in this manifest. Do not delete the Domo AppDB collection because versions 1.0.0 and 1.0.1 may still use it.

Week 53 rows are shown in review when present, but are automatically excluded with reason `WEEK_53_EXCLUDED`; users do not need to manually exclude them.

Comparable slots that exist on only one required comparison side remain visible in LFL OFF but are excluded from LFL ON with reason `UNPAIRED_PERIOD_WEEK`.

`ccm_generation_runs` stores run metadata and status.

## Manual Domo Setup

Before Domo dev/publish testing, manually map:

- dataset alias `sourceMetrics`
- dataset alias `l4lComparisonFact` for Phase 2 results
- collection `ccm_metric_week_overrides`
- collection `ccm_selected_scope_mask`
- collection `ccm_full_mask` for future production output
- collection `ccm_generation_runs`

The current local manifest intentionally does not create or modify any Domo platform objects.

## Local Commands

```bash
npm test
npm run build
```

Do not run `domo publish` unless explicitly approved.

## Downstream Design

The generated `ccm_selected_scope_mask` collection is for Phase 1 validation and quick debugging only. Future production Workflow and Magic ETL should use `ccm_full_mask`, not `ccm_selected_scope_mask`.

Downstream Workflow and Magic ETL should not be treated as production-ready until `Generate Full CCM Mask` is implemented.

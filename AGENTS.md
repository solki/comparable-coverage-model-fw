# Agent Notes

## Project Goal

Build and maintain the Forty Winks CCM Phase 1 Domo custom app.

The app derives comparable period weeks from `sourceMetrics`, applies Store + Metric + Week manual overrides, generates final L4L mask rows, and logs generation runs.

Current Phase 1 generation mode is selected scope only.

## Hard Safety Rules

- Do not run `domo publish` unless the user explicitly approves it.
- Do not modify the source dataset.
- Do not create, delete, or update Domo platform objects unless the user explicitly approves it.
- Do not mutate, replace, rename, sync, delete, or change the schema of the source dataset.
- Code and comments must be in English.

## Source Dataset

Use manifest alias `sourceMetrics`.

Production Domo dataset id for manual mapping:

`86e3e588-91c3-487b-8d9f-d585dbdbaf10`

Do not hardcode this id in application logic.

## Phase 2 L4L Comparison Dataset

Use manifest alias `l4lComparisonFact` for the existing Workflow output dataset:

`DomoDev | Phase 2 Metric | L4L Weekly Comparison Fact`

Manual mapping dataset id:

`e5dffb5a-176f-4564-a147-c0d7311a6880`

Do not hardcode this id in frontend read logic. The app may document it in manifest/docs for manual mapping.

Do not modify the Workflow, Magic ETL, DataFlow, source dataset, or AppDB collections for Phase 2 visualization. The existing Workflow can be triggered from the app through manifest alias `prepareL4LFacts` with no start-node input parameters. Use `domo.workflow.start('prepareL4LFacts', {})`, then poll `domo.workflow.getInstance('prepareL4LFacts', instanceId)`. If `domo.workflow` is unavailable, show: `Run the Workflow manually in Domo, then click Refresh Results.`

## AppDB Collections

The app may use only these project-specific collections:

- `ccm_metric_week_overrides`
- `ccm_selected_scope_mask`
- `ccm_full_mask` as reserved future production output
- `ccm_generation_runs`

Do not introduce a persisted AppDB collection for period rows. Period rows are runtime-derived by `src/periodDefinition.js`.

`ccm_l4l_week_mask` is a legacy collection for versions 1.0.0 and 1.0.1. Version 1.0.2 must not map, clear, delete, or write it unless the user explicitly approves that exact action.

## Runtime Period Model

`src/periodDefinition.js` derives:

- `Last Completed Week`
- `Last Completed Month`
- `Last Completed Quarter`
- `Year To Date`
- `Quarter To Date`
- `Month To Date`

The UI exposes only Period Lens. It does not expose separate comparison/history controls. Last Completed periods use `Previous Period`; YTD/QTD/MTD use `Same Period Last Year`. Quarter logic uses 13 fiscal weeks.

The UI may display derived period weeks for review, but users edit only Store + Metric + Week manual overrides.

## UI Scope Model

- Global Dataset Overview shows unfiltered source totals only.
- Selection controls define the active Store + Metric + Period Type.
- Selected Scope Summary must use only selected-scope period rows, source facts, overrides, and mask rows.
- Validation Summary must use only selected-scope mask rows.
- Do not show global missing commencement or global date warning counts as selected-scope warnings.

Source facts in Domo runtime should come from aggregate SQL at Store + Metric + Week grain, not raw source row loading.

## Manual Override Model

Collection: `ccm_metric_week_overrides`

Grain: `store_code + metric + week_ending`

Rules:

- default manual include is runtime `Y`
- default `Y` rows are not saved
- active saved rows override the default
- `manual_reason` is required when the flag is `N`
- `override_scope` is always `STORE_METRIC_WEEK`
- period context fields on override documents are audit/display snapshots only
- period context fields must not be used as scope keys

## Mask Model

Collection: `ccm_selected_scope_mask`

Grain:

`period_type + comparison_side + comparable_week_slot + store_code + metric + week_ending`

Generation rules:

1. Generate selected Store scope, selected Metric scope, and selected Period Type only. Store scope may be one store or `All Stores`; Metric scope may include one or more metrics.
2. Evaluate store lifecycle using commencement/closure dates and current period bounds.
3. Apply active manual overrides.
4. Propagate excluded Store + Metric + Week anywhere it appears.
5. Propagate current/prior pair exclusions within the same period type and slot.
6. Do not treat missing source fact rows as automatic exclusions.
7. Show Week 53 when it appears, but automatically exclude it with `WEEK_53_EXCLUDED`; do not require a manual override.
7a. Exclude comparable slots that exist on only one required comparison side with `UNPAIRED_PERIOD_WEEK`; keep those rows visible in LFL OFF.
8. Clear `ccm_selected_scope_mask` before inserting selected-scope output.
9. Never clear `ccm_metric_week_overrides`.
10. Never clear `ccm_generation_runs`.
11. Never clear `ccm_full_mask`.
12. Never map, clear, delete, or write legacy `ccm_l4l_week_mask` in version 1.0.2.

During Phase 1, `ccm_selected_scope_mask` contains only the latest selected-scope generated output. This is expected.

`Generate Full CCM Mask` must remain a disabled placeholder until production development. Future full generation should write `ccm_full_mask`. Do not implement full generation loops, background full processing, Workflow sync, or Magic ETL production orchestration in Phase 1.

## Run Logging

Collection: `ccm_generation_runs`

Keep run logging, but do not reference a persisted period collection. Run records for selected-scope rebuilds must include `generation_mode = SELECTED_SCOPE`, `output_collection = ccm_selected_scope_mask`, selected Store/Metric/Period Type, mask rows deleted, mask rows inserted, and rebuild status.

## Local Verification

Use:

```bash
npm test
npm run build
```

Final reports must say whether tests/build ran and must confirm that `domo publish` was not run.

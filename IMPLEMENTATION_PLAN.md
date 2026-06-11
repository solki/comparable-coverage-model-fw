# Implementation Plan

## Current Phase

Revise CCM Phase 1 so period definitions are derived at runtime, manual edits are stored only as Store + Metric + Week overrides, and generation supports selected scope only.

Phase 1 does not implement full CCM mask generation.

## Phase A: Documentation

- Update README, design, data model, algorithm, agent notes, and implementation plan.
- Remove persisted period collection setup instructions.
- Document runtime period derivation and manual override collection.

## Phase B: Data Model and AppDB Client

- Use only:
  - `ccm_metric_week_overrides`
  - `ccm_selected_scope_mask`
  - `ccm_full_mask` as reserved future output
  - `ccm_generation_runs`
- Do not map `ccm_l4l_week_mask` in version 1.0.2. Keep the Domo AppDB collection itself for versions 1.0.0 and 1.0.1.
- Remove period collection clients.
- Keep existing `syncEnabled` settings for existing mapped collections.
- Add schema for metric-week overrides and metric-grain mask rows.

## Phase C: Runtime Period Derivation

- Keep `src/periodDefinition.js`.
- Derive period weeks from source calendar fields.
- Support fixed period types:
  - `Last Completed Week`
  - `Last Completed Month`
  - `Last Completed Quarter`
  - `Year To Date`
  - `Quarter To Date`
  - `Month To Date`
- Derive comparison mode from Period Lens instead of exposing comparison/history controls.
- Use 13 fiscal weeks per quarter.

## Phase D: UI

- Rename the period area to `Comparable Week Review / Override Editor`.
- Add a Global Dataset Overview for unfiltered source totals.
- Add Store, multi-select Metric, and Period Type selectors in a dedicated Selection panel.
- Include an `All Stores` Store option.
- Add a Selected Scope Summary that recalculates only from the selected Store + Metric + Period Type.
- Show runtime-derived comparable weeks.
- Let users edit manual include/reason/note per Store + Metric + Week.
- Save only changed override rows.
- Store period context snapshot fields on saved overrides.
- Keep override identity scoped only to Store + Metric + Week Ending.
- Keep Validation Summary selected-scope only.

## Phase E: Mask Generation

- Implement `generation_mode = SELECTED_SCOPE` only.
- Generate rows at `period_type + comparison_side + comparable_week_slot + store_code + metric + week_ending`.
- Calculate system include from store lifecycle and current period dates.
- Apply manual overrides.
- Propagate Store + Metric + Week exclusions anywhere the same week appears.
- Propagate current/prior pair exclusions only within the same period type and slot.
- Exclude comparable slots that exist on only one required comparison side with `UNPAIRED_PERIOD_WEEK`.
- Preserve missing source fact weeks as included when system/manual rules allow them.
- Show Week 53 rows when relevant, but automatically exclude them with `WEEK_53_EXCLUDED`.
- Before insert, clear `ccm_selected_scope_mask`.
- Insert only the selected Store + Metric + Period Type rows.
- Do not clear `ccm_metric_week_overrides`.
- Do not clear `ccm_generation_runs`.
- Do not clear `ccm_full_mask`.
- Do not clear, delete, or write legacy `ccm_l4l_week_mask`.
- If clear fails, stop and do not insert rows.
- Reserve `Generate Full CCM Mask` as a disabled production placeholder.

## Phase E2: Source Aggregates

- Query global source summary for Global Dataset Overview only.
- Query Store + Metric + Week aggregated source facts for selected-scope source availability and Comparable Week Review values.
- Do not load raw source dataset rows in Domo runtime.
- Do not hardcode the production dataset id in source code.

## Phase F: Verification

Run:

```bash
npm test
npm run build
```

Do not run `domo publish`.

## Phase G: Phase 2 L4L Visualization

- Add manifest dataset alias `l4lComparisonFact` for the existing Workflow output dataset.
- Read Phase 2 rows through `/data/v1/l4lComparisonFact`.
- Do not hardcode the Phase 2 dataset id in frontend read logic.
- Do not modify the Workflow, Magic ETL, DataFlow, source dataset, or AppDB for Phase 2.
- Trigger the existing Workflow through `domo.workflow.start('prepareL4LFacts', {})` when Domo runtime exposes `domo.workflow`.
- Poll `domo.workflow.getInstance('prepareL4LFacts', instanceId)` and show frontend progress until `COMPLETED`, `FAILED`, or `CANCELED`.
- If `domo.workflow` is unavailable, show the manual instruction: `Run the Workflow manually in Domo, then click Refresh Results.`
- Render Store Performance L4L comparison with L4L ON/OFF, result summary, excluded weeks, and weekly detail.

## Out of Scope for Phase 1

- Generate Full CCM Mask
- all-store/all-metric/all-period loops
- background full processing
- production orchestration
- Workflow sync
- Magic ETL production changes

## Domo Manual Mapping Needed

Before Domo dev/publish validation, manually ensure these mappings exist:

- dataset alias `sourceMetrics`
- collection `ccm_metric_week_overrides`
- collection `ccm_selected_scope_mask`
- collection `ccm_full_mask`
- collection `ccm_generation_runs`

The app must not create, delete, or modify Domo platform objects automatically.

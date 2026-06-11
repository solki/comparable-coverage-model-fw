# Algorithm

## Inputs

- Read-only source dataset alias: `sourceMetrics`
- Active manual coverage adjustments from `ccm_metric_week_overrides`
- Selected Store + Metric + Period Lens from the UI

The app does not write to the source dataset and does not persist period definitions.

## Source Aggregation

The app reads `sourceMetrics` through aggregate SQL only:

- global source summary
- store lifecycle list
- metric list
- week calendar
- Store x Metric x Fiscal Week Weekly Coverage Records

Source Records are raw rows from the mapped source dataset. Weekly Coverage Records are aggregated to Store x Metric x Fiscal Week, the CCM evaluation grain. The global source summary is used only for Global Dataset Overview. Weekly Coverage Records are used for Selected Source Records, Weekly Metric Value, Source Data Status, and Weeks Without Source Data.

## Generation Mode

Phase 1 implements only `SELECTED_SCOPE` generation.

Selected scope is:

- selected Store
- selected Metric
- selected Period Lens

Full CCM mask generation is intentionally not implemented in the Phase 1 prototype. It is reserved for production development because all Stores x Metrics x Period Lenses x Fiscal Weeks can take too long for fast functional validation.

Phase 1 selected-scope output collection is `ccm_selected_scope_mask`.

Future production full-mask output collection is reserved as `ccm_full_mask`.

Legacy `ccm_l4l_week_mask` is not mapped, cleared, or written by version 1.0.2. Keep the Domo AppDB collection for versions 1.0.0 and 1.0.1.

## Period Derivation

`src/periodDefinition.js` derives comparable week rows from source calendar fields.

### Last Completed Week

- Current label: `Last Completed Week`
- Prior label: `Previous Week`
- Current period: current FY max `Week Of Year - 1`
- Prior period: current FY max `Week Of Year - 2`
- Comparison mode: `Previous Period`

### Last Completed Month

- Current label: `Last Completed Month`
- Prior label: `Previous Month`
- Current period: max `Month of Year` where `FC Last Month Flag = Y`
- Prior period: current month minus one fiscal month
- Comparison mode: `Previous Period`

### Last Completed Quarter

- Current label: `Last Completed Quarter`
- Prior label: `Previous Quarter`
- Target week: current FY max `Week Of Year - 1`
- Current period: 13 fiscal weeks ending at the target week
- Prior period: the previous 13 fiscal weeks before the current 13-week window
- Comparison mode: `Previous Period`

### Year To Date

- Current label: `YTD`
- Prior label: `Prior Year YTD`
- Target week: current FY max `Week Of Year - 1`
- Current side: `FC Current FY Flag = Y` and `Week Of Year <= target_week`
- Prior side: `FC Last FY Flag = Y` and `Week Of Year <= target_week`
- Comparison mode: `Same Period Last Year`

### Quarter To Date

- Current label: `QTD`
- Prior label: `Prior Year QTD`
- Quarter definition: 13 fiscal weeks per quarter
- Target week: current FY max `Week Of Year - 1`
- Current side: current fiscal quarter start through target week
- Prior side: same fiscal quarter week range in the prior fiscal year
- Comparison mode: `Same Period Last Year`

### Month To Date

- Current label: `MTD`
- Prior label: `Prior Year MTD`
- Current month: max `Month of Year` where `FC Current Month Flag = Y`
- Target week: current FY max `Week Of Year - 1`
- Current side: current fiscal month rows through target week
- Prior side: same fiscal month rows in the prior fiscal year through target week
- Comparison mode: `Same Period Last Year`

## Trading Expectation Logic

Use only:

- `Store Trading Commencement date`
- `Store Closure Date`
- current period start/end dates

Trading Expectation is the system Y/N flag based on store trading commencement and closure dates. The app still stores and displays the underlying Y/N value.

A store is expected to trade for a period when:

- commencement date is not null
- commencement date <= current period start date minus 6 days
- closure date is null or closure date >= current period end date

Weeks Not Expected to Trade are excluded by this trading expectation logic.

## Manual Coverage Adjustment Logic

Manual coverage adjustment grain: `store_code + metric + week_ending`

- Default Manual Coverage Adjustment is `Y` when no active override exists.
- An active override supplies `manual_include_flag`.
- `manual_reason` is required when the saved flag is `N`.
- Default `Y` rows are not saved.
- `override_scope` is always `STORE_METRIC_WEEK`.
- Period context fields saved on the override are display/audit snapshots only.
- Period context fields do not scope or limit the override.

## Propagation Rules

Rule 1: Store + Metric + Week propagation

If a Store + Metric + Fiscal Week is excluded by trading expectation or manual coverage adjustment logic, that same Store + Metric + Fiscal Week is excluded everywhere it appears.

Rule 2: Paired slot propagation

Within the same `period_type + comparable_week_slot + store_code + metric`, if either current or prior side is excluded, both sides are excluded.

Paired-slot propagation does not cross Period Lenses.

Rule 3: Unpaired comparable slot exclusion

All LFL decisions are evaluated by Store + Metric + Period Lens + Comparison Mode + Comparable Slot. If a comparable slot exists on only one required comparison side, the row remains visible in LFL OFF but is excluded from LFL ON.

Use:

- `paired_slot_include_flag = N`
- `final_include_flag = N`
- `mask_include_flag = N`
- `final_reason_code = UNPAIRED_PERIOD_WEEK`

## Week 53

If `Week Of Year = 53` appears in `sourceMetrics`, show it in the Comparable Week Review where relevant, but exclude it from equivalence logic automatically.

Use:

- `system_include_flag = N`
- `system_reason_code = WEEK_53_EXCLUDED`
- `final_reason_code = WEEK_53_EXCLUDED`

The user does not need to create a manual coverage adjustment for Week 53.

## Selected-Scope Mask Rebuild

For each selected Store + Metric + derived comparable fiscal week:

1. Calculate `system_include_flag` as Trading Expectation.
2. Load active manual coverage adjustment or default to `manual_include_flag = Y`.
3. Calculate `effective_include_flag` as Coverage Decision.
4. Apply Store + Metric + Week propagation.
5. Apply paired current/prior slot propagation.
6. Ask the user to confirm the selected-scope rebuild.
7. Clear existing documents from `ccm_selected_scope_mask`.
8. Insert only the selected Store + Metric + Period Lens mask records into `ccm_selected_scope_mask`.
9. Write run metadata to `ccm_generation_runs`.

Weeks Without Source Data do not automatically set include `N`. The mask is the base table for downstream zero-fill logic.

If clearing `ccm_selected_scope_mask` fails, selected rows are not inserted. If insertion fails after clearing, the app reports the error and writes failure details to `ccm_generation_runs` when feasible.

`ccm_metric_week_overrides`, `ccm_generation_runs`, and `ccm_full_mask` are not cleared.

## Validation Scope

Validation Summary is calculated from selected Store + Metric + Period Lens comparable week records only. It does not reuse global source profile warning counts, so global missing commencement stores do not appear as warnings for a selected store that has valid lifecycle data.

Business Validation includes Comparable Week Records, Included Comparable Weeks, Excluded Comparable Weeks, Weeks Without Source Data, Manual Coverage Adjustments Applied, Store Trading Date Warnings, and Date Quality Warnings.

Technical Write Summary includes `generation_mode = SELECTED_SCOPE`, `output_collection = ccm_selected_scope_mask`, selected store, selected metric, selected period lens, Previous Mask Records Cleared, Mask Records Written, run id, and rebuild status.

## Phase 2 L4L Result Calculation

Phase 2 reads prepared comparison fact rows from alias `l4lComparisonFact`.

In Domo runtime, the app can trigger `Prepare L4L Comparison Facts` through manifest alias `prepareL4LFacts` with an empty payload because the Workflow has no start-node input parameters.

The app polls `domo.workflow.getInstance('prepareL4LFacts', instanceId)` and shows progress in the UI until the Workflow reaches `COMPLETED`, `FAILED`, or `CANCELED`. After `COMPLETED`, it refreshes rows from `l4lComparisonFact`.

If `domo.workflow` is unavailable, users should run the Workflow manually in Domo, then click Refresh Results.

For the selected coverage mode:

- L4L ON filters to `mask_include_flag = Y`.
- L4L OFF uses all prepared comparison rows.
- Current Value is `SUM(source_value or 0)` where `comparison_side = current`.
- Prior Value is `SUM(source_value or 0)` where `comparison_side = prior`.
- Absolute Variance is Current Value minus Prior Value.
- Variance % is `(Current - Prior) / ABS(Prior)` when Prior is non-zero.
- If Prior is zero, Variance % displays `N/A` with status `PRIOR_ZERO` or `BOTH_ZERO`.
- If current and prior included week counts differ and no prior-zero status applies, status is `WEEK_COUNT_MISMATCH`.

The UI always shows L4L ON and L4L OFF side-by-side, plus the weeks excluded by comparable coverage.

## Write Safety

- Do not run `domo publish` without explicit approval.
- Do not modify the source dataset.
- Do not create, delete, or update unrelated Domo objects.
- AppDB writes are limited to approved project collections.
- Do not modify Workflow, Magic ETL, or DataFlow definitions from the app.
- Do not implement full generation, Workflow sync, or Magic ETL production orchestration in Phase 1.

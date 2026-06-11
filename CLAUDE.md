# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forty Winks CCM is a Domo custom app (Phase 1 prototype, v1.0.7) that generates Comparable Coverage Model weekly mask data for selected Store + Metric scope across all six approved period types. The app reads source metrics, derives comparable fiscal weeks at runtime, applies manual overrides, generates mask rows (long-table format with `period_type` as a field), and writes output to Domo AppDB collections. Phase 2 adds L4L comparison visualization consuming a pre-built Workflow output dataset.

- **Type**: Domo custom app (fullpage, vanilla JS)
- **Build**: Vite (`npm run build`) with a post-build Domo asset copy script
- **Test**: Node.js native test runner (`npm test` → `node --test tests/*.test.js`)
- **Domo publish**: must never be run without explicit user approval

## Commands

```bash
npm test              # Run all tests (Node.js native runner)
npm run build         # vite build + copy Domo assets
npm run dev           # Vite dev server on 127.0.0.1
npm run preview       # Vite preview server
```

There is no lint script. To run a single test file:

```bash
node --test tests/maskGenerator.test.js
```

## Architecture

### Entry and Rendering

[src/main.js](src/main.js) mounts the app by calling `createApp(rootElement)` from [src/ui.js](src/ui.js). There is no framework — the entire UI is vanilla JS using innerHTML string templates and event delegation. All rendering flows through a single `render()` function in `createApp()` that rebuilds the DOM from the current `state` object. UI state is persisted to `localStorage` under key `forty_winks_ccm_ui_state_v1`.

### Source Data Layer

- **[src/sourceDataService.js](src/sourceDataService.js)** — `profileSource()` queries the `sourceMetrics` dataset alias via `@domoinc/query`, returns source rows + profile + diagnostics. This is the sole entry point for source data.
- **[src/sourceProfiler.js](src/sourceProfiler.js)** — `profileSourceRows()` derives global aggregate stats (store count, metric count, week range, missing commencement dates, etc.) from raw source rows used as mock/fallback data.
- **[src/domoClient.js](src/domoClient.js)** — `domo.postgres()` wrapper for aggregate SQL queries against Domo datasets. Also provides `getRuntimeLabel()` for the UI health strip.

### Period Derivation (Runtime, Not Persisted)

**[src/periodDefinition.js](src/periodDefinition.js)** is the core period engine. It derives 6 period types from source calendar fields entirely at runtime — no AppDB collection stores period rows:

| Period Type | Comparison Mode |
|---|---|
| Last Completed Week | Previous Period |
| Last Completed Month | Previous Period |
| Last Completed Quarter (13 weeks) | Previous Period |
| Year To Date | Same Period Last Year |
| Quarter To Date | Same Period Last Year |
| Month To Date | Same Period Last Year |

Output: rows with `period_type`, `comparison_side` (current/prior), `comparable_week_slot`, `week_ending`, and period bounds used for store eligibility checks.

**[src/periodDefinitionService.js](src/periodDefinitionService.js)** wraps period derivation with diagnostics (whether source calendar fields are present or mock data is in use).

### Mask Generation Pipeline (Five-Layer CCM)

The mask generation pipeline in **[src/maskGenerator.js](src/maskGenerator.js)** (`generateMaskRows()`) applies layers in order:

**L1 — Calendar Layer / Time Truth**: slot completeness rule
- Any comparable slot not on ALL required comparison sides (current AND prior) gets `UNPAIRED_PERIOD_WEEK`
- Week 53 is a subtype: gets `WEEK_53_EXCLUDED` (excluded regardless of pairing)
- Output: `calendar_include_flag`, `calendar_reason_code`

**L2 — Trading Expectation / Operational Truth**: store eligibility
- `evaluateStoreEligibility()` checks trading commencement/closure against period bounds
- Trading exclusion paired propagation stays within same Period Type
- Output: `trading_expectation_flag`, `trading_reason_code`

**L3 — Metric Coverage / Data Truth**: data transparency (no auto-exclusion)
- Default `metric_coverage_flag = Y` — no automatic metric-based exclusion
- Source data presence tracked but does not block inclusion
- Output: `metric_coverage_flag`, `metric_reason_code`, `source_value`, `source_row_count`, `source_data_exists`

**L4 — Comparable Coverage / Comparability Truth**: manual overrides + paired propagation
- Manual override application (Store + Metric + Week Ending, crosses period types)
- Store+Metric+Week propagation (rule 1)
- Paired slot propagation (within Store + Metric + Period Type + Comparable Slot, rule 2)
- Output: `manual_include_flag`, `manual_reason`, `is_manual_override`, `paired_slot_include_flag`, `paired_slot_reason_code`, `final_include_flag`, `final_reason_code`, `mask_include_flag`

**L5 — Dashboards & Consumption / Presentation**
- LFL ON: filter `mask_include_flag = Y`
- LFL OFF: inclusive view, no mask filter

The output grain is `store_code + metric + period_type + comparison_side + comparable_week_slot + week_ending`.

**Deprecated compatibility fields** (kept for backward compat, mapped from new fields):
- `system_include_flag` ← `trading_expectation_flag`
- `system_reason_code` ← `trading_reason_code`
- `effective_include_flag` ← computed from L2+L3+L4

### Manual Override Model

**[src/manualOverrideService.js](src/manualOverrideService.js)** manages `ccm_metric_week_overrides` at grain `store_code + metric + week_ending`. Key rules:
- Default manual include is runtime `Y`; default `Y` rows are never persisted
- Only user-changed overrides are saved; `manual_reason` is required when flag is `N`
- `override_scope` is always `STORE_METRIC_WEEK` — period context fields on override docs are audit snapshots only, not scope keys

### AppDB Collections

**[src/appdbClient.js](src/appdbClient.js)** wraps Domo AppDB via `@domoinc/toolkit`. Four project collections:
- `ccm_metric_week_overrides` — persistent manual overrides (never cleared by rebuilds)
- `ccm_selected_scope_mask` — Phase 1 selected-scope output (cleared before each rebuild)
- `ccm_full_mask` — reserved for future production (Phase 1 never writes to it)
- `ccm_generation_runs` — run metadata log (never cleared)

`ccm_l4l_week_mask` is a legacy v1.0.0/v1.0.1 collection that must never be touched by v1.0.2+.

### Mask Write Flow

**[src/maskWriteService.js](src/maskWriteService.js)** handles the write transaction:
1. Clear `ccm_selected_scope_mask` documents
2. Insert new selected-scope mask records
3. Write run record to `ccm_generation_runs`
4. If clear fails, insert is skipped. If insert fails after clear, error is logged to `ccm_generation_runs`.

### CCM Five-Layer Architecture

The system follows a five-layer model (defined in `CCM_LAYERS` in [src/constants.js](src/constants.js)):

| Layer | Name | Flag Field | Reason Field | Module |
|---|---|---|---|---|
| L1 | Calendar / Time Truth | — | — | [src/periodDefinition.js](src/periodDefinition.js) |
| L2 | Trading Expectation / Operational Truth | `system_include_flag` | `system_reason_code` | [src/l4lEligibility.js](src/l4lEligibility.js) |
| L3 | Metric Coverage / Data Truth | `source_data_exists` | — | [src/scopeSummary.js](src/scopeSummary.js) (transparency only, not blocking) |
| L4 | Comparable Coverage / Comparability Truth | `mask_include_flag` | `final_reason_code` | [src/maskGenerator.js](src/maskGenerator.js) |
| L5 | Dashboards & Consumption / Presentation | — | — | [src/ui.js](src/ui.js), [src/l4lComparisonCalculator.js](src/l4lComparisonCalculator.js) |

**L4 (Comparable Coverage)** applies the following pipeline:
1. System eligibility (L2 Trading Expectation)
2. Manual override application (Store + Metric + Week Ending)
3. Store+Metric+Week propagation
4. Paired slot propagation (within same period type)
5. **Slot Completeness Rule** — any comparable slot not on all required comparison sides (current AND prior) is excluded from LFL ON. Week 53 is a subtype (gets WEEK_53_EXCLUDED). All other unmatched slots get UNPAIRED_PERIOD_WEEK.

**L5 (Presentation)** semantics:
- LFL ON: filter `mask_include_flag = Y`
- LFL OFF: inclusive view, no mask filter

### Phase 2 — L4L Comparison Visualization

Phase 2 is read-only visualization of a pre-built Workflow output:
- **[src/comparisonDataService.js](src/comparisonDataService.js)** reads `l4lComparisonFact` dataset alias
- **[src/l4lComparisonCalculator.js](src/l4lComparisonCalculator.js)** computes L4L ON vs OFF summaries, variance, excluded weeks
- **[src/workflowService.js](src/workflowService.js)** triggers the `prepareL4LFacts` Workflow and polls for completion
- The app does not modify the Workflow, Magic ETL, DataFlow, or source dataset

### Five-Layer UI Navigator

**[src/workflowUiState.js](src/workflowUiState.js)** implements a 5-stage layer navigator that maps to the CCM five-layer architecture:

1. **calendar** — Calendar Layer / Time Truth
2. **trading** — Trading Expectation / Operational Truth
3. **metricCoverage** — Metric Coverage / Data Truth
4. **comparableCoverage** — Comparable Coverage / Comparability Truth
5. **presentation** — Dashboards & Consumption / Presentation

Each stage displays its guiding question, layer-specific accent color, and status (locked → ready → complete). Stages 1-3 unlock automatically when source data loads. Stage 4 unlocks when Store+Metric scope is selected and review is confirmed. Stage 5 unlocks when the mask is built and acknowledged.

The layer navigator is rendered by `renderLayerNavigator()` in [src/ui.js](src/ui.js) as a horizontal card strip. Each stage's workspace shows layer-specific content: Calendar shows global overview + scope selection, Trading shows store eligibility, Metric shows data coverage, CCM shows override editor and mask generation, Presentation shows L4L results.

**Stage progression** is strictly linear: each stage must be explicitly confirmed via its "Confirm → Next Stage" button. Re-confirming a completed stage resets all downstream stages. The "Rebuild Selected Scope Mask" button appears directly in the scope-change banner when scope is dirty.

**Diagnostics** opens as a modal popup (not a bottom drawer). Click the backdrop or Close button to dismiss.

### Key Supporting Modules

- **[src/constants.js](src/constants.js)** — All app constants: collection names, flags, reason codes, period types, comparison modes, source required fields, period labels
- **[src/dateUtils.js](src/dateUtils.js)** — Date normalization, min/max, add/subtract days, clean string utilities used throughout
- **[src/validation.js](src/validation.js)** — `buildValidationSummary()` computes selected-scope business + technical validation from mask rows
- **[src/scopeSummary.js](src/scopeSummary.js)** — `computeGlobalDatasetOverview()` and `computeSelectedScopeSummary()` — global is unfiltered, selected-scope is filtered to current Store + Metric scope

### Generation Scope

The user selects:
- **Store**: one store, multiple stores, or All Stores
- **Metric**: one metric, multiple metrics, or All Metrics

**Period Type is NOT a generation scope selector.** All six approved period types are generated automatically by default. The Period Filter dropdown in the Selection panel affects only the Comparable Week Review / Override Editor table view — it does not limit mask generation.

### Long-Table CCM Model

The AppDB `ccm_selected_scope_mask` output uses a long-table structure. Each row is distinguished by:
`store_code + metric + period_type + comparison_side + comparable_week_slot + week_ending`

Key fields per row: `period_type`, `comparison_side`, `comparable_week_slot`, `mask_include_flag`, `final_reason_code`. There is no wide-table pivoting in the app — period-specific field groups (lcw_*, lcm_*, etc.) are documented as a future ETL handoff in [PRODUCTION_CCM_HANDOFF.md](PRODUCTION_CCM_HANDOFF.md).

### Override Editor Scope

- Override Editor requires selecting a **single Store** and a **single Metric** to enable editing.
- After Store + Metric selection, it shows comparable week records for ALL period types (grouped/filterable by the optional Period Type dropdown).
- Manual overrides persist at grain `store_code + metric + week_ending` and apply across all period types.
- Paired propagation operates at grain `store_code + metric + period_type + comparable_week_slot` and does NOT cross period types.
- **[src/terminology.js](src/terminology.js)** — UI display text and helper text constants
- **[src/metricDisplay.js](src/metricDisplay.js)** — Metric display name formatting for multi-metric selection
- **[src/maskLimit.js](src/maskLimit.js)** — Guard for mask row count limits
- **[src/mockData.js](src/mockData.js)** — Test/mock data for development without Domo runtime
- **[src/periodTable.js](src/periodTable.js)** — Pagination for the comparable week review table

### Manifest

[manifest.json](manifest.json) defines dataset aliases (`sourceMetrics`, `l4lComparisonFact`), Workflow mapping (`prepareL4LFacts`), and AppDB collection schemas. Dataset and collection IDs in the manifest are for manual mapping in Domo after publish — they must not be hardcoded in application logic.

## Critical Safety Rules

- **Never run `domo publish`** without explicit user approval
- **Source dataset is read-only** — never mutate, rename, sync, or change its schema
- **Never clear** `ccm_metric_week_overrides`, `ccm_generation_runs`, or `ccm_full_mask`
- **Never touch** `ccm_l4l_week_mask` (legacy v1.0.0/v1.0.1 collection)
- **`Generate Full CCM Mask`** must remain a disabled placeholder — do not implement full generation in Phase 1
- **Period rows are runtime-only** — do not create a persisted AppDB collection for them
- Code and comments must be in English

## Testing

Tests live in [tests/](tests/) and use Node's built-in test runner (`node:test` + `node:assert/strict`). Tests are pure logic tests that do not require Domo runtime — they import source modules directly. Key test files:
- [tests/maskGenerator.test.js](tests/maskGenerator.test.js) — mask row generation, propagation rules, eligibility
- [tests/periodDefinition.test.js](tests/periodDefinition.test.js) — period derivation from source calendar fields
- [tests/periodTable.test.js](tests/periodTable.test.js) — pagination
- [tests/workflowUiState.test.js](tests/workflowUiState.test.js) — workflow step gating and state machine
- [tests/phase2Ui.test.js](tests/phase2Ui.test.js) — Phase 2 UI rendering

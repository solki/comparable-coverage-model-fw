# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forty Winks CCM is a Domo custom app (Phase 1 prototype, v1.0.7) that generates Comparable Coverage Model weekly mask data for selected Store + Metric + Period Lens scopes. The app reads source metrics, derives comparable fiscal weeks at runtime, applies manual overrides, generates mask rows, and writes output to Domo AppDB collections. Phase 2 adds L4L comparison visualization consuming a pre-built Workflow output dataset.

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

### Mask Generation Pipeline

The mask generation pipeline in **[src/maskGenerator.js](src/maskGenerator.js)** (`generateMaskRows()`) applies these steps in order:

1. **System eligibility** — `evaluateStoreEligibility()` from [src/l4lEligibility.js](src/l4lEligibility.js) checks store trading commencement/closure dates against period bounds
2. **Week 53 exclusion** — automatically excluded with reason `WEEK_53_EXCLUDED`
3. **Manual override application** — active overrides from `ccm_metric_week_overrides` override the default `Y`
4. **Store+Metric+Week propagation** — an excluded week is excluded everywhere it appears (rule 1)
5. **Paired slot propagation** — within same period_type + comparable_week_slot + store + metric, if one side is excluded, both are (rule 2)
6. **Unpaired slot exclusion** — slots existing on only one comparison side get `UNPAIRED_PERIOD_WEEK` (rule 3)

The output grain is `period_type + comparison_side + comparable_week_slot + store_code + metric + week_ending`.

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

### Phase 2 — L4L Comparison Visualization

Phase 2 is read-only visualization of a pre-built Workflow output:
- **[src/comparisonDataService.js](src/comparisonDataService.js)** reads `l4lComparisonFact` dataset alias
- **[src/l4lComparisonCalculator.js](src/l4lComparisonCalculator.js)** computes L4L ON vs OFF summaries, variance, excluded weeks
- **[src/workflowService.js](src/workflowService.js)** triggers the `prepareL4LFacts` Workflow and polls for completion
- The app does not modify the Workflow, Magic ETL, DataFlow, or source dataset

### UI Workflow State Machine

**[src/workflowUiState.js](src/workflowUiState.js)** defines a 4-step guided workflow with gating:
1. **mask** — Build selected-scope coverage mask
2. **workflow** — Run Prepare L4L Comparison Facts
3. **results** — Review L4L ON vs OFF comparison
4. **exclusions** — Review excluded weeks evidence

Steps unlock sequentially: mask completion → workflow ready → results accessible. Each step transitions through `locked` → `ready` → `completed_unacknowledged` → `complete`. The `stepAcknowledged` pattern requires explicit user confirmation before the next step unlocks.

### Key Supporting Modules

- **[src/constants.js](src/constants.js)** — All app constants: collection names, flags, reason codes, period types, comparison modes, source required fields, period labels
- **[src/dateUtils.js](src/dateUtils.js)** — Date normalization, min/max, add/subtract days, clean string utilities used throughout
- **[src/validation.js](src/validation.js)** — `buildValidationSummary()` computes selected-scope business + technical validation from mask rows
- **[src/scopeSummary.js](src/scopeSummary.js)** — `computeGlobalDatasetOverview()` and `computeSelectedScopeSummary()` — global is unfiltered, selected-scope is filtered to current Store + Metric + Period Lens
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

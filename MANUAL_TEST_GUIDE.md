# Manual Testing Guide — Forty Winks CCM

This guide describes the step-by-step manual test flow for verifying the CCM application works end-to-end in a browser.

## Prerequisites

```bash
npm run dev        # Start dev server at http://127.0.0.1:5173
```

Open http://127.0.0.1:5173 in a browser. The app loads in mock mode (no Domo runtime needed).

## Test Flow: Five-Layer CCM Pipeline

### Stage 1 — Calendar Layer (Time Truth)

| # | Action | Expected Result |
|---|---|---|
| 1.1 | Page loads | App shell visible, "Forty Winks CCM" heading, status "Source summary loaded" |
| 1.2 | Check 5-layer navigator | 5 stage cards visible: Calendar, Trading Expectation, Metric Coverage, Comparable Coverage, Dashboards & Consumption |
| 1.3 | Verify Calendar active | Stage 1 highlighted with blue "C" icon |
| 1.4 | Check Selection controls | Store dropdown (All Stores + 3 stores), Metric multi-select (All Metrics + metric), Period Filter dropdown (5 period types) |
| 1.5 | Check Global Overview | Source Records (11), Stores (3), Fiscal Weeks (9), Metrics (1), date ranges |
| 1.6 | Check Calendar Outputs panel | Shows actual values: period_type (5), comparison_side (current / prior), comparable_week_slot (5), comparison_window_id (5) |
| 1.7 | Change Store to "99NEW" | Scope bar updates to "99NEW - New Store", status updates with override loading message |
| 1.8 | Change Period Filter | Period Filter label should read "review only" — does NOT limit generation scope |

### Stage 2 — Trading Expectation (Operational Truth)

| # | Action | Expected Result |
|---|---|---|
| 2.1 | Click Stage 2 "Trading Expectation" | Workspace changes to Stage 2 with green "T" icon and question |
| 2.2 | Check Trading panel | Shows: Selected Store, Store Trading Date Warnings (0), Store Closure Status ("No closure date"), Store-Weeks Expected to Trade (number), Store-Weeks Not Expected (number) |
| 2.3 | Check values are NOT literal field names | Should show actual counts like "16" / "7", NOT "system_include_flag" |
| 2.4 | Check Trading Outputs panel | system_include_flag shows "X Y / Y N", system_reason_code shows "INCLUDED" or guidance |

### Stage 3 — Metric Coverage (Data Truth)

| # | Action | Expected Result |
|---|---|---|
| 3.1 | Click Stage 3 "Metric Coverage" | Workspace changes to Stage 3 with purple "M" icon |
| 3.2 | Check Metric panel | Shows: Weekly Coverage Records, Source Records Matched, Weeks Without Source Data, Data Coverage % |
| 3.3 | Check values are meaningful | Should be numbers/percentages, not literal field names like "source_data_exists" |
| 3.4 | Check Metric Outputs panel | source_data_exists shows "Y (X weeks missing)", source_row_count shows actual number |

### Stage 4 — Comparable Coverage (Comparability Truth)

| # | Action | Expected Result |
|---|---|---|
| 4.1 | Click Stage 4 "Comparable Coverage" | Workspace changes to Stage 4 with amber ★ icon. Stage shows "Locked" |
| 4.2 | Check Selected Scope Summary | Shows Current Comparable Weeks, Prior Comparable Weeks, Included/Excluded counts. "Selected Period Lens" shows "All 6 types" (NOT "-") |
| 4.3 | Check Override Editor table | Table with all period types (5 period types × current/prior). Columns: Period Lens, Comparison Side, Comparable Slot, Financial Year, Fiscal Week, Fiscal Month, Week Ending, Weekly Metric Value, Source Data Status, Trading Expectation, Manual Coverage Adjustment, Coverage Decision, Final CCM Outcome, Outcome Reason, Alignment Impact |
| 4.4 | Check reason codes visible | INCLUDED for paired weeks, UNPAIRED_PERIOD_WEEK for unpaired slots (e.g., Last Completed Quarter rows) |
| 4.5 | Toggle manual override | Click a "Y" button in Manual Coverage Adjustment column → should toggle to "N" |
| 4.6 | **Click Save Overrides** | Status changes: Override Editor badge → "Complete", CCM stage → "Ready", confirmation message appears |
| 4.7 | **Click Rebuild Selected Scope Mask** | Confirmation dialog appears showing: Generation Mode (SELECTED_SCOPE), Output Collection (ccm_selected_scope_mask), Store, Metric, Period (All period types), Run ID, record count |
| 4.8 | Click Cancel | Dialog closes, no state change |
| 4.9 | Click Rebuild again then Confirm | Mock mode: shows error alert "Blocked during AppDB write" — expected in local dev. Execution modal shows progress stages ✓ |

### Stage 5 — Presentation

| # | Action | Expected Result |
|---|---|---|
| 5.1 | Click Stage 5 "Dashboards & Consumption" | Workspace changes to Stage 5 with red "D" icon |
| 5.2 | Check L4L content | Without Domo runtime: shows "No L4L comparison data is available" message, Refresh Results button |
| 5.3 | Check evidence tabs | Excluded Weeks, All Weekly Detail, Validation, Technical Details tabs visible |
| 5.4 | Check diagnostics | Open Diagnostics drawer: Source alias, AppDB collections, Workflow trigger, L4L dataset status all shown |

## Regression Checks

| # | Check | Expected |
|---|---|---|
| R1 | No "Compare Against" control | Search page for "Compare Against": not found |
| R2 | No "History Window" control | Search page for "History Window": not found |
| R3 | All Metrics option | Metric dropdown should have "All Metrics" option |
| R4 | Period Filter label | Should read "review only" |
| R5 | "Change Store / Metric" button | Visible in header, should NOT read "Change Store / Metric / Period" |
| R6 | "Start New Run" button | Click → resets state, goes to Calendar layer |
| R7 | Evidence tabs navigate | Click each tab (Excluded Weeks, All Weekly Detail, Validation, Technical Details) |
| R8 | Reason Guide | In excluded weeks tab (when data loaded): WEEK_53_EXCLUDED, UNPAIRED_PERIOD_WEEK, MANUAL_EXCLUDED, PAIRED_SLOT_EXCLUSION, STORE_METRIC_WEEK_PROPAGATED_EXCLUSION |
| R9 | Five-layer architecture | CCM Five-Layer Architecture detail visible in reason guide area |
| R10 | Full CCM Mask button disabled | "Generate Full CCM Mask" button is disabled with "Coming soon" text |

## Domo Runtime Tests (requires Domo deployment)

These tests can only be performed inside Domo:

| # | Action | Expected |
|---|---|---|
| D1 | Load in Domo | Source data loaded from real sourceMetrics alias |
| D2 | AppDB reachable | Health strip shows AppDB as "Ready" |
| D3 | Save Overrides | Manual overrides persist to ccm_metric_week_overrides |
| D4 | Build Mask | Mask rows written to ccm_selected_scope_mask, run logged to ccm_generation_runs |
| D5 | Run Workflow | prepareL4LFacts triggers and polls correctly |
| D6 | L4L results load | L4L ON/OFF toggle functional, comparison data visible |
| D7 | Excluded weeks | Excluded rows visible with reason codes in evidence tab |

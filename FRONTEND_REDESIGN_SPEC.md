# Forty Winks CCM / L4L Frontend Redesign Specification

## 1. Executive Summary

This redesign turns the Forty Winks CCM / L4L custom app into a guided operating console for Comparable Coverage analysis. The current end-to-end flow works, but the frontend should make the path safer, clearer, and more polished for business users and customer-facing demos.

The redesigned app should guide users through four gated steps:

1. Build the selected-scope Comparable Coverage mask.
2. Run the existing Domo Workflow to prepare L4L comparison facts.
3. Review L4L ON vs L4L OFF comparison results.
4. Understand which weeks were excluded by Comparable Coverage and why.

The experience should align with the conceptual CCM model:

- Calendar Layer / Time Truth: fiscal weeks, fiscal year, period lens, comparable week slot.
- Trading Expectation Layer / Operational Truth: whether a store was expected to trade.
- Metric Coverage Layer / Data Truth: whether a metric had usable data for a store-week.
- Comparable Coverage Model / Comparability Truth: whether the week is included in the governed comparison.
- Dashboards & Consumption / Presentation: business-facing L4L and non-L4L results.

The redesign should reduce user errors by preventing out-of-order actions, using disabled-state explanations, showing blocking progress modals during Domo operations, and moving technical diagnostics out of the primary workflow.

## 2. UX Problems in Current UI

Likely issues in the current frontend:

- The app can feel like separate panels instead of one guided workflow.
- Long explanatory text competes with actions and results.
- Users may not immediately know what to do next.
- Later actions may appear available before prior work is complete.
- Execution status is not prominent enough for long-running Domo operations.
- Results, diagnostics, and operational controls compete visually.
- Tables can be hard to scan when many technical fields are visible together.
- L4L ON vs L4L OFF needs a stronger visual comparison pattern.
- Excluded-week explanations need clearer business wording and reason badges.
- Technical runtime states, such as dataset alias mapping or workflow trigger availability, should be available but not dominate the main page.

## 3. Proposed Information Architecture

### Page Structure

Use a single-page guided workflow layout:

1. App Header
   - App name: Forty Winks CCM
   - Subtitle: Comparable Coverage and L4L comparison workflow
   - Runtime status chips: Source Dataset, Mask Output, Workflow, Comparison Dataset
   - Last completed action timestamp when available

2. Workflow Stepper
   - Four visible steps with status icons: locked, ready, running, complete, error
   - Active step receives a subtle cyan glow
   - Completed steps show checkmarks
   - Locked steps show lock icons and a short disabled reason

3. Step Content Area
   - Shows only the active step's primary content and action
   - Uses short helper text with info tooltips for detail
   - Shows one primary action at a time

4. Result Summary
   - Visible only after Step 3 data is available
   - Shows key L4L ON vs L4L OFF business metrics

5. L4L ON/OFF Comparison
   - Side-by-side summary cards and comparison table
   - Strong visual treatment for difference between governed and inclusive views

6. Coverage Exclusion Explanation
   - Visible only after comparison results are loaded
   - Explains weeks excluded by Comparable Coverage
   - Prioritizes business-readable columns and badges

7. Technical Diagnostics Drawer
   - Collapsible, default closed
   - Contains alias mapping status, AppDB reachability, workflow support, API errors, row counts, and raw technical messages
   - Should not be part of the main decision path unless an error occurs

### Main Navigation Behavior

The workflow stepper is the primary navigation. Users can revisit completed steps, but cannot execute a later step until its preconditions are satisfied. Locked steps remain visible so users understand the full journey, but their controls are disabled.

## 4. Stepper Workflow Design

### Step State Model

Each step should support these states:

- `locked`: Preconditions are missing.
- `ready`: Preconditions are met and the primary action can run.
- `running`: The action is in progress and the blocking execution modal is open.
- `completed_unacknowledged`: The operation finished, but the user has not clicked Complete in the modal.
- `completed`: The operation finished and was acknowledged.
- `error`: The operation failed and recovery guidance is visible.

Next-step guidance appears only after the current step reaches `completed`, not while it is running and not while the success modal is waiting for acknowledgement.

### Step 1: Build Coverage Mask

Purpose:
Generate or rebuild the selected-scope CCM mask.

Conceptual layer:
Calendar Layer, Trading Expectation Layer, Metric Coverage Layer, Comparable Coverage Model.

Required preconditions:

- `sourceMetrics` alias is queryable or mock fallback is active for local-only preview.
- Required selected scope exists: store, metric, period lens.
- AppDB selected-scope mask collection is reachable for Domo runtime write testing.

Primary action:
`Rebuild Selected Scope Mask`

Disabled state:

- Disabled when source data is unavailable and no mock fallback is active.
- Disabled when the selected scope is incomplete.
- Disabled when AppDB write support is unavailable in Domo runtime.

Disabled explanation:
`Select a Store, Metric, and Period Lens, then confirm source data and AppDB are reachable.`

Running state:

- Opens the blocking execution modal.
- Main page interaction is blocked.
- Button remains disabled.

Completed state:

- Shows success badge: `Mask Ready`
- Shows generated mask record count, included comparable weeks, excluded comparable weeks, and run timestamp.

Error state:

- Shows recovery guidance.
- Keeps Step 2 locked.
- Provides a link/button to open Diagnostics.

Next step unlock rule:
Step 2 unlocks only after Step 1 completes and the user clicks Complete in the execution modal.

Tooltip/help text:
`The selected-scope mask marks which Store + Metric + Fiscal Week rows are included when Comparable Coverage is ON.`

Success message:
`Selected-scope mask rebuilt successfully. You can now prepare L4L comparison facts.`

### Step 2: Prepare Comparison Facts

Purpose:
Run the existing Domo Workflow that syncs CCM mask data and prepares the L4L comparison fact dataset.

Conceptual layer:
Dashboards & Consumption / Presentation, fed by the materialized Comparable Coverage output.

Existing Workflow:

- Workflow ID: `55d72677-b9db-440a-967f-de606fad0a0c`
- Version: `1.0.0`
- Name: `Prepare L4L Comparison Facts`
- Manifest alias: `prepareL4LFacts`
- Start payload: empty object, because the Workflow has no start-node input parameters

Output dataset:

- Dataset name: `DomoDev | Phase 2 Metric | L4L Weekly Comparison Fact`
- Dataset ID: `e5dffb5a-176f-4564-a147-c0d7311a6880`
- App alias: `l4lComparisonFact`
- The frontend must read through the alias, not a hardcoded dataset ID.

Required preconditions:

- Step 1 is completed and acknowledged.
- Workflow trigger is available in Domo runtime, or manual workflow execution fallback is shown.
- The published app/card has Workflow mapping configured for alias `prepareL4LFacts`.

Primary action:
`Run Workflow and Refresh Results`

Disabled state:

- Disabled before Step 1 completes.
- Disabled while Step 1 is running or unacknowledged.
- Disabled if the Workflow trigger is unsupported and the app requires automatic execution.

Disabled explanation:
`Build the selected-scope mask first. The Workflow uses that output to prepare comparison facts.`

Running state:

- Opens the blocking execution modal.
- Shows Workflow trigger and polling progress when available.
- If exact backend stage is not observable, clearly labels stages as approximate.

Completed state:

- Shows success badge: `Comparison Facts Ready`
- Loads or refreshes rows from `l4lComparisonFact`.

Error state:

- Shows `Workflow Failed` or `Workflow Mapping Required`.
- Keeps Step 3 locked until results are successfully loaded or refreshed.
- Diagnostics should include HTTP status, message, and Domo toe if available.

Next step unlock rule:
Step 3 unlocks only after the Workflow completes or after refreshed `l4lComparisonFact` rows are successfully loaded.

Tooltip/help text:
`This Workflow prepares the dataset used for L4L ON and L4L OFF comparison. The app triggers it by alias.`

Success message:
`Comparison facts refreshed successfully. You can now review L4L results.`

### Step 3: Review L4L Results

Purpose:
Show final L4L ON vs L4L OFF comparison results.

Required preconditions:

- Step 2 completed and acknowledged, or comparison facts were manually refreshed successfully.
- `l4lComparisonFact` alias is queryable.
- Rows contain the required comparison fields.

Primary action:
`Refresh Results`

Disabled state:

- Disabled until Step 2 has completed or manual refresh is allowed after a manual Workflow run.

Disabled explanation:
`Prepare comparison facts first, then refresh the result dataset.`

Running state:

- Uses execution modal or inline loading state for refresh.
- Blocks repeated refresh clicks while loading.

Completed state:

- Shows selected Store, Metric, Period Lens, Current Period, Prior Period.
- Shows L4L ON and L4L OFF results.
- Shows comparison status and variance handling.

Error state:

- Shows readable dataset mapping or query errors.
- Diagnostics include alias name, missing fields when known, and query status.

Next step unlock rule:
Step 4 unlocks only after comparison result rows are available.

Tooltip/help text:
`L4L ON applies the Comparable Coverage mask. L4L OFF uses all rows in the comparison window.`

Success message:
`L4L comparison results loaded. You can now review excluded weeks.`

### Step 4: Explain Excluded Weeks

Purpose:
Explain which weeks were removed by Comparable Coverage and why.

Required preconditions:

- Step 3 has loaded comparison result rows.
- At least one row exists in the comparison window.

Primary action:
No destructive primary action. Optional secondary action: `Refresh Results`.

Disabled state:

- Locked until Step 3 data is available.

Disabled explanation:
`Load L4L comparison results first. Excluded weeks are derived from the result dataset.`

Completed state:

- Shows `Weeks Excluded by Comparable Coverage`.
- If no excluded weeks exist, shows a positive empty state.

Error state:

- Shows missing field or dataset refresh errors.

Tooltip/help text:
`These weeks are included when Comparable Coverage is OFF, but removed when L4L is ON.`

Success message:
`Coverage exclusions are available for review.`

## 5. Execution Modal / Progress Pop-up Design

### Modal Purpose

The execution modal provides a safe, blocking progress experience for operations that write AppDB records, trigger Domo Workflows, or refresh dependent datasets.

### Modal Requirements

The modal must include:

- Operation title.
- Short explanation.
- Progress bar.
- Step-by-step progress checklist.
- Animated loading indicator.
- Current status text.
- No cancel button while the remote Domo action is running.
- Error state with recovery guidance.
- Success state.
- Complete button after success.
- The modal closes only after the user clicks Complete.

### Main Page Blocking

While the modal is running:

- Disable all background controls.
- Add a modal overlay.
- Trap keyboard focus inside the modal.
- Mark background content as inert or inaccessible when feasible.
- Do not allow cancellation while Domo remote work is running, because remote Domo operations cannot be reliably interrupted once triggered.

### Step 1 Progress Stages

For `Build Coverage Mask`:

1. Validating selected scope.
2. Loading weekly source coverage.
3. Generating comparable week mask.
4. Clearing selected-scope mask output.
5. Writing selected-scope mask records.
6. Validating mask output.
7. Completed.

If any stage cannot be observed precisely, show it as the current frontend operation rather than claiming exact backend progress.

### Step 2 Progress Stages

For `Prepare Comparison Facts`:

1. Checking Workflow mapping support.
2. Starting `prepareL4LFacts`.
3. Waiting for Domo Workflow execution.
4. Syncing CCM mask AppDB data.
5. Running comparison DataFlow / Magic ETL.
6. Refreshing comparison dataset.
7. Loading updated L4L results.
8. Completed.

If the Workflow API only returns instance-level status, the modal should show:

`Domo Workflow is running. Detailed internal Workflow stages may not be visible from the app.`

### Error State

The modal error view should include:

- Error title.
- Safe summary.
- HTTP status when available.
- Domo toe when available.
- Suggested recovery.
- Button: `Open Diagnostics`
- Button: `Close`

Step unlocks must not advance after an error.

### Success State

The modal success view should include:

- Success title.
- Result summary, such as mask rows written or comparison rows loaded.
- Button: `Complete`

Only after Complete is clicked should the next step become visibly active.

## 6. Tooltip / Info Icon System Design

### Pattern

Use a small circular `i` info icon beside key labels, table headers, section titles, and high-impact actions. The icon should be visually quiet by default and become cyan on hover/focus.

Tooltip behavior:

- Show on hover.
- Show on keyboard focus.
- Use short copy, generally one or two sentences.
- Avoid long explanatory paragraphs on the main page.
- Keep tooltip width constrained, for example 260-320px.
- Use `aria-describedby` or equivalent accessible linkage where feasible.
- Do not rely on color alone; include text and icons.

### Tooltip Copy Examples

Comparable Coverage:
`Comparable Coverage keeps only weeks that are fair to compare for the selected Store, Metric, and Period Lens.`

L4L ON:
`Uses only rows where the Comparable Coverage mask includes the week. This is the governed like-for-like view.`

L4L OFF:
`Uses all rows in the comparison window. This is the inclusive view before Comparable Coverage filtering.`

Trading Expectation:
`Shows whether the store was expected to trade in this fiscal week. Operational closure or lifecycle rules can exclude a week.`

Manual Coverage Adjustment:
`Shows whether a user-approved override changed the week-level coverage decision.`

Final CCM Outcome:
`The final include/exclude decision after system rules and manual coverage adjustments.`

Weeks Excluded by Comparable Coverage:
`These weeks are included when Comparable Coverage is OFF, but removed when L4L is ON.`

Variance %:
`Calculated as Current minus Prior, divided by the absolute Prior value. If Prior is zero, percentage variance is not shown.`

BOTH_ZERO:
`Current and Prior are both zero, so percentage variance is not meaningful.`

PRIOR_ZERO:
`Prior is zero and Current is non-zero, so percentage variance is not meaningful.`

WEEK_COUNT_MISMATCH:
`The current and prior comparison windows contain different included week counts. Review exclusions before interpreting the result.`

WEEK_53_EXCLUDED:
`Week 53 is operationally valid when present, but excluded from comparable-week equivalence logic. Users do not need to manually exclude it.`

Workflow Alias:
`The app starts the Workflow through the manifest alias, not the Workflow UUID. The Domo card must be mapped to the Workflow.`

Diagnostics:
`Technical details for troubleshooting dataset aliases, AppDB, Workflow execution, and API errors.`

## 7. Visual Design System

### Visual Direction

Use a professional dark navy interface with restrained cyan highlights. The design can borrow a Ripple Global-inspired feel, but should remain readable and business-focused rather than flashy.

The main page should feel like an analytics operations cockpit:

- Dark navy background.
- Muted slate panels.
- Cyan active/focus accents.
- Green success states.
- Amber warning/manual attention states.
- Red error/blocking states.
- Soft panel shadows.
- Subtle glow only on the active step and primary action.

### Color Palette

Recommended CSS tokens:

| Role | Token | Hex |
| --- | --- | --- |
| Page background | `--color-bg` | `#020617` |
| Background layer | `--color-bg-elevated` | `#07111f` |
| Surface | `--color-surface` | `#0e1726` |
| Raised surface | `--color-surface-raised` | `#13243a` |
| Surface hover | `--color-surface-hover` | `#1a2e47` |
| Border | `--color-border` | `#334155` |
| Subtle border | `--color-border-soft` | `rgba(148, 163, 184, 0.22)` |
| Primary text | `--color-text` | `#f8fafc` |
| Secondary text | `--color-text-muted` | `#94a3b8` |
| Accent | `--color-accent` | `#22d3ee` |
| Accent strong | `--color-accent-strong` | `#06b6d4` |
| Success | `--color-success` | `#22c55e` |
| Warning | `--color-warning` | `#f59e0b` |
| Error | `--color-error` | `#ef4444` |
| Neutral badge | `--color-neutral` | `#64748b` |

### Typography

Use a system sans stack for Domo-native polish:

`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

Type scale:

- Page title: 24px, 600.
- Step title: 18px, 600.
- Section title: 16px, 600.
- Body: 13px, 400.
- Helper text: 12px, 400.
- Labels and badges: 11px, 600.
- KPI numbers: 28px, 600, tabular numbers.

Avoid oversized hero typography. This is an operational app, so headings should be compact and scannable.

### Spacing and Layout

- Page max width: 1440px.
- Page padding: 24px desktop, 16px tablet, 12px mobile.
- Grid gap: 16px.
- Card padding: 16-20px.
- Button height: 36-40px.
- Badge height: 22-24px.
- Table row height: 40-44px.
- Border radius: 8px or less for cards and controls.

### Cards

Use cards for repeated information groups and operational panels. Avoid nesting cards inside cards. Page sections should be clear bands or direct grid areas.

Card behavior:

- Default border: subtle slate.
- Hover: slightly lighter border if clickable.
- Active step card: cyan border and subtle glow.
- Completed card: green status badge and check icon.
- Error card: red status badge and short recovery message.

### Buttons

Button hierarchy:

- Primary: cyan accent, used for current step's main action only.
- Secondary: transparent slate border, used for refresh/open diagnostics.
- Destructive: red, used only for explicitly destructive operations.
- Disabled: muted surface, lock icon, visible disabled reason nearby.

Every primary action should have a clear icon and label. Use familiar icons, for example play, refresh, check, lock, alert, info.

### Badges

Use badges for:

- `Ready`
- `Running`
- `Complete`
- `Locked`
- `Error`
- `L4L ON`
- `L4L OFF`
- `Included`
- `Excluded`
- `Manual`
- `Week 53`
- `Prior Zero`

Badges should include text, not just color.

### Tables

Table design:

- Sticky header for long tables.
- Zebra striping or subtle row separators.
- Right-align numeric values.
- Use tabular numbers.
- Keep raw technical columns hidden by default unless they are business-relevant.
- On mobile, use horizontal scroll with sticky first column where feasible.

### Modals

Execution modals should be centered, high contrast, and focused:

- Width: 520-680px desktop.
- Width: calc(100vw - 32px) mobile.
- Progress checklist with current stage highlighted.
- Success state uses green badge and Complete button.
- Error state uses red badge and recovery guidance.

### Motion

Use motion sparingly:

- 150-250ms hover/focus transitions.
- Progress bar shimmer while running.
- Subtle active-step glow pulse.
- Respect `prefers-reduced-motion` by disabling non-essential animation.

## 8. Component Design

### AppShell

Purpose:
Owns page layout, theme, workflow state, diagnostics drawer state, and modal overlay.

Props/state:

- Current step.
- Step statuses.
- Runtime diagnostics.
- Active modal state.
- Last successful operation timestamps.

Visual behavior:
Full-page dark background with constrained content and clear section rhythm.

Interaction behavior:
Blocks main interaction when execution modal is open.

### HeaderBar

Purpose:
Provides app identity and high-level runtime health.

Props/state:

- App title.
- Environment indicator when available.
- Dataset alias status.
- AppDB status.
- Workflow status.
- Last refreshed timestamp.

Visual behavior:
Compact header with status chips aligned right on desktop and wrapping on mobile.

Interaction behavior:
Optional `Open Diagnostics` secondary button.

### WorkflowStepper

Purpose:
Shows the four-step workflow and enforces gating.

Props/state:

- Steps array.
- Active step.
- Step status.
- Disabled reason.

Visual behavior:
Horizontal timeline on desktop, vertical stack on mobile.

Interaction behavior:

- Completed steps are clickable for review.
- Ready current step is clickable.
- Locked future steps are not executable and show disabled tooltip.

### StepCard

Purpose:
Displays the current step's purpose, preconditions, primary action, and status.

Props/state:

- Step title.
- Conceptual layer.
- Helper text.
- Preconditions.
- Primary action config.
- Status.
- Error details.

Visual behavior:
One strong card per active step, with short text and compact data chips.

Interaction behavior:
Primary action opens ExecutionModal.

### ActionButton

Purpose:
Standard button for key operations.

Props/state:

- Variant: primary, secondary, destructive, disabled.
- Icon.
- Label.
- Loading/running flag.
- Disabled reason.

Visual behavior:
Primary button receives accent fill; disabled button shows lock icon.

Interaction behavior:
When disabled, hover/focus shows why the action is unavailable.

### InfoTooltip

Purpose:
Reusable circular info icon and tooltip.

Props/state:

- Tooltip text.
- Placement.
- Accessible label.

Visual behavior:
Small circular `i`, cyan on hover/focus.

Interaction behavior:
Shows on hover and focus. Dismisses on blur, mouse leave, or Escape.

### StatusBadge

Purpose:
Consistent compact status display.

Props/state:

- Status type.
- Label.
- Optional icon.

Visual behavior:
Color-coded but always includes text.

Interaction behavior:
Non-interactive by default.

### MetricCard

Purpose:
Shows high-level values such as Current Value, Prior Value, Absolute Variance, Variance %, Included Weeks, Excluded Weeks, and Source Records.

Props/state:

- Label.
- Value.
- Status.
- Tooltip.
- Delta direction.

Visual behavior:
Compact card with numeric emphasis and muted helper label.

Interaction behavior:
Optional tooltip on label.

### ResultComparisonTable

Purpose:
Shows L4L ON and L4L OFF results side by side.

Props/state:

- Rows for L4L ON and L4L OFF summaries.
- Selected metric display label.
- Variance status.

Visual behavior:
Two-column comparison on desktop; stacked comparison cards on mobile.

Interaction behavior:
Rows can expand to show calculation detail if needed.

### ExcludedWeeksTable

Purpose:
Explains weeks removed by Comparable Coverage.

Props/state:

- Excluded rows.
- Sort state.
- Pagination state.
- Filter state.

Visual behavior:
Readable table with badges for Y/N outcomes and reason codes.

Interaction behavior:
Sortable by fiscal year, fiscal week, comparison side, and outcome reason.

### WeeklyDetailTable

Purpose:
Optional detailed table for all comparison weeks.

Props/state:

- Rows.
- Include/exclude filters.
- Search/filter by store, metric, reason.

Visual behavior:
Collapsed or secondary by default so it does not overwhelm users.

Interaction behavior:
Supports pagination and sticky header.

### ExecutionModal

Purpose:
Blocking operation progress and completion acknowledgement.

Props/state:

- Operation title.
- Operation description.
- Stages.
- Current stage index.
- Progress percent.
- Status: running, success, error.
- Result summary.
- Error summary.

Visual behavior:
Centered modal with progress bar and checklist.

Interaction behavior:

- No cancel while running.
- Complete button only after success.
- Error close/retry guidance only after failure is final.

### DiagnosticsDrawer

Purpose:
Contains technical details without competing with business workflow.

Props/state:

- Dataset alias status.
- AppDB status.
- Workflow trigger status.
- Last API errors.
- Missing fields.
- Row counts.

Visual behavior:
Right-side drawer or collapsible bottom panel.

Interaction behavior:
Can be opened from header, error panels, or footer.

### EmptyState

Purpose:
Clear guidance when data is not available yet.

Props/state:

- Title.
- Short message.
- Recommended action.
- Optional disabled reason.

Visual behavior:
Quiet card with icon, short copy, and next action if valid.

### ErrorState

Purpose:
Readable error display with recovery path.

Props/state:

- Error title.
- User-facing message.
- Technical detail.
- Recovery actions.

Visual behavior:
Red badge, high-contrast message, diagnostics link.

Interaction behavior:
Allows retry only when retry is safe.

## 9. Data-to-UI Mapping

### Required Fields

| Field | UI usage | Notes |
| --- | --- | --- |
| `period_type` | Period Lens display, filters, result grouping | Show business label when available. |
| `period_label_current` | Current period label | Used in result cards and comparison header. |
| `period_label_prior` | Prior period label | Used in result cards and comparison header. |
| `comparison_side` | Current/Prior side | Use badge: Current or Prior. |
| `store_code` | Store identifier | Use in scope summary and table. |
| `store_name` | Store name | Prefer over code in user-facing labels when available. |
| `region` | Region context | Show in scope summary and filters. |
| `metric` | Metric identity | Map to business display label. |
| `week_ending` | Week Ending | Show as date in week tables. |
| `week_of_year` | Fiscal Week | Include year context. |
| `month_of_year` | Month | Optional display field; show `-` if absent. |
| `financial_year` | Fiscal Year | Required to disambiguate week numbers. |
| `source_value` | Weekly metric value | Sum for current/prior results. |
| `source_row_count` | Source Records | Sum or show per week. |
| `system_include_flag` | System Include | Badge Y/N. |
| `manual_include_flag` | Manual Coverage Adjustment | Badge Y/N/blank. |
| `final_include_flag` | Final CCM Outcome | Badge Included/Excluded. |
| `mask_include_flag` | L4L ON filter | `Y` included, `N` excluded. |
| `final_reason_code` | Outcome Reason | Business reason badge. |
| `manual_reason` | Manual reason | Show in details when present. |

### Optional Fields

Some Domo card-level dataset mappings may omit optional fields. The frontend should tolerate missing optional fields and display `-` rather than failing.

Optional examples:

- `comparable_week_slot`
- `month_of_year`
- Additional audit/display fields

### Metric Display Mapping

| Source metric | Display label |
| --- | --- |
| `S - Line Sell Total` | `Sales` |
| `Traffic In` | `Foot Traffic` |
| `Bed Match` | `BedMatch` |
| Unknown metric | Raw metric name |

### L4L ON and L4L OFF Rules

L4L ON:
Use rows where `mask_include_flag = Y`.

L4L OFF:
Use all rows in the comparison window.

The app should clearly label these as governed versus inclusive views:

- L4L ON: Governed Comparable Coverage view.
- L4L OFF: Inclusive comparison-window view.

## 10. Results Presentation Design

### Primary Result Summary

Show a compact result summary after Step 3 data is loaded:

- Selected Store.
- Selected Metric.
- Period Lens.
- Current Period.
- Prior Period.
- Comparison Status.
- L4L ON Current Value.
- L4L ON Prior Value.
- L4L OFF Current Value.
- L4L OFF Prior Value.
- Difference caused by Comparable Coverage.

### L4L ON vs L4L OFF Comparison

Use side-by-side comparison:

Left card/table column:
`L4L ON`

Right card/table column:
`L4L OFF`

Rows:

- Current Value.
- Prior Value.
- Absolute Variance.
- Variance %.
- Included Current Weeks.
- Included Prior Weeks.
- Source Records Matched.
- Comparison Status.

### Difference Explanation

Add a compact highlight card:

Title:
`Comparable Coverage Impact`

Content:

- Absolute difference between L4L ON and L4L OFF current variance.
- Count of weeks excluded.
- Top outcome reason.

Example:
`Comparable Coverage removed 4 weeks from the governed comparison. The L4L ON variance is $12,400 lower than the inclusive view.`

### Variance % Display Rule

- If `prior_value = 0` and `current_value = 0`, display `N/A` and status `BOTH_ZERO`.
- If `prior_value = 0` and `current_value != 0`, display `N/A` and status `PRIOR_ZERO`.
- Otherwise, display `(current_value - prior_value) / ABS(prior_value)` as a percentage with one decimal place.

### Comparison Status

Recommended status labels:

- `OK`: Normal comparison.
- `BOTH_ZERO`: Current and Prior are both zero.
- `PRIOR_ZERO`: Prior is zero, so variance percentage is unavailable.
- `WEEK_COUNT_MISMATCH`: Current and Prior included week counts differ.
- `NO_DATA`: No comparison data is available.

## 11. Excluded Weeks Explanation Design

### Section Title

`Weeks Excluded by Comparable Coverage`

### Helper Text

Visible helper:
`These weeks are included when Comparable Coverage is OFF, but removed when L4L is ON.`

Tooltip detail:
`Comparable Coverage excludes weeks that are not fair to compare for the selected Store, Metric, and Period Lens. Week 53 is shown when present but excluded from equivalence logic automatically.`

### Table Columns

| Column | Source field |
| --- | --- |
| Comparison Side | `comparison_side` |
| Comparable Slot | `comparable_week_slot` |
| Fiscal Year | `financial_year` |
| Fiscal Week | `week_of_year` |
| Week Ending | `week_ending` |
| Weekly Metric Value | `source_value` |
| Source Records | `source_row_count` |
| Trading Expectation | derived/system context when available |
| Manual Coverage Adjustment | `manual_include_flag` |
| Final CCM Outcome | `final_include_flag` or `mask_include_flag` |
| Outcome Reason | `final_reason_code` or `manual_reason` |

### Badge Rules

- `Y`: Green badge labeled `Included` or `Yes`.
- `N`: Amber or red badge labeled `Excluded` or `No`, depending on severity.
- Manual override present: Amber badge labeled `Manual`.
- `WEEK_53_EXCLUDED`: Amber badge labeled `Week 53`.
- Missing optional field: Neutral `-`.

### Sorting and Filtering

Default sort:

1. `period_type`
2. `comparison_side`
3. `financial_year`
4. `week_of_year`
5. `week_ending`

Filters:

- Comparison Side.
- Outcome Reason.
- Manual adjustment only.
- Week 53 only.

### Empty State

If no excluded weeks exist:

Title:
`No weeks were excluded`

Message:
`Comparable Coverage did not remove any weeks for this selected scope.`

## 12. Empty, Loading, Success, Warning, Error States

### No Mask Generated Yet

State:
Step 1 ready, Step 2 locked.

Message:
`Build the selected-scope mask to start the L4L preparation workflow.`

### Workflow Not Run Yet

State:
Step 2 ready after Step 1 completion.

Message:
`Run the Domo Workflow to prepare comparison facts for this selected scope.`

### Dataset Empty

State:
Step 3 error or empty.

Message:
`No L4L comparison rows are available. Run the Workflow, then refresh results.`

### Dataset Stale or Not Refreshed

State:
Warning.

Message:
`The comparison dataset may not include the latest mask output. Run or refresh the Workflow results.`

### Required Fields Missing

State:
Error.

Message:
`The comparison dataset is missing required fields. Open Diagnostics for field details.`

Optional fields should not create blocking errors.

### No Excluded Weeks

State:
Success/empty.

Message:
`No weeks were excluded by Comparable Coverage for this selected scope.`

### Prior Value Zero

State:
Warning badge.

Message:
`Variance % is not shown because the prior value is zero.`

### Domo Workflow Trigger Unsupported

State:
Warning/manual fallback.

Message:
`Automatic Workflow trigger is not available in this runtime. Run the Workflow manually in Domo, then click Refresh Results.`

### Domo Workflow Running

State:
Execution modal running.

Message:
`Domo is preparing L4L comparison facts. This may take a few minutes.`

### Domo Workflow Complete

State:
Execution modal success.

Message:
`Workflow completed. Updated comparison facts are loading.`

### Domo Workflow Failed

State:
Execution modal error.

Message:
`The Workflow did not complete successfully. Check Workflow run details in Domo and open Diagnostics for API details.`

### Dataset Refresh Failed

State:
Error.

Message:
`The comparison dataset could not be loaded through alias l4lComparisonFact. Check dataset mapping and field availability.`

## 13. Interaction Rules

### Clickable

- Current ready step primary action.
- Completed step headers for review.
- Refresh Results after Step 2 completion or manual Workflow run.
- Open Diagnostics.
- Tooltip icons.
- Table sorting/filter controls.

### Disabled

- Step 2 action until Step 1 is completed and acknowledged.
- Step 3 refresh until Step 2 has completed or manual refresh is allowed.
- Step 4 content until comparison result rows are available.
- Any action while execution modal is running.

### Hidden

- Step 3 result guidance before Step 2 completion.
- Step 4 excluded-week guidance before Step 3 data is available.
- Technical diagnostics by default.
- Long conceptual explanations on the main page.

### Visible

- Full stepper at all times.
- Active step purpose and next action.
- Disabled reasons for locked steps.
- Runtime status chips in header.
- Technical diagnostics when opened or when an error requires it.

### Next-Step Guidance

Next-step guidance appears only after:

1. Current operation succeeds.
2. Success modal appears.
3. User clicks Complete.
4. Step status changes from `completed_unacknowledged` to `completed`.

### Error Recovery

- Errors keep the current step active.
- Future steps remain locked.
- Recovery copy should explain the next safe action.
- Retry is offered only when retrying does not risk duplicate writes or out-of-order execution.
- Diagnostics contain technical details, but the main error message remains business-readable.

### Refresh Results

`Refresh Results` should be safe and non-mutating. It should query `l4lComparisonFact` through the alias and update the frontend state only.

### Diagnostics

Diagnostics should include:

- `sourceMetrics` alias query status.
- `l4lComparisonFact` alias query status.
- AppDB collection reachability.
- Workflow support status.
- Workflow alias and instance id when available.
- Last HTTP status and safe message.
- Missing required fields.
- Optional fields missing, marked as non-blocking.

Do not log or display secrets, tokens, or credentials.

## 14. Accessibility and Responsiveness

### Keyboard Navigation

- All buttons, tooltip icons, stepper items, filters, and drawer controls must be keyboard reachable.
- Tab order should follow visual order.
- Locked stepper items should be focusable only if they provide useful disabled explanation.

### Focus States

- Use visible focus rings with cyan accent.
- Focus ring must not be color-only; use outline or shadow.

### Tooltip Accessibility

- Tooltip icons need accessible labels.
- Tooltip content should be associated with the trigger using `aria-describedby` where feasible.
- Tooltips should appear on focus and disappear on blur or Escape.

### Modal Accessibility

- Execution modal should use dialog semantics.
- Trap focus while open.
- Return focus to the triggering action after close.
- Announce errors with `role="alert"` or `aria-live`.
- Do not allow keyboard interaction with the page behind the modal.

### Contrast

- Normal text should meet WCAG AA contrast.
- Muted text should remain readable on dark backgrounds.
- Status cannot be conveyed by color alone.

### Responsive Layout

Desktop:

- Header status chips aligned to the right.
- Stepper horizontal.
- Results side by side.
- Tables full width with sticky headers.

Tablet:

- Stepper can wrap.
- Result cards use two-column grid.
- Diagnostics drawer may become bottom sheet.

Mobile:

- Stepper becomes vertical.
- Result comparison cards stack.
- Tables use horizontal scroll.
- Sticky action footer is allowed for the current step action.

### Reduced Motion

Respect `prefers-reduced-motion`:

- Disable glow pulse.
- Disable shimmer.
- Keep progress updates textual and static.

## 15. Implementation Plan for Later Coding

### Phase A: Design System and Layout Skeleton

- Add design tokens.
- Build AppShell, HeaderBar, and base layout.
- Add responsive grid structure.
- Move diagnostics into a drawer/collapsible area.

### Phase B: Stepper State Machine and Execution Modal

- Implement step status model.
- Add gating rules.
- Add reusable ExecutionModal.
- Add acknowledgement behavior so next guidance appears only after Complete.

### Phase C: Step 1 and Step 2 Action Integration

- Connect Step 1 mask generation to the modal stages.
- Connect Step 2 Workflow execution and polling to the modal stages.
- Preserve existing Domo aliases and AppDB write boundaries.

### Phase D: Results Summary and Comparison Views

- Redesign L4L ON/OFF result cards.
- Add Comparable Coverage Impact summary.
- Apply prior-zero and variance display rules.

### Phase E: Excluded Weeks and Weekly Detail Tables

- Redesign `Weeks Excluded by Comparable Coverage`.
- Add sorting, filtering, badges, and optional field fallbacks.
- Keep full weekly detail secondary or collapsible.

### Phase F: Tooltips and Diagnostics Drawer

- Add InfoTooltip component and tooltip copy.
- Add diagnostics drawer with alias, AppDB, Workflow, and dataset query states.
- Ensure no secrets or tokens are shown.

### Phase G: Tests and Polish

- Add unit tests for step gating and calculations.
- Add UI tests for modal and disabled states.
- Add responsive checks.
- Add accessibility checks.
- Polish spacing, table density, focus states, and empty states.

## 16. Testing Plan

Future implementation should test:

- Step 2 is disabled before Step 1 completes.
- Step 3 is disabled before Step 2 completes or results are refreshed.
- Step 4 is hidden/locked before Step 3 data is available.
- Running modal blocks page interaction.
- Running modal has no cancel button.
- Complete button appears only after success.
- Next-step guidance appears only after Complete is clicked.
- Error state does not unlock later steps.
- Tooltip appears on hover and focus.
- Tooltip can be dismissed with Escape.
- L4L ON uses `mask_include_flag = Y`.
- L4L OFF uses all comparison-window rows.
- Variance % handles normal, `BOTH_ZERO`, and `PRIOR_ZERO` cases.
- Excluded weeks table shows rows where `mask_include_flag = N`.
- Week 53 appears when relevant and uses `WEEK_53_EXCLUDED`.
- User is not required to manually exclude Week 53.
- Missing optional fields render `-`.
- Missing required fields show a blocking error.
- Dataset empty state is readable.
- Workflow unsupported state shows manual fallback.
- Workflow failed state shows recovery guidance.
- Diagnostics drawer does not expose secrets or tokens.
- Mobile layout stacks cleanly.
- Tables scroll without breaking layout.
- Keyboard navigation reaches all controls.
- Errors are announced with accessible semantics.
- No `domo publish` is run by tests.
- Source datasets are not mutated.
- AppDB mutation remains limited to existing intended selected-scope mask actions.
- Workflow, DataFlow, Magic ETL, and Domo object definitions are not modified.

## 17. Out of Scope

This redesign specification does not include:

- Backend logic changes.
- Workflow definition changes.
- Workflow version changes.
- DataFlow or Magic ETL definition changes.
- Domo publish.
- Source dataset mutation.
- Output dataset mutation.
- AppDB schema changes unless separately approved.
- Automatic Domo card mapping changes.
- Automatic dataset mapping changes.
- Full production CCM mask generation redesign.
- Replacing the existing L4L comparison fact dataset.
- Changing existing Domo object permissions.

## 18. Final Design Review Checklist

Before implementation, confirm:

- [ ] Step flow is approved.
- [ ] Step gating rules are approved.
- [ ] Action labels are approved.
- [ ] Tooltip copy is approved.
- [ ] Execution modal behavior is approved.
- [ ] No-cancel remote operation rule is approved.
- [ ] Complete acknowledgement behavior is approved.
- [ ] Color palette is approved.
- [ ] Typography and density are approved.
- [ ] Result summary layout is approved.
- [ ] L4L ON/OFF comparison layout is approved.
- [ ] Excluded weeks table layout is approved.
- [ ] Disabled-state wording is approved.
- [ ] Empty/error states are approved.
- [ ] Diagnostics drawer scope is approved.
- [ ] Responsive behavior is approved.
- [ ] Accessibility expectations are approved.
- [ ] Testing plan is approved.
- [ ] Out-of-scope boundaries are approved.

## Assumptions and Open Questions

### Assumptions

- The app remains a client-side Domo custom app.
- The app continues to use manifest aliases for datasets and workflows.
- `sourceMetrics` remains read-only.
- `l4lComparisonFact` remains read-only from the frontend.
- `prepareL4LFacts` remains the Workflow alias.
- The Workflow has no start-node input parameters.
- Step 1 selected-scope mask generation remains the only intended AppDB write action in this flow.
- Technical diagnostics are useful for troubleshooting but should not dominate the primary business workflow.

### Open Questions

- Should the redesigned UI use a fully dark theme, or a light/dark hybrid with dark header and light data tables?
- Should `Refresh Results` be available before running the Workflow when the user knows the dataset was prepared externally?
- Should the Workflow progress modal show only actual API status, or also a clearly labeled approximate stage list?
- Should excluded weeks table filtering be included in the first implementation phase, or deferred until after the core redesign lands?
- Should the current selected Store/Metric/Period Lens controls remain in the main step card or move into a persistent scope bar?

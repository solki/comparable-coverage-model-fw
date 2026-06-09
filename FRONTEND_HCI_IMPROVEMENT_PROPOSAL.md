# Forty Winks CCM / L4L HCI Improvement Proposal

## 1. Purpose

This proposal defines a stronger human-computer interaction design for the current Forty Winks CCM / L4L Domo custom app. It builds on `FRONTEND_REDESIGN_SPEC.md`, the current `src/ui.js` structure, the current `src/styles.css` dark cockpit theme, and `ui-ux-pro-max` guidance for comparison dashboards, data-dense BI interfaces, loading states, empty states, disabled states, focus states, and accessible error recovery.

This is a design proposal only. It does not change CCM algorithms, Domo objects, datasets, Workflows, DataFlows, Magic ETL, AppDB schemas, or manifest mappings.

## 2. Current UI Readout

### What Already Works

- The app now has a clear four-step workflow:
  - Build Coverage Mask
  - Prepare L4L Comparison Facts
  - Review L4L Results
  - Explain Excluded Weeks
- The dark navy cockpit theme is directionally right for a customer-facing analytics demo.
- The UI already includes step gating, modal progress, diagnostics drawer, tooltip primitives, status badges, L4L ON/OFF logic, and excluded-week explanation.
- CSS tokens exist for background, surfaces, text, accent, success, warning, error, border, and panel shadows.
- Tables already have sticky headers, horizontal overflow handling, and compact row density.
- The app already preserves the key business logic:
  - L4L ON uses `mask_include_flag = Y`.
  - L4L OFF uses all comparison rows.
  - Excluded weeks use `mask_include_flag = N`.

### Main HCI Problems Remaining

1. The page is still too flat.
   The stepper and guided step exist, but all major panels still render as one long page. Users can see dataset overview, selection, selected summary, comparable week review, mask generation, validation, workflow, and L4L results at once. This creates cognitive load.

2. The active task is not visually isolated enough.
   The current step is shown, but the action the user should perform next competes with many other cards and tables.

3. The scope selector is not persistent enough.
   Store, Metric, and Period Lens are selected in a regular panel. Because all downstream results depend on scope, the selected scope should be a persistent context object, not just another form.

4. Results do not yet follow a strong conclusion-to-evidence flow.
   Users should first see "what changed because Comparable Coverage is ON", then "how L4L ON compares to L4L OFF", then "which weeks explain the difference".

5. Technical and business views still overlap.
   Diagnostics are hidden in a drawer, which is good, but technical labels and detailed write summaries still appear in the main content earlier than most business users need them.

6. Disabled states explain why something is locked, but not always what action resolves it.
   A disabled state should answer two questions:
   - Why is this unavailable?
   - What exact action unlocks it?

7. Tables are functionally complete but not decision-optimized.
   The excluded weeks and weekly detail tables should have stronger grouping, reason-code explanations, filters, and "why this row matters" affordances.

## 3. Recommended Product Model

The next iteration should feel less like a dashboard page and more like a controlled operating console:

1. Command Center
   The top of the page tells the user where they are, what scope they are working on, what is ready, and what the next safe action is.

2. Active Work Area
   Only the current step's primary action and immediate supporting information should be prominent.

3. Result Board
   Once comparison facts are ready, the main page shifts into a result-first mode with summary, L4L ON/OFF comparison, and excluded-week explanation.

4. Evidence Drawer
   Detailed weekly records, technical diagnostics, AppDB write details, and source dataset health should remain available but secondary.

This model fits the conceptual CCM layers:

- Time Truth and Operational Truth appear as compact context and explanation.
- Data Truth appears as source health and weekly data coverage.
- Comparability Truth appears as mask status and excluded-week reasons.
- Presentation appears as the L4L ON/OFF result board.

## 4. Proposed Information Architecture V2

### A. Sticky Command Header

Replace the current header plus general status banner with a tighter command header:

- Left:
  - App name: `Forty Winks CCM`
  - Page label: `Comparable Coverage Workflow`
  - Runtime chip: Local / Domo runtime

- Center:
  - Persistent Scope Bar:
    - Store
    - Metric
    - Period Lens
    - Current vs Prior period labels when available

- Right:
  - Source health chip
  - AppDB health chip
  - Workflow mapping chip
  - Diagnostics button

Why:
Scope is the user's working context. It should stay visible while users scroll through results and evidence.

### B. Workflow Rail

Keep the four-step model, but change from four large cards to a compact workflow rail:

- Step number
- Step title
- State badge
- Last completed timestamp
- One-line dependency

State labels:

- `Needs Scope`
- `Ready`
- `Running`
- `Review Complete`
- `Complete`
- `Needs Attention`

Why:
The current stepper uses space well, but each step has too much text and can still look like a navigation card. A workflow rail should communicate state quickly.

### C. Active Step Workspace

Create a single active step workspace below the rail. It should show only one of these at a time:

- Step 1 workspace: selected scope validation, mask preview, rebuild action.
- Step 2 workspace: Workflow trigger, manual fallback, polling/progress.
- Step 3 workspace: result refresh and L4L summary.
- Step 4 workspace: excluded-week explanation.

Other step details should collapse into completed summaries.

Why:
This reduces the "everything everywhere" feeling and makes the next action obvious.

### D. Result Board

After comparison data is available, show a dedicated result board:

1. Headline Insight
   A single sentence:
   `Comparable Coverage changed variance by +12,340 by excluding 8 weeks.`

2. KPI Strip
   - Current Value
   - Prior Value
   - Absolute Variance
   - Variance %
   - Included Weeks
   - Excluded Weeks

3. L4L Mode Switch
   Keep the switch, but visually label the two meanings:
   - ON: Governed Comparable Coverage
   - OFF: Inclusive Comparison Window

4. Always-visible ON/OFF Comparison
   Show both L4L ON and L4L OFF side by side even when the main KPI strip follows the switch.

5. Explanation CTA
   `View excluded weeks`

Why:
Business users need the answer before the table.

### E. Evidence Area

Use tabs or segmented sections:

- `Excluded Weeks`
- `All Weekly Detail`
- `Validation`
- `Technical Details`

Default to `Excluded Weeks` when exclusions exist. Default to `Result Summary` when no exclusions exist.

Why:
The user should not have to scroll through all details to find the evidence.

## 5. Interaction Design Improvements

### 5.1 Next Best Action Pattern

Add a persistent "Next best action" strip below the command header.

Examples:

- Before source loaded:
  `Load source summary to begin.`

- After scope ready:
  `Build the selected-scope mask for Store 21CH / Sales / YTD.`

- After mask success but before Complete:
  `Review the completed operation and click Complete to unlock the Workflow step.`

- After mask Complete:
  `Run Prepare L4L Comparison Facts.`

- After Workflow Complete:
  `Review L4L ON vs L4L OFF results.`

This strip should include:

- Next action label
- One-sentence reason
- Primary action button when safe
- Disabled reason when not safe

### 5.2 Scope Change Warning

Changing Store, Metric, or Period Lens after a mask has been generated should show a non-blocking warning:

`Scope changed. Existing mask and L4L result context may no longer match the selected scope. Rebuild the selected-scope mask before running the Workflow.`

Required behavior:

- Mark Step 1 as `Ready` again.
- Mark Step 2/3/4 as stale or locked.
- Clear or visually de-emphasize old comparison results.

This prevents stale-result interpretation errors.

### 5.3 Completion Acknowledgement

Keep the current Complete button behavior, but improve copy:

- Success modal title: `Mask Built`
- Success modal body:
  `The selected-scope mask has been written. The comparison dataset has not been refreshed yet.`
- Complete button:
  `Complete and Unlock Workflow`

For Workflow:

- Success modal title: `Comparison Facts Prepared`
- Complete button:
  `Complete and Review Results`

Why:
The current `Complete` button is safe, but more specific copy makes the gate feel intentional rather than arbitrary.

### 5.4 Manual Workflow Fallback

If Workflow trigger is unavailable:

- Step 2 should not simply look disabled.
- It should show a manual path:
  1. Run the Domo Workflow manually.
  2. Wait for completion.
  3. Click `Refresh Results`.

Recommended UI:

- Primary disabled button: `Run Workflow Automatically`
- Secondary active button: `Refresh Results`
- Help panel: `Automatic trigger is unavailable in this runtime.`

Why:
Users should still understand how to proceed.

### 5.5 Error Recovery

Errors should appear near the action that failed and in the diagnostics drawer.

Each error should include:

- What failed
- Whether any data was changed
- What to do next
- Diagnostics link

Example:

`Workflow could not be started. No comparison facts were changed. Check the Workflow mapping in Domo, or run the Workflow manually and then refresh results.`

## 6. Result Presentation Improvements

### 6.1 Headline Insight Card

Add a larger but compact insight card above KPI cards:

`Comparable Coverage Impact`

Display:

- Impact on absolute variance
- Excluded week count
- Top exclusion reason
- Current selected mode

Suggested layout:

- Left: one-sentence business interpretation
- Right: three compact metrics

Example:

`L4L ON variance is 12,340 lower than L4L OFF because 8 weeks were excluded, mainly due to WEEK_53_EXCLUDED.`

### 6.2 ON/OFF Comparison Cards Before Table

Before the comparison table, show two side-by-side mini scorecards:

L4L ON:

- Current
- Prior
- Variance
- Variance %
- Included weeks

L4L OFF:

- Current
- Prior
- Variance
- Variance %
- Total weeks

Then keep the detailed comparison table below.

Why:
Tables are good for verification. Cards are better for comprehension.

### 6.3 Variance Status Explanation

Show variance status as a badge with explanation:

- `OK`
- `PRIOR_ZERO`
- `BOTH_ZERO`
- `WEEK_COUNT_MISMATCH`

If status is not `OK`, show a small inline explanation. Do not require tooltip-only discovery.

Example:

`PRIOR_ZERO: Prior value is zero, so variance percentage is not meaningful.`

## 7. Excluded Weeks Experience

### 7.1 Default Excluded Weeks Summary

Above the table, show:

- Total excluded weeks
- Excluded current weeks
- Excluded prior weeks
- Reason breakdown
- Manual override count

### 7.2 Table Filters

Keep filtering basic for this version, but add high-value filters:

- Side: Current / Prior / All
- Reason: dropdown
- Manual adjustment: All / Manual only
- Week 53: toggle

### 7.3 Reason-Code Dictionary

Add a small expandable "Reason guide":

- `WEEK_53_EXCLUDED`: Week 53 is excluded from comparable-slot equivalence logic.
- `MANUAL_EXCLUDED`: A user-approved manual coverage adjustment excluded this week.
- `PAIRED_SLOT_EXCLUSION`: Current/prior paired slot was excluded to keep comparison alignment.
- `STORE_METRIC_WEEK_PROPAGATED_EXCLUSION`: Same Store + Metric + Week exclusion applied anywhere that week appears.

Why:
Reason codes are accurate but not self-explanatory for business users.

### 7.4 Row-Level Explanation

Add an optional row expansion:

`Why was this week excluded?`

Expanded content:

- Trading expectation
- Manual adjustment
- Final outcome
- Propagation impact
- Source records

## 8. Visual Design System Refinements

### Keep

- Dark navy base.
- Cyan for active/focus.
- Green for success.
- Amber for warning/manual attention.
- Red for blocking errors.
- Tabular numbers.
- 8px radius maximum.
- Sticky table headers.
- Reduced motion support.

### Improve

1. Reduce glow frequency.
   Currently many surfaces can feel equally elevated. Reserve glow for:
   - active step
   - focused primary action
   - running operation

2. Add surface hierarchy.
   Recommended layers:
   - Page background: `#020617`
   - App shell band: `#07111f`
   - Primary panel: `#0e1726`
   - Raised panel: `#13243a`
   - Table header: `#101b2c`

3. Use cyan less often.
   Cyan should mean "active / actionable / focus", not general decoration.

4. Use green only for completed or positive states.
   Do not use green merely for L4L ON. L4L ON is a mode, not always a positive outcome.

5. Add neutral status for stale results.
   Suggested color: slate / blue-gray.

6. Improve disabled readability.
   Current opacity-based disabled states can make text hard to read. Prefer:
   - lower emphasis background
   - lock icon or label
   - clear disabled reason
   - text still readable

## 9. Component Changes for Next Implementation

### New / Revised Components

1. `CommandHeader`
   Persistent app title, runtime, scope, health chips, diagnostics.

2. `ScopeBar`
   Store, Metric, Period Lens, period labels, stale-state warning.

3. `NextActionStrip`
   Single recommended next action and its explanation.

4. `WorkflowRail`
   Compact four-step progress rail with dependency summaries.

5. `ActiveStepWorkspace`
   One visible active step body at a time.

6. `ResultInsightCard`
   Business interpretation of Comparable Coverage impact.

7. `CoverageModeSwitch`
   Stronger ON/OFF labels with governed/inclusive semantics.

8. `ComparisonScorecards`
   L4L ON and L4L OFF cards before the table.

9. `ReasonGuide`
   Expandable business-friendly dictionary of outcome reasons.

10. `EvidenceTabs`
   Excluded Weeks, Weekly Detail, Validation, Technical Details.

11. `StaleDataBanner`
   Warns when selected scope changed or mask was rebuilt but comparison facts have not been refreshed.

### Components to De-Emphasize

- `Global Dataset Overview`
  Keep it, but move below the fold or into a `Source Health` drawer/accordion.

- `Selected Scope Validation Summary`
  Keep the business validation metrics near Step 1; move technical write summary into evidence/technical details.

- `Generate Full CCM Mask`
  Keep disabled placeholder, but move to a small future-state note. It should not visually compete with the selected-scope workflow.

## 10. Accessibility Improvements

Priority requirements:

- Error banners should use `role="alert"` or `aria-live`.
- Execution modal should trap focus and return focus to the triggering button after close.
- Tooltip should dismiss on Escape.
- Disabled buttons should have adjacent text explaining the unlock action.
- Switch should announce current mode and next state.
- Tables should include captions or `aria-label`.
- Row expansion buttons should have explicit labels.
- Avoid color-only status communication; every badge needs text.
- Maintain contrast for muted text; secondary text should remain at least 3:1.

## 11. Responsive Design Improvements

Desktop:

- Sticky command header.
- Workflow rail horizontal.
- Result scorecards side by side.
- Evidence tables full width.

Tablet:

- Command header wraps scope and health chips.
- Workflow rail becomes 2x2.
- Result cards become two columns.

Mobile:

- Workflow rail becomes vertical.
- ScopeBar becomes stacked.
- Result scorecards stack.
- Tables remain horizontally scrollable, but the first column should be sticky when feasible.
- NextActionStrip should become a sticky bottom action area only when the active step has a primary action.

## 12. Implementation Phases

### Phase 1: Information Architecture Cleanup

- Add `CommandHeader`.
- Add persistent `ScopeBar`.
- Add `NextActionStrip`.
- Convert stepper into compact `WorkflowRail`.
- Keep existing functions and state logic.

### Phase 2: Active Step Workspace

- Show only the active step workspace prominently.
- Collapse completed step details into summaries.
- Move full technical write summary out of the main flow.
- Move disabled Full CCM Mask placeholder to a small future-state note.

### Phase 3: Result Board

- Add `ResultInsightCard`.
- Add L4L ON/OFF scorecards.
- Keep the existing comparison table.
- Add variance status explanation.

### Phase 4: Evidence UX

- Add `EvidenceTabs`.
- Add excluded-week summary metrics.
- Add basic filters.
- Add `ReasonGuide`.
- Add row-level expansion for "why excluded".

### Phase 5: Accessibility and Polish

- Modal focus management.
- Tooltip Escape dismissal.
- ARIA labels and table captions.
- Stale data warning.
- Responsive and reduced-motion QA.

## 13. What Not to Change

Do not change:

- Core CCM algorithm.
- L4L ON/OFF logic.
- Workflow definition.
- Workflow ID or alias mapping.
- DataFlow / Magic ETL.
- Source datasets.
- AppDB schemas.
- Dataset mappings.
- Domo objects.
- `domo publish` behavior.

## 14. Approval Checklist

Before implementation, confirm:

- [ ] The new Command Header and ScopeBar direction is approved.
- [ ] The "one active workspace at a time" direction is approved.
- [ ] NextActionStrip copy and behavior are approved.
- [ ] Result Insight Card wording is approved.
- [ ] L4L ON/OFF scorecard layout is approved.
- [ ] Excluded-week filters are enough for the next version.
- [ ] Reason-code dictionary copy is approved.
- [ ] Technical diagnostics should move further behind Evidence/Diagnostics.
- [ ] The dark navy theme should remain the visual base.
- [ ] No backend or Domo object changes are approved in this phase.

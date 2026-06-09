import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Phase 2 UI shows workflow details and manual-run instruction when trigger is unsupported', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const workflowSource = readFileSync('src/workflowService.js', 'utf8');
  const combined = `${uiSource}\n${workflowSource}`;

  assert.match(combined, /Prepare L4L Comparison Facts/);
  assert.match(combined, /1\.0\.0/);
  assert.match(combined, /DomoDev \| Phase 2 Metric \| L4L Weekly Comparison Fact/);
  assert.match(combined, /Run the Workflow manually in Domo, then click Refresh Results/);
  assert.match(uiSource, /data-action="refresh-l4l-results"/);
  assert.match(uiSource, /l4lComparisonFact/);
});

test('Phase 2 UI exposes L4L comparison visualization labels', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  for (const label of [
    'Store Performance — L4L Comparison',
    'Comparable Coverage',
    'L4L ON',
    'L4L OFF',
    'Current Value',
    'Prior Value',
    'Absolute Variance',
    'Variance %',
    'Result Comparison',
    'Weeks Excluded by Comparable Coverage',
    'Trading Expectation',
    'Manual Coverage Adjustment',
    'Final CCM Outcome',
    'Outcome Reason',
    'Weekly Detail'
  ]) {
    assert.match(uiSource, new RegExp(label));
  }
});

test('Phase 2 UI renders both comparison views and no Phase 2 selectors', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /renderL4LResultComparisonTable/);
  assert.match(uiSource, /renderExcludedCoverageWeeks/);
  assert.match(uiSource, /renderL4LWeeklyDetail/);
  assert.match(uiSource, /renderWorkflowProgress/);
  assert.match(uiSource, /Workflow Status/);
  assert.doesNotMatch(uiSource, /data-action="select-l4l-store"/);
  assert.doesNotMatch(uiSource, /data-action="select-l4l-metric"/);
  assert.doesNotMatch(uiSource, /data-action="select-l4l-period"/);
});

test('Phase 2 UI has empty dataset and missing-field diagnostics', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /No L4L comparison data is available\. Run the Prepare L4L Comparison Facts Workflow first\./);
  assert.match(uiSource, /Missing required L4L comparison fields/);
});

test('redesigned UI renders guided workflow, diagnostics drawer, tooltips, and execution modal', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  for (const marker of [
    'renderCommandHeader',
    'renderScopeBar',
    'renderNextActionStrip',
    'renderWorkflowRail',
    'renderActiveStepWorkspace',
    'renderDiagnosticsDrawer',
    'renderInfoTooltip',
    'renderExecutionModal',
    'data-action="complete-execution-modal"',
    'data-action="toggle-diagnostics"',
    'data-action="close-diagnostics"',
    'role="dialog"',
    'No cancel button is shown while Domo is running the operation.'
  ]) {
    assert.match(uiSource, new RegExp(marker));
  }
});

test('HCI redesign exposes command center, active workspace, result board, and evidence tabs', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const cssSource = readFileSync('src/styles.css', 'utf8');

  for (const marker of [
    'Command Center',
    'Next best action',
    'Scope changed',
    'active-step-workspace',
    'Result Board',
    'comparison-scorecards',
    'Evidence',
    'data-action="set-evidence-tab"',
    'data-action="filter-excluded-side"',
    'data-action="filter-excluded-reason"',
    'data-action="toggle-manual-only"',
    'data-action="toggle-week53-only"',
    'Reason guide',
    'Why was this week excluded?'
  ]) {
    assert.match(uiSource, new RegExp(marker));
  }

  for (const className of [
    '.command-header',
    '.scope-bar',
    '.next-action-strip',
    '.workflow-rail',
    '.active-step-workspace',
    '.result-board',
    '.comparison-scorecards',
    '.evidence-tabs',
    '.reason-guide',
    '.stale-data-banner'
  ]) {
    assert.match(cssSource, new RegExp(className.replace('.', '\\.')));
  }
});

test('HCI redesign improves completion acknowledgement and manual workflow fallback copy', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /Complete and Unlock Workflow/);
  assert.match(uiSource, /Complete and Review Results/);
  assert.match(uiSource, /Automatic trigger is unavailable in this runtime/);
  assert.match(uiSource, /Run Workflow Automatically/);
  assert.match(uiSource, /Workflow could not be started\. No comparison facts were changed/);
});

test('all rendered buttons declare type button to avoid form-submit page reloads in Domo shells', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const buttonsWithoutType = uiSource.match(/<button\b(?![^>]*\btype=)[^>]*>/g) || [];

  assert.deepEqual(buttonsWithoutType, []);
  assert.match(uiSource, /document\.addEventListener\('submit'/);
  assert.match(uiSource, /preventDefault\(\)/);
});

test('redesigned UI uses switch language for Comparable Coverage while preserving both comparison rows', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /role="switch"/);
  assert.match(uiSource, /aria-checked="\$\{state\.l4lComparableCoverageOn \? 'true' : 'false'\}"/);
  assert.match(uiSource, /Comparable Coverage Impact/);
  assert.match(uiSource, /renderL4LResultComparisonTable/);
  assert.match(uiSource, /renderComparisonSummaryRow\('L4L ON'/);
  assert.match(uiSource, /renderComparisonSummaryRow\('L4L OFF'/);
});

test('mask rebuild invalidates previously loaded L4L comparison rows before workflow rerun', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /state\.l4lRows = \[\]/);
  assert.match(uiSource, /Run the Workflow to prepare comparison facts for the rebuilt mask/);
});

test('workflow completion waits for Domo dataset refresh instead of immediately showing stale rows', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const runWorkflowBlock = uiSource.slice(
    uiSource.indexOf('async function runL4LWorkflow'),
    uiSource.indexOf('async function refreshL4LResults')
  );

  assert.doesNotMatch(runWorkflowBlock, /await loadComparisonRows\(/);
  assert.match(runWorkflowBlock, /state\.comparisonRefreshPending = true/);
  assert.match(runWorkflowBlock, /Domo may still be refreshing the output dataset/);
  assert.match(runWorkflowBlock, /Click Refresh Results after the Domo dataset refresh completes/);
});

test('UI state is persisted so Domo iframe refresh does not reset workflow context', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /CCM_UI_STATE_STORAGE_KEY/);
  assert.match(uiSource, /sessionStorage\.setItem/);
  assert.match(uiSource, /sessionStorage\.getItem/);
  assert.match(uiSource, /persistUiState\(state\)/);
  assert.match(uiSource, /loadPersistedUiState\(\)/);
  assert.match(uiSource, /selectedStoreCode: state\.selectedStoreCode/);
  assert.match(uiSource, /comparisonRefreshPending: state\.comparisonRefreshPending/);
});

test('Build Coverage Mask is gated until Comparable Week Review is saved', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /reviewConfirmed/);
  assert.match(uiSource, /Save Overrides to confirm Comparable Week Review/);
  assert.match(uiSource, /state\.reviewConfirmed = true/);
  assert.match(uiSource, /state\.reviewConfirmed = false/);
  assert.match(uiSource, /!state\.reviewConfirmed/);
});

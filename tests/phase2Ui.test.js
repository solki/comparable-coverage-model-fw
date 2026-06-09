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

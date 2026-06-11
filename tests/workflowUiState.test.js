import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExecutionModal,
  getActiveWorkflowStepId,
  getCoverageModeLabel,
  getTooltipCopy,
  getWorkflowSteps
} from '../src/workflowUiState.js';

test('workflow step gating keeps later steps locked until prior completion is acknowledged', () => {
  const initial = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: true,
    hasMaskCompleted: false,
    hasMaskAcknowledged: false,
    hasComparisonRows: false,
    hasWorkflowAcknowledged: false
  });

  assert.equal(initial[0].status, 'ready');
  assert.equal(initial[1].status, 'locked');
  assert.match(initial[1].disabledReason, /Build the selected-scope mask first/);
  assert.equal(initial[2].status, 'locked');
  assert.equal(initial[3].status, 'locked');

  const unacknowledged = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: true,
    hasMaskCompleted: true,
    hasMaskAcknowledged: false,
    hasComparisonRows: false,
    hasWorkflowAcknowledged: false
  });

  assert.equal(unacknowledged[0].status, 'completed_unacknowledged');
  assert.equal(unacknowledged[1].status, 'locked');
  assert.match(unacknowledged[1].disabledReason, /Click Complete/);

  const maskAcknowledged = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: true,
    hasMaskCompleted: true,
    hasMaskAcknowledged: true,
    hasComparisonRows: false,
    hasWorkflowAcknowledged: false
  });

  assert.equal(maskAcknowledged[0].status, 'complete');
  assert.equal(maskAcknowledged[1].status, 'ready');
  assert.equal(maskAcknowledged[2].status, 'locked');
});

test('coverage mask step stays locked until Comparable Week Review is confirmed', () => {
  const unconfirmed = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: false
  });

  assert.equal(unconfirmed[0].status, 'locked');
  assert.match(unconfirmed[0].disabledReason, /Save Overrides/);
  assert.equal(unconfirmed[1].status, 'locked');

  const confirmed = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: true
  });

  assert.equal(confirmed[0].status, 'ready');
});

test('comparison and exclusion steps unlock only after result data is available or acknowledged', () => {
  const steps = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: true,
    hasMaskCompleted: true,
    hasMaskAcknowledged: true,
    hasWorkflowAcknowledged: true,
    hasComparisonRows: true
  });

  assert.equal(steps[1].status, 'complete');
  assert.equal(steps[2].status, 'complete');
  assert.equal(steps[3].status, 'complete');
});

test('active workflow step does not pin completed runs to exclusions', () => {
  const steps = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: true,
    hasMaskCompleted: true,
    hasMaskAcknowledged: true,
    hasWorkflowAcknowledged: true,
    hasComparisonRows: true
  });

  assert.equal(getActiveWorkflowStepId(steps), 'results');
  assert.equal(getActiveWorkflowStepId(steps, 'mask'), 'mask');
  assert.equal(getActiveWorkflowStepId(steps, 'exclusions'), 'exclusions');
});

test('active workflow step ignores locked preferred steps and keeps the next valid action linear', () => {
  const steps = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: true,
    hasMaskCompleted: true,
    hasMaskAcknowledged: true,
    hasWorkflowAcknowledged: false,
    hasComparisonRows: false
  });

  assert.equal(getActiveWorkflowStepId(steps, 'results'), 'workflow');
});

test('existing comparison rows do not mark workflow step complete after a new mask is acknowledged', () => {
  const steps = getWorkflowSteps({
    hasSourceProfile: true,
    hasSelectedScope: true,
    hasReviewConfirmed: true,
    hasMaskCompleted: true,
    hasMaskAcknowledged: true,
    hasWorkflowAcknowledged: false,
    hasComparisonRows: true
  });

  assert.equal(steps[0].status, 'complete');
  assert.equal(steps[1].status, 'ready');
});

test('execution modal blocks interaction and has no cancel button while running', () => {
  const modal = buildExecutionModal({
    type: 'workflow',
    status: 'running',
    currentStage: 1,
    message: 'Workflow is running.'
  });

  assert.equal(modal.blocksPage, true);
  assert.equal(modal.showCancelButton, false);
  assert.equal(modal.showCompleteButton, false);
  assert.equal(modal.stages[1].state, 'current');
  assert.match(modal.progressLabel, /Approximate progress/);
});

test('execution modal shows Complete only after success', () => {
  const modal = buildExecutionModal({
    type: 'mask',
    status: 'success',
    currentStage: 6,
    resultSummary: '132 mask records written.'
  });

  assert.equal(modal.blocksPage, true);
  assert.equal(modal.showCancelButton, false);
  assert.equal(modal.showCompleteButton, true);
  assert.match(modal.resultSummary, /132 mask records written/);
});

test('tooltip copy includes key CCM and L4L terms', () => {
  for (const key of [
    'comparableCoverage',
    'l4lOn',
    'l4lOff',
    'tradingExpectation',
    'manualCoverageAdjustment',
    'finalCcmOutcome',
    'excludedWeeks',
    'variancePercent',
    'priorZero',
    'week53Excluded'
  ]) {
    assert.ok(getTooltipCopy(key).length > 20, `${key} should have useful tooltip copy`);
  }
});

test('coverage mode labels preserve L4L ON/OFF logic', () => {
  assert.equal(getCoverageModeLabel(true).title, 'L4L ON');
  assert.match(getCoverageModeLabel(true).description, /mask_include_flag = Y/);
  assert.equal(getCoverageModeLabel(false).title, 'L4L OFF');
  assert.match(getCoverageModeLabel(false).description, /all rows/);
});

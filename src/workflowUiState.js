export const WORKFLOW_STEP_IDS = {
  mask: 'mask',
  workflow: 'workflow',
  results: 'results',
  exclusions: 'exclusions'
};

export const TOOLTIP_COPY = {
  comparableCoverage: 'Comparable Coverage keeps only weeks that are fair to compare for the selected Store, Metric, and Period Lens.',
  l4lOn: 'Uses only rows where mask_include_flag = Y. This is the governed like-for-like view.',
  l4lOff: 'Uses all rows in the comparison window. This is the inclusive view before Comparable Coverage filtering.',
  tradingExpectation: 'Shows whether the store was expected to trade in this fiscal week. Operational closure or lifecycle rules can exclude a week.',
  manualCoverageAdjustment: 'Shows whether a user-approved override changed the week-level coverage decision.',
  finalCcmOutcome: 'The final include or exclude decision after system rules and manual coverage adjustments.',
  excludedWeeks: 'These weeks are included when Comparable Coverage is OFF, but removed when L4L is ON.',
  variancePercent: 'Calculated as Current minus Prior, divided by the absolute Prior value. If Prior is zero, percentage variance is not shown.',
  priorZero: 'Prior is zero and Current is non-zero, so percentage variance is not meaningful.',
  bothZero: 'Current and Prior are both zero, so percentage variance is not meaningful.',
  week53Excluded: 'Week 53 is excluded from comparable-slot equivalence logic. It is a subtype of the general Slot Completeness Rule: any comparable slot not present on all required comparison sides is excluded from LFL ON.',
  slotCompleteness: 'Slot Completeness Rule: LFL ON includes only comparable slots that exist on all required comparison sides (current and prior). Unmatched slots remain visible in LFL OFF but are excluded from LFL ON with UNPAIRED_PERIOD_WEEK. Applies to Week 53, unequal month/quarter week counts, and any future period with mismatched sides.',
  diagnostics: 'Technical details for troubleshooting dataset aliases, AppDB, Workflow execution, and API errors.',
  workflowAlias: 'The app starts the Workflow through the manifest alias, not the Workflow UUID. The Domo card must be mapped to the Workflow.',
  fiveLayerArchitecture: 'The CCM system follows a five-layer architecture: (1) Calendar — defines fiscal periods and comparable slots, (2) Trading Expectation — store expected-to-trade status, (3) Metric Coverage — data existence and quality, (4) Comparable Coverage — final LFL inclusion after rules and overrides, (5) Presentation — dashboard consumption with LFL ON/OFF.'
};

export function getWorkflowSteps({
  hasSourceProfile = false,
  hasSelectedScope = false,
  hasReviewConfirmed = false,
  hasMaskCompleted = false,
  hasMaskAcknowledged = false,
  hasComparisonRows = false,
  hasWorkflowAcknowledged = false,
  hasMaskError = false,
  hasWorkflowError = false,
  hasComparisonError = false
} = {}) {
  const maskReady = hasSourceProfile && hasSelectedScope && hasReviewConfirmed;
  const maskStatus = getMaskStatus({ maskReady, hasMaskCompleted, hasMaskAcknowledged, hasMaskError });
  const workflowStatus = getWorkflowStatus({
    hasMaskCompleted,
    hasMaskAcknowledged,
    hasWorkflowAcknowledged,
    hasWorkflowError
  });
  const resultsStatus = getResultsStatus({
    hasMaskAcknowledged,
    hasComparisonRows,
    hasWorkflowAcknowledged,
    hasComparisonError
  });
  const exclusionsStatus = hasComparisonRows ? 'complete' : 'locked';

  return [
    {
      id: WORKFLOW_STEP_IDS.mask,
      number: 1,
      title: 'Build Coverage Mask',
      layer: 'Comparability Truth',
      status: maskStatus,
      disabledReason: maskReady ? '' : maskDisabledReason({ hasSourceProfile, hasSelectedScope, hasReviewConfirmed }),
      help: TOOLTIP_COPY.comparableCoverage
    },
    {
      id: WORKFLOW_STEP_IDS.workflow,
      number: 2,
      title: 'Prepare Comparison Facts',
      layer: 'Presentation',
      status: workflowStatus,
      disabledReason: workflowDisabledReason({ hasMaskCompleted, hasMaskAcknowledged }),
      help: TOOLTIP_COPY.workflowAlias
    },
    {
      id: WORKFLOW_STEP_IDS.results,
      number: 3,
      title: 'Review L4L Results',
      layer: 'Presentation',
      status: resultsStatus,
      disabledReason: hasWorkflowAcknowledged || hasComparisonRows
        ? ''
        : 'Prepare comparison facts first, then refresh the result dataset.',
      help: 'Review L4L ON and L4L OFF values side by side.'
    },
    {
      id: WORKFLOW_STEP_IDS.exclusions,
      number: 4,
      title: 'Explain Excluded Weeks',
      layer: 'Comparability Truth',
      status: exclusionsStatus,
      disabledReason: hasComparisonRows ? '' : 'Load L4L comparison results first. Excluded weeks are derived from the result dataset.',
      help: TOOLTIP_COPY.excludedWeeks
    }
  ];
}

export function getActiveWorkflowStepId(steps = [], preferredStepId = '') {
  const preferredStep = steps.find((step) => step.id === preferredStepId);
  if (preferredStep && preferredStep.status !== 'locked') return preferredStep.id;

  const actionableStep = steps.find((step) => ['ready', 'error', 'completed_unacknowledged'].includes(step.status));
  if (actionableStep) return actionableStep.id;

  const allComplete = steps.length > 0 && steps.every((step) => step.status === 'complete');
  if (allComplete && steps.some((step) => step.id === WORKFLOW_STEP_IDS.results)) {
    return WORKFLOW_STEP_IDS.results;
  }

  return (steps.find((step) => step.status === 'locked') || steps[steps.length - 1])?.id || WORKFLOW_STEP_IDS.mask;
}

function maskDisabledReason({ hasSourceProfile, hasSelectedScope, hasReviewConfirmed }) {
  if (!hasSourceProfile || !hasSelectedScope) return 'Load source data and select Store, Metric, and Period Lens first.';
  if (!hasReviewConfirmed) return 'Save Overrides to confirm Comparable Week Review before building the selected-scope mask.';
  return '';
}

export function buildExecutionModal({
  type = 'mask',
  status = 'running',
  currentStage = 0,
  title = '',
  message = '',
  resultSummary = '',
  errorMessage = ''
} = {}) {
  const stages = executionStages(type).map((label, index) => ({
    label,
    state: stageState({ index, currentStage, status })
  }));

  return {
    type,
    title: title || executionTitle(type, status),
    explanation: executionExplanation(type),
    progressLabel: type === 'workflow' ? 'Approximate progress based on available Domo Workflow status.' : 'Execution progress',
    stages,
    currentStatusText: message || defaultExecutionMessage(status),
    resultSummary,
    errorMessage,
    blocksPage: true,
    showCancelButton: false,
    showCompleteButton: status === 'success',
    showCloseButton: status === 'error',
    percent: executionPercent({ stages, currentStage, status })
  };
}

export function executionStages(type) {
  if (type === 'workflow') {
    return [
      'Checking Workflow mapping support',
      'Starting prepareL4LFacts',
      'Waiting for Domo Workflow execution',
      'Refreshing comparison dataset',
      'Loading updated L4L results',
      'Completed'
    ];
  }

  if (type === 'refresh') {
    return [
      'Querying l4lComparisonFact alias',
      'Validating comparison fields',
      'Calculating L4L ON/OFF summaries',
      'Completed'
    ];
  }

  return [
    'Validating selected scope',
    'Generating comparable week mask',
    'Clearing selected-scope mask output',
    'Writing selected-scope mask records',
    'Validating mask output',
    'Completed'
  ];
}

export function getTooltipCopy(key) {
  return TOOLTIP_COPY[key] || '';
}

export function getCoverageModeLabel(comparableCoverageOn) {
  if (comparableCoverageOn) {
    return {
      title: 'L4L ON',
      description: 'Comparable Coverage ON: filters to rows where mask_include_flag = Y.'
    };
  }

  return {
    title: 'L4L OFF',
    description: 'Comparable Coverage OFF: uses all rows in the comparison window.'
  };
}

function getMaskStatus({ maskReady, hasMaskCompleted, hasMaskAcknowledged, hasMaskError }) {
  if (hasMaskError) return 'error';
  if (hasMaskCompleted && hasMaskAcknowledged) return 'complete';
  if (hasMaskCompleted) return 'completed_unacknowledged';
  return maskReady ? 'ready' : 'locked';
}

function getWorkflowStatus({
  hasMaskCompleted,
  hasMaskAcknowledged,
  hasWorkflowAcknowledged,
  hasWorkflowError
}) {
  if (hasWorkflowError) return 'error';
  if (hasWorkflowAcknowledged) return 'complete';
  if (hasMaskCompleted && hasMaskAcknowledged) return 'ready';
  return 'locked';
}

function getResultsStatus({
  hasComparisonRows,
  hasWorkflowAcknowledged,
  hasComparisonError
}) {
  if (hasComparisonError) return 'error';
  if (hasComparisonRows) return 'complete';
  if (hasWorkflowAcknowledged) return 'ready';
  return 'locked';
}

function workflowDisabledReason({ hasMaskCompleted, hasMaskAcknowledged }) {
  if (!hasMaskCompleted) return 'Build the selected-scope mask first. The Workflow uses that output to prepare comparison facts.';
  if (!hasMaskAcknowledged) return 'Click Complete on the mask rebuild modal before preparing comparison facts.';
  return '';
}

function stageState({ index, currentStage, status }) {
  if (status === 'success') return 'done';
  if (status === 'error') {
    if (index < currentStage) return 'done';
    if (index === currentStage) return 'error';
    return 'pending';
  }
  if (index < currentStage) return 'done';
  if (index === currentStage) return 'current';
  return 'pending';
}

function executionTitle(type, status) {
  if (status === 'success' && type === 'mask') return 'Mask Built';
  if (status === 'success' && type === 'workflow') return 'Comparison Facts Prepared';
  if (status === 'success' && type === 'refresh') return 'Results Refreshed';
  if (type === 'workflow') return 'Prepare L4L Comparison Facts';
  if (type === 'refresh') return 'Refresh L4L Results';
  return 'Build Coverage Mask';
}

function executionExplanation(type) {
  if (type === 'workflow') {
    return 'The app is triggering the mapped Domo Workflow and polling the available instance status. Internal Workflow stages are approximate unless Domo exposes them.';
  }
  if (type === 'refresh') {
    return 'The app is reading the mapped comparison dataset alias and recalculating frontend summaries without mutating Domo objects.';
  }
  return 'The app is rebuilding only the selected-scope mask output. Source datasets are read-only and are not modified.';
}

function defaultExecutionMessage(status) {
  if (status === 'success') return 'Operation completed.';
  if (status === 'error') return 'Operation failed. Review the error before continuing.';
  return 'Operation is running.';
}

function executionPercent({ stages, currentStage, status }) {
  if (status === 'success' || status === 'error') return 100;
  const total = Math.max(1, stages.length - 1);
  return Math.max(5, Math.min(95, Math.round((currentStage / total) * 100)));
}

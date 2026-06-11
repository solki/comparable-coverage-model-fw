import { LAYER_STAGE_IDS, LAYER_CONFIG } from './constants.js';

export { LAYER_STAGE_IDS, LAYER_CONFIG };

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

export function getLayerConfig(id) {
  return LAYER_CONFIG.find((layer) => layer.id === id) || LAYER_CONFIG[0];
}

/**
 * Returns the 5 layer stages with their current status based on app state.
 */
export function getLayerStages({
  hasSourceProfile = false,
  hasSelectedScope = false,
  hasReviewConfirmed = false,
  hasMaskCompleted = false,
  hasMaskAcknowledged = false,
  hasComparisonRows = false,
  hasWorkflowAcknowledged = false,
  hasMaskError = false,
  hasWorkflowError = false,
  hasComparisonError = false,
  stageConfirmed = {}
} = {}) {
  const sc = stageConfirmed || {};

  // Linear gating: each stage unlocks only when the previous stage is confirmed.
  const calendarReady = true; // Stage 1 is always accessible
  const tradingReady = Boolean(sc.calendar);
  const metricReady = Boolean(sc.trading);
  const ccmReady = Boolean(sc.metricCoverage) && hasSourceProfile && hasSelectedScope;
  const presentationReady = Boolean(sc.comparableCoverage) && hasMaskAcknowledged;

  return [
    {
      ...LAYER_CONFIG[0],
      status: getStageStatus(sc.calendar, calendarReady),
      disabledReason: 'The first stage. Confirm to proceed to Trading Expectation.'
    },
    {
      ...LAYER_CONFIG[1],
      status: getStageStatus(sc.trading, tradingReady),
      disabledReason: tradingReady ? '' : 'Confirm Calendar Layer (Stage 1) first.'
    },
    {
      ...LAYER_CONFIG[2],
      status: getStageStatus(sc.metricCoverage, metricReady),
      disabledReason: metricReady ? '' : 'Confirm Trading Expectation (Stage 2) first.'
    },
    {
      ...LAYER_CONFIG[3],
      status: getStageStatus(sc.comparableCoverage, ccmReady),
      disabledReason: ccmReady
        ? (hasReviewConfirmed ? '' : 'Save Overrides to confirm Comparable Week Review.')
        : 'Confirm Metric Coverage (Stage 3) first.'
    },
    {
      ...LAYER_CONFIG[4],
      status: getStageStatus(sc.presentation, presentationReady),
      disabledReason: presentationReady
        ? (hasComparisonRows ? '' : 'Refresh L4L results to complete.')
        : 'Complete the mask build (Stage 4) first.'
    }
  ];
}

function getStageStatus(confirmed, isReady) {
  if (confirmed) return 'complete';
  if (isReady) return 'ready';
  return 'locked';
}

/**
 * Returns the currently active layer stage ID.
 */
export function getActiveLayerStageId(stages = [], preferredStageId = '') {
  // Allow reviewing completed stages.
  const preferred = stages.find((stage) => stage.id === preferredStageId);
  if (preferred && preferred.status === 'complete') return preferred.id;

  // Allow navigating to the current ready stage.
  if (preferred && preferred.status === 'ready') return preferred.id;

  // Default: first non-complete stage (the next step in the linear flow).
  const firstIncomplete = stages.find((s) => s.status !== 'complete');
  if (firstIncomplete) return firstIncomplete.id;

  return stages[stages.length - 1]?.id || LAYER_STAGE_IDS.calendar;
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
    return ['Querying l4lComparisonFact alias', 'Validating comparison fields', 'Calculating L4L ON/OFF summaries', 'Completed'];
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
    return { title: 'L4L ON', description: 'Comparable Coverage ON: filters to rows where mask_include_flag = Y.' };
  }
  return { title: 'L4L OFF', description: 'Comparable Coverage OFF: uses all rows in the comparison window.' };
}

// ── Internal helpers ──────────────────────────────────────────────

function getCcmStatus({ ccmMaskReady, hasMaskCompleted, hasMaskAcknowledged, hasMaskError }) {
  if (hasMaskError) return 'error';
  if (hasMaskCompleted && hasMaskAcknowledged) return 'complete';
  if (hasMaskCompleted) return 'completed_unacknowledged';
  return ccmMaskReady ? 'ready' : 'locked';
}

function getPresentationStatus({ hasMaskAcknowledged, hasComparisonRows, hasWorkflowAcknowledged, hasComparisonError }) {
  if (hasComparisonError) return 'error';
  if (hasComparisonRows) return 'complete';
  if (hasWorkflowAcknowledged || hasMaskAcknowledged) return 'ready';
  return 'locked';
}

function stageState({ index, currentStage, status }) {
  if (status === 'success') return 'done';
  if (status === 'error') {
    return index < currentStage ? 'done' : index === currentStage ? 'error' : 'pending';
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

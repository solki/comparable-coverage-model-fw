import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExecutionModal,
  getActiveLayerStageId,
  getCoverageModeLabel,
  getLayerStages,
  getTooltipCopy,
  LAYER_STAGE_IDS
} from '../src/workflowUiState.js';

test('layer stages: all 5 stages are defined in order', () => {
  const stages = getLayerStages({ hasSourceProfile: true, hasSelectedScope: true });
  assert.equal(stages.length, 5);
  assert.deepEqual(stages.map((s) => s.id), [
    LAYER_STAGE_IDS.calendar, LAYER_STAGE_IDS.trading, LAYER_STAGE_IDS.metricCoverage,
    LAYER_STAGE_IDS.comparableCoverage, LAYER_STAGE_IDS.presentation
  ]);
});

test('layer stages: Stage 1 (calendar) is always ready', () => {
  const stages = getLayerStages({});
  assert.equal(stages[0].status, 'ready');  // calendar always ready
});

test('layer stages: Stage 1 transitions to complete when confirmed', () => {
  const stages = getLayerStages({ stageConfirmed: { calendar: true } });
  assert.equal(stages[0].status, 'complete');
});

test('layer stages: Stage 2 unlocks when calendar confirmed', () => {
  const noConfirm = getLayerStages({ stageConfirmed: {} });
  assert.equal(noConfirm[1].status, 'locked');

  const withConfirm = getLayerStages({ stageConfirmed: { calendar: true } });
  assert.equal(withConfirm[1].status, 'ready');
});

test('layer stages: Stage 4 requires scope + review when metric confirmed', () => {
  const noScope = getLayerStages({ stageConfirmed: { calendar: true, trading: true, metricCoverage: true }, hasSourceProfile: true });
  assert.equal(noScope[3].status, 'locked');  // no scope selected

  const withScope = getLayerStages({ stageConfirmed: { calendar: true, trading: true, metricCoverage: true }, hasSourceProfile: true, hasSelectedScope: true });
  assert.equal(withScope[3].status, 'ready');
});

test('active layer stage defaults to first non-complete stage', () => {
  const stages = getLayerStages({});
  const activeId = getActiveLayerStageId(stages, '');
  assert.equal(activeId, LAYER_STAGE_IDS.calendar);
});

test('active layer stage allows reviewing completed stages', () => {
  const stages = getLayerStages({ stageConfirmed: { calendar: true } });
  const activeId = getActiveLayerStageId(stages, LAYER_STAGE_IDS.calendar);
  assert.equal(activeId, LAYER_STAGE_IDS.calendar);  // can review completed
});

test('active layer stage does not allow jumping to locked stages', () => {
  const stages = getLayerStages({});
  const activeId = getActiveLayerStageId(stages, LAYER_STAGE_IDS.comparableCoverage);
  assert.equal(activeId, LAYER_STAGE_IDS.calendar);  // falls back to first non-complete
});

test('execution modal blocks interaction and shows no cancel while running', () => {
  const modal = buildExecutionModal({ type: 'mask', status: 'running', currentStage: 2 });
  assert.equal(modal.blocksPage, true);
  assert.equal(modal.showCancelButton, false);
  assert.equal(modal.showCompleteButton, false);
});

test('execution modal shows Complete only after success', () => {
  const modal = buildExecutionModal({ type: 'mask', status: 'success', currentStage: 5, resultSummary: '50 records written.' });
  assert.equal(modal.showCompleteButton, true);
  assert.ok(modal.resultSummary.includes('50'));
});

test('tooltip copy includes key CCM and L4L terms', () => {
  for (const key of ['comparableCoverage', 'l4lOn', 'l4lOff', 'tradingExpectation',
    'manualCoverageAdjustment', 'finalCcmOutcome', 'excludedWeeks',
    'variancePercent', 'priorZero', 'week53Excluded', 'slotCompleteness', 'fiveLayerArchitecture']) {
    const copy = getTooltipCopy(key);
    assert.ok(typeof copy === 'string' && copy.length > 20, `Tooltip "${key}" should have meaningful content`);
  }
});

test('coverage mode labels preserve L4L ON/OFF logic', () => {
  const on = getCoverageModeLabel(true);
  assert.equal(on.title, 'L4L ON');
  assert.match(on.description, /mask_include_flag/);
  const off = getCoverageModeLabel(false);
  assert.equal(off.title, 'L4L OFF');
  assert.match(off.description, /all rows/);
});

test('re-confirming Stage 1 resets downstream confirmed flags', () => {
  // After full flow through Stage 3, all are confirmed
  const afterFull = getLayerStages({
    hasSourceProfile: true, hasSelectedScope: true, hasReviewConfirmed: true,
    stageConfirmed: { calendar: true, trading: true, metricCoverage: true, comparableCoverage: false, presentation: false }
  });
  assert.equal(afterFull[0].status, 'complete'); // calendar
  assert.equal(afterFull[1].status, 'complete'); // trading
  assert.equal(afterFull[2].status, 'complete'); // metric

  // After re-confirming Stage 1: downstream confirmed flags reset.
  // Calendar still true → trading is ready (not locked).
  // trading/metricCoverage reset to false → metric/ccm locked.
  const afterReset = getLayerStages({
    hasSourceProfile: true, hasSelectedScope: true,
    stageConfirmed: { calendar: true, trading: false, metricCoverage: false, comparableCoverage: false, presentation: false }
  });
  assert.equal(afterReset[0].status, 'complete'); // calendar stays confirmed
  assert.equal(afterReset[1].status, 'ready');    // trading: calendar.isConfirmed=true → ready (needs re-confirm)
  assert.equal(afterReset[2].status, 'locked');   // metric: trading.isConfirmed=false → locked
  assert.equal(afterReset[3].status, 'locked');   // ccm: metricCoverage.isConfirmed=false → locked
  assert.equal(afterReset[4].status, 'locked');   // presentation: locked
});

test('stage status transitions: locked → ready → complete', () => {
  // Initial: nothing confirmed
  const initial = getLayerStages({ stageConfirmed: {} });
  assert.equal(initial[0].status, 'ready');    // calendar always ready
  assert.equal(initial[1].status, 'locked');   // trading locked
  assert.equal(initial[2].status, 'locked');   // metric locked

  // After confirming calendar
  const afterCal = getLayerStages({ stageConfirmed: { calendar: true } });
  assert.equal(afterCal[0].status, 'complete'); // done
  assert.equal(afterCal[1].status, 'ready');    // unlocked

  // After confirming all except presentation
  const allButPres = getLayerStages({
    hasSourceProfile: true, hasSelectedScope: true, hasReviewConfirmed: true,
    hasMaskAcknowledged: false,
    stageConfirmed: { calendar: true, trading: true, metricCoverage: true, comparableCoverage: false }
  });
  assert.equal(allButPres[3].status, 'ready');     // ccm ready
  assert.equal(allButPres[4].status, 'locked');    // presentation locked (no mask acknowledged)
});

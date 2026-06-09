import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PREPARE_L4L_WORKFLOW,
  getWorkflowTriggerSupport,
  runPrepareL4LWorkflow
} from '../src/workflowService.js';

test('workflow service exposes existing workflow details for manual run guidance', () => {
  assert.equal(PREPARE_L4L_WORKFLOW.name, 'Prepare L4L Comparison Facts');
  assert.equal(PREPARE_L4L_WORKFLOW.alias, 'prepareL4LFacts');
  assert.equal(PREPARE_L4L_WORKFLOW.version, '1.0.0');
  assert.equal(PREPARE_L4L_WORKFLOW.outputDatasetName, 'DomoDev | Phase 2 Metric | L4L Weekly Comparison Fact');
  assert.deepEqual(PREPARE_L4L_WORKFLOW.inputParameters, []);
});

test('workflow trigger is unsupported outside Domo runtime', () => {
  const support = getWorkflowTriggerSupport({ runtimeAvailable: false, domoClient: null });

  assert.equal(support.supported, false);
  assert.match(support.reason, /Domo runtime/);
  assert.match(support.manualInstruction, /Run the Workflow manually in Domo, then click Refresh Results/);
});

test('workflow trigger is supported when domo.workflow is available', () => {
  const support = getWorkflowTriggerSupport({
    runtimeAvailable: true,
    domoClient: {
      workflow: {
        start() {},
        getInstance() {}
      }
    }
  });

  assert.equal(support.supported, true);
  assert.match(support.reason, /prepareL4LFacts/);
  assert.match(support.reason, /no start-node input parameters/);
});

test('workflow runner does not fake execution outside Domo runtime', async () => {
  const result = await runPrepareL4LWorkflow({ runtimeAvailable: false, domoClient: null });

  assert.equal(result.triggered, false);
  assert.equal(result.status, 'unsupported');
  assert.match(result.message, /Run the Workflow manually/);
});

test('workflow runner starts prepareL4LFacts with empty payload and polls to completion', async () => {
  const calls = [];
  const progressEvents = [];
  const domoClient = {
    workflow: {
      start(alias, payload) {
        calls.push(['start', alias, payload]);
        return Promise.resolve({ id: 'instance-1', status: 'IN_PROGRESS' });
      },
      getInstance(alias, instanceId) {
        calls.push(['getInstance', alias, instanceId]);
        return Promise.resolve({ id: instanceId, status: calls.length > 2 ? 'COMPLETED' : 'IN_PROGRESS' });
      }
    }
  };

  const result = await runPrepareL4LWorkflow({
    domoClient,
    runtimeAvailable: true,
    pollIntervalMs: 0,
    wait: () => Promise.resolve(),
    onProgress: (progress) => progressEvents.push(progress)
  });

  assert.equal(result.triggered, true);
  assert.equal(result.status, 'COMPLETED');
  assert.deepEqual(calls[0], ['start', 'prepareL4LFacts', {}]);
  assert.deepEqual(calls[1], ['getInstance', 'prepareL4LFacts', 'instance-1']);
  assert.equal(progressEvents[0].phase, 'started');
  assert.equal(progressEvents.at(-1).phase, 'completed');
  assert.equal(progressEvents.at(-1).percent, 100);
});

test('workflow runner reports start failures with Domo error details', async () => {
  const progressEvents = [];
  const domoClient = {
    workflow: {
      start() {
        const error = new Error('HTTP error 500: Internal Server Error');
        error.status = 500;
        error.statusText = 'Internal Server Error';
        error.body = JSON.stringify({
          status: 500,
          statusReason: 'Internal Server Error',
          message: 'Workflow service failed to start model.',
          toe: 'ABC-123'
        });
        return Promise.reject(error);
      },
      getInstance() {
        throw new Error('should not poll when start fails');
      }
    }
  };

  const result = await runPrepareL4LWorkflow({
    domoClient,
    runtimeAvailable: true,
    onProgress: (progress) => progressEvents.push(progress)
  });

  assert.equal(result.triggered, false);
  assert.equal(result.status, 'START_FAILED');
  assert.match(result.message, /prepareL4LFacts/);
  assert.match(result.message, /HTTP 500/);
  assert.match(result.message, /ABC-123/);
  assert.equal(progressEvents.at(-1).status, 'START_FAILED');
  assert.equal(progressEvents.at(-1).percent, 100);
});

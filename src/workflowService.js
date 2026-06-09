import { getDomoClient, isDomoRuntime } from './domoClient.js';

export const PREPARE_L4L_WORKFLOW = {
  name: 'Prepare L4L Comparison Facts',
  alias: 'prepareL4LFacts',
  version: '1.0.0',
  outputDatasetName: 'DomoDev | Phase 2 Metric | L4L Weekly Comparison Fact',
  inputParameters: [],
  manualInstruction: 'Run the Workflow manually in Domo, then click Refresh Results.'
};

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELED', 'FAILED']);

export function getWorkflowTriggerSupport({
  domoClient = getDomoClient(),
  runtimeAvailable = isDomoRuntime()
} = {}) {
  const workflowClient = domoClient?.workflow;
  const hasWorkflowClient = Boolean(
    workflowClient
      && typeof workflowClient.start === 'function'
      && typeof workflowClient.getInstance === 'function'
  );

  if (!runtimeAvailable || !hasWorkflowClient) {
    return {
      supported: false,
      reason: 'Workflow trigger is available only inside Domo runtime when domo.workflow.start and domo.workflow.getInstance are available.',
      manualInstruction: PREPARE_L4L_WORKFLOW.manualInstruction
    };
  }

  return {
    supported: true,
    reason: 'Workflow trigger uses manifest alias prepareL4LFacts with no start-node input parameters.',
    manualInstruction: PREPARE_L4L_WORKFLOW.manualInstruction
  };
}

export async function runPrepareL4LWorkflow({
  domoClient = getDomoClient(),
  runtimeAvailable = isDomoRuntime(),
  pollIntervalMs = 2000,
  maxPollAttempts = 60,
  wait = delay,
  onProgress = () => {}
} = {}) {
  const support = getWorkflowTriggerSupport({ domoClient, runtimeAvailable });
  if (!support.supported) {
    return {
      triggered: false,
      status: 'unsupported',
      message: support.manualInstruction,
      reason: support.reason
    };
  }

  let instance;
  try {
    instance = await domoClient.workflow.start(PREPARE_L4L_WORKFLOW.alias, {});
  } catch (error) {
    const message = workflowStartErrorMessage(error);
    onProgress({
      phase: 'failed',
      status: 'START_FAILED',
      attempt: 0,
      maxPollAttempts,
      percent: 100,
      errorMessage: message
    });

    return {
      triggered: false,
      status: 'START_FAILED',
      message,
      error
    };
  }

  const instanceId = instance?.id;
  onProgress({
    phase: 'started',
    status: normalizeStatus(instance?.status) || 'STARTED',
    instanceId,
    attempt: 0,
    maxPollAttempts,
    percent: 5
  });

  if (!instanceId) {
    return {
      triggered: true,
      status: 'STARTED',
      instance,
      message: 'Workflow started, but no instance id was returned for status polling.'
    };
  }

  let current = instance;
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    current = await domoClient.workflow.getInstance(PREPARE_L4L_WORKFLOW.alias, instanceId);
    const status = normalizeStatus(current?.status);
    const percent = progressPercent(attempt + 1, maxPollAttempts, status);
    onProgress({
      phase: TERMINAL_STATUSES.has(status) ? 'completed' : 'polling',
      status: status || 'IN_PROGRESS',
      instanceId,
      attempt: attempt + 1,
      maxPollAttempts,
      percent
    });

    if (TERMINAL_STATUSES.has(status)) {
      return {
        triggered: true,
        status,
        instance: current,
        message: workflowStatusMessage(status)
      };
    }

    if (attempt < maxPollAttempts - 1) {
      await wait(pollIntervalMs);
    }
  }

  return {
    triggered: true,
    status: normalizeStatus(current?.status) || 'IN_PROGRESS',
    instance: current,
    message: 'Workflow is still running. Click Refresh Results after it completes.'
  };
}

function progressPercent(attempt, maxPollAttempts, status) {
  if (TERMINAL_STATUSES.has(status)) return 100;
  const safeMax = Math.max(1, maxPollAttempts);
  return Math.min(95, Math.max(10, Math.round((attempt / safeMax) * 90)));
}

function workflowStatusMessage(status) {
  if (status === 'COMPLETED') return 'Workflow completed. Domo may still be refreshing the output dataset.';
  if (status === 'FAILED') return 'Workflow failed. Check the Workflow run details in Domo.';
  if (status === 'CANCELED') return 'Workflow was canceled. Check the Workflow run details in Domo.';
  return 'Workflow status is unknown.';
}

function workflowStartErrorMessage(error) {
  const details = getDomoErrorDetails(error);
  const prefix = `Workflow start failed for alias ${PREPARE_L4L_WORKFLOW.alias}.`;
  const checks = 'Check that the published app has workflowMapping alias prepareL4LFacts, the Workflow is enabled/published, the current user can execute it, and the Workflow can be started manually in Domo.';

  if (!details) return `${prefix} ${checks}`;

  const parts = [];
  if (details.status) parts.push(`HTTP ${details.status}`);
  if (details.statusReason) parts.push(details.statusReason);
  if (details.message) parts.push(details.message);
  if (details.toe) parts.push(`toe ${details.toe}`);

  return `${prefix} ${parts.join(': ')}. ${checks}`;
}

function getDomoErrorDetails(error) {
  if (!error) return null;
  const body = parseErrorBody(error.body);
  return {
    status: error.status || body?.status || '',
    statusReason: error.statusText || error.statusReason || body?.statusReason || '',
    message: body?.message || error.message || '',
    toe: body?.toe || ''
  };
}

function parseErrorBody(body) {
  if (!body) return null;
  if (typeof body === 'object') return body;
  if (typeof body !== 'string') return null;
  try {
    return JSON.parse(body);
  } catch (_) {
    return { message: body };
  }
}

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

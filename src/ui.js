import { COLLECTIONS, FLAGS, SOURCE_DATASET_ALIAS } from './constants.js';
import { generateMaskRows } from './maskGenerator.js';
import { createRunId, buildRunRecord, writeMaskRun } from './maskWriteService.js';
import { derivePeriodDefinitions, validatePeriods } from './periodDefinitionService.js';
import { loadManualOverridesForScope, saveManualOverrides } from './manualOverrideService.js';
import { profileSource } from './sourceDataService.js';
import { buildValidationSummary } from './validation.js';
import { getRuntimeLabel } from './domoClient.js';
import { getPeriodPage } from './periodTable.js';
import { L4L_COMPARISON_ALIAS, loadComparisonRows } from './comparisonDataService.js';
import {
  calculateComparisonSummary,
  formatNumber,
  formatPercentChange,
  formatSignedNumber,
  getExcludedWeeks,
  getRowsForCoverageMode,
  inferComparisonContext
} from './l4lComparisonCalculator.js';
import {
  PREPARE_L4L_WORKFLOW,
  getWorkflowTriggerSupport,
  runPrepareL4LWorkflow
} from './workflowService.js';
import {
  buildExecutionModal,
  getActiveLayerStageId,
  getCoverageModeLabel,
  getLayerConfig,
  getLayerStages,
  getTooltipCopy,
  LAYER_STAGE_IDS
} from './workflowUiState.js';
import {
  computeGlobalDatasetOverview,
  computeSelectedScopeSummary,
  getSourceFactForScope
} from './scopeSummary.js';
import { displayText, helperText, labels } from './terminology.js';

const CCM_UI_STATE_STORAGE_KEY = 'forty_winks_ccm_ui_state_v1';
const ALL_STORES_VALUE = '__ALL_STORES__';
const ALL_METRICS_VALUE = '__ALL_METRICS__';

export function createApp(root) {
  const persistedUiState = loadPersistedUiState();
  const state = {
    loading: false,
    status: persistedUiState.status || 'Ready',
    error: '',
    sourceRows: [],
    sourceMode: 'unknown',
    sourceProfile: null,
    periodRows: [],
    periodPage: persistedUiState.periodPage || 1,
    periodSource: 'none',
    selectedStoreCode: persistedUiState.selectedStoreCode || '',
    selectedMetric: persistedUiState.selectedMetric || '',
    selectedMetrics: Array.isArray(persistedUiState.selectedMetrics) ? persistedUiState.selectedMetrics : [],
    selectedPeriodType: persistedUiState.selectedPeriodType || '',
    manualOverrides: [],
    diagnostics: {
      source: {
        alias: SOURCE_DATASET_ALIAS,
        mapped: false,
        queryable: false,
        message: 'Source has not been queried yet.'
      },
      appDb: {
        reachable: false,
        source: 'none',
        collections: Object.values(COLLECTIONS),
        message: 'AppDB has not been checked yet.'
      }
    },
    lastRun: null,
    pendingWrite: null,
    rebuildProgress: null,
    l4lRows: [],
    l4lSource: 'none',
    l4lValidation: { valid: true, missingFields: [] },
    l4lDiagnostics: {
      alias: L4L_COMPARISON_ALIAS,
      mapped: false,
      queryable: false,
      message: 'L4L comparison data has not been queried yet.'
    },
    l4lComparableCoverageOn: persistedUiState.l4lComparableCoverageOn ?? true,
    l4lMessage: persistedUiState.l4lMessage || 'No L4L comparison data is available. Run the Prepare L4L Comparison Facts Workflow first.',
    workflowProgress: null,
    activeLayerId: persistedUiState.activeLayerId || '',
    stageConfirmed: {
      calendar: Boolean(persistedUiState.stageConfirmed?.calendar),
      trading: Boolean(persistedUiState.stageConfirmed?.trading),
      metricCoverage: Boolean(persistedUiState.stageConfirmed?.metricCoverage),
      comparableCoverage: Boolean(persistedUiState.stageConfirmed?.comparableCoverage),
      presentation: Boolean(persistedUiState.stageConfirmed?.presentation)
    },
    diagnosticsOpen: Boolean(persistedUiState.diagnosticsOpen),
    activeEvidenceTab: persistedUiState.activeEvidenceTab || 'excluded',
    excludedFilters: {
      side: persistedUiState.excludedFilters?.side || 'all',
      reason: persistedUiState.excludedFilters?.reason || 'all',
      manualOnly: Boolean(persistedUiState.excludedFilters?.manualOnly),
      week53Only: Boolean(persistedUiState.excludedFilters?.week53Only)
    },
    reviewConfirmed: Boolean(persistedUiState.reviewConfirmed),
    comparisonRefreshPending: Boolean(persistedUiState.comparisonRefreshPending),
    workflowCompletedAt: persistedUiState.workflowCompletedAt || '',
    scopeDirty: Boolean(persistedUiState.scopeDirty),
    executionModal: null,
    stepAcknowledged: {
      mask: Boolean(persistedUiState.stepAcknowledged?.mask),
      workflow: Boolean(persistedUiState.stepAcknowledged?.workflow)
    },
    stepCompletion: {
      mask: Boolean(persistedUiState.stepCompletion?.mask)
    },
    validationSummary: persistedUiState.validationSummary || null
  };

  installFormSubmitGuard();

  function installFormSubmitGuard() {
    if (typeof document === 'undefined' || root.__ccmSubmitGuardInstalled) return;

    root.__ccmSubmitGuardInstalled = true;
    document.addEventListener('submit', (event) => {
      const target = event.target;
      const submitBelongsToApp = Boolean(
        target
          && typeof target.contains === 'function'
          && (target.contains(root) || root.contains(target))
      );

      if (submitBelongsToApp) {
        event.preventDefault();
      }
    }, true);
  }

  async function init() {
    setLoading('Loading source summary and comparable weeks...');
    try {
      const sourceResult = await profileSource();
      const periods = derivePeriodDefinitions(sourceResult.rows);
      state.sourceRows = sourceResult.rows;
      state.sourceMode = sourceResult.source;
      state.sourceProfile = sourceResult.profile;
      state.selectedStoreCode = resolveStoreCode(sourceResult.profile, state.selectedStoreCode);
      state.selectedMetrics = resolveMetrics(sourceResult.profile, state.selectedMetrics, state.selectedMetric);
      state.selectedMetric = state.selectedMetrics[0] || '';
      state.periodRows = periods.rows;
      state.selectedPeriodType = state.selectedPeriodType || '';
      state.periodSource = periods.source;
      state.manualOverrides = await loadOverridesForSelection();
      const l4lResult = await loadComparisonRows();
      applyL4LResult(l4lResult);
      const recoveredAfterDomoRefresh = state.comparisonRefreshPending && !l4lResult.empty && l4lResult.rows.length;
      if (recoveredAfterDomoRefresh) {
        state.comparisonRefreshPending = false;
        state.stepAcknowledged.workflow = true;
        state.activeLayerId = LAYER_STAGE_IDS.presentation;
      }
      state.diagnostics = mergeDiagnostics(
        state.diagnostics,
        sourceResult.diagnostics,
        periods.diagnostics
      );
      state.status = initialStatusMessage({
        recoveredAfterDomoRefresh,
        l4lRowCount: l4lResult.rows.length,
        comparisonRefreshPending: state.comparisonRefreshPending,
        sourceWarning: sourceResult.warning
      });
      state.error = '';
    } catch (error) {
      state.error = readableError(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  function render() {
    root.innerHTML = `
      <main class="app-shell">
        ${renderCommandHeader()}
        ${state.error ? `<section class="banner banner-error" role="alert">${escapeHtml(state.error)}</section>` : ''}
        <section class="banner" aria-live="polite">${escapeHtml(state.status)}</section>
        ${renderStaleDataBanner()}
        ${renderNextActionStrip()}
        ${renderLayerNavigator()}
        ${renderActiveLayerWorkspace()}
        ${renderEvidenceTabs()}
        ${renderDiagnosticsDrawer()}
        ${state.pendingWrite ? renderWriteConfirmation(state.pendingWrite) : ''}
        ${state.executionModal ? renderExecutionModal(state.executionModal) : ''}
      </main>
    `;

    bindEvents();
    persistUiState(state);
  }

  function renderCommandHeader() {
    return `
      <header class="command-header">
        <div class="command-title">
          <p class="eyebrow">Command Center</p>
          <h1>Forty Winks CCM</h1>
          <p class="topbar-subtitle">Comparable Coverage Workflow for building governed L4L comparison facts and explaining excluded weeks.</p>
        </div>
        ${renderScopeBar()}
        <div class="header-actions health-strip">
          <div class="runtime-pill">${escapeHtml(getRuntimeLabel())}</div>
          ${healthChip('Source', state.diagnostics?.source?.queryable)}
          ${healthChip('AppDB', state.diagnostics?.appDb?.reachable)}
          ${healthChip('Workflow', getWorkflowTriggerSupport().supported)}
          <button type="button" class="secondary icon-button" data-action="change-scope">Change Store / Metric</button>
          <button type="button" class="secondary icon-button" data-action="start-new-run">Start New Run</button>
          <button type="button" class="secondary icon-button" data-action="toggle-diagnostics" aria-expanded="${state.diagnosticsOpen ? 'true' : 'false'}">
            Diagnostics
          </button>
        </div>
      </header>
    `;
  }

  function renderScopeBar() {
    const context = state.l4lRows.length ? inferComparisonContext(state.l4lRows) : {};
    return `
      <section class="scope-bar" aria-label="Selected Scope">
        <div>
          <span>Store</span>
          <strong>${escapeHtml(selectedStoreDisplay())}</strong>
        </div>
        <div>
          <span>Metric</span>
          <strong>${escapeHtml(selectedMetricDisplay())}</strong>
        </div>
        <div>
          <span>Period Types (all 6 auto-generated)</span>
          <strong>LCW · LCM · LCQ · YTD · QTD · MTD</strong>
        </div>
        <div>
          <span>Comparison</span>
          <strong>${escapeHtml(context.period_label_current || 'Current')} vs ${escapeHtml(context.period_label_prior || 'Prior')}</strong>
        </div>
        ${state.scopeDirty ? '<div class="scope-stale-chip">Stale scope</div>' : ''}
      </section>
    `;
  }

  function healthChip(label, ok) {
    const stateLabel = ok ? 'Ready' : 'Check';
    return `<span class="health-chip ${ok ? 'health-ok' : 'health-warn'}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(stateLabel)}</strong></span>`;
  }

  function renderStaleDataBanner() {
    if (!state.scopeDirty) return '';
    return `
      <section class="stale-data-banner" role="status" aria-live="polite">
        <div>
          <strong>Scope changed.</strong>
          Existing mask and L4L result context no longer match the current scope. Rebuild the mask below.
        </div>
        <button type="button" class="primary compact" data-action="generate-mask">Rebuild Selected Scope Mask</button>
      </section>
    `;
  }

  function renderNextActionStrip() {
    const action = nextBestAction();
    return `
      <section class="next-action-strip" aria-label="Next best action">
        <div>
          <p class="eyebrow">Next best action</p>
          <h2>${escapeHtml(action.title)}</h2>
          <p class="note">${escapeHtml(action.reason)}</p>
          ${action.disabledReason ? `<p class="disabled-reason">${escapeHtml(action.disabledReason)}</p>` : ''}
        </div>
        <div class="next-action-control">
          <span class="next-action-hint">Use the active work area below.</span>
          ${statusBadge(action.status || activeWorkflowStep().status)}
        </div>
      </section>
    `;
  }

  function renderLayerNavigator() {
    return `
      <nav class="layer-navigator" aria-label="CCM five-layer architecture">
        ${layerStages().map((stage) => `
          <button
            class="layer-card layer-card-${escapeAttribute(stage.id)} layer-status-${escapeAttribute(stage.status)}"
            type="button"
            data-action="open-layer-stage"
            data-layer-id="${escapeAttribute(stage.id)}"
            title="${escapeAttribute(stage.question)}"
            style="--layer-color: ${escapeAttribute(stage.color)}; --layer-border: ${escapeAttribute(stage.borderColor)}; --layer-bg: ${escapeAttribute(stage.bgColor)}"
          >
            <span class="layer-icon" style="background: ${escapeAttribute(stage.color)}">${escapeHtml(stage.icon)}</span>
            <span class="layer-copy">
              <span class="layer-num">Stage ${escapeHtml(stage.num)}</span>
              <strong>${escapeHtml(stage.title)}</strong>
              <small>${escapeHtml(stage.subtitle)}</small>
              <em class="layer-question">${escapeHtml(stage.question)}</em>
            </span>
            <span class="layer-status-badge status-${escapeAttribute(stage.status)}">${escapeHtml(layerStatusLabel(stage.status))}</span>
          </button>
        `).join('')}
      </nav>
    `;
  }

  function renderWorkflowRail() { return renderLayerNavigator(); }
  function renderWorkflowStepper() { return renderLayerNavigator(); }

  function renderActiveLayerWorkspace() {
    const stage = activeLayerStage();
    const config = getLayerConfig(stage.id);
    return `
      <section class="layer-workspace layer-workspace-${escapeAttribute(stage.id)}">
        <div class="workspace-heading layer-heading" style="--layer-color: ${escapeAttribute(config.color)}; --layer-border: ${escapeAttribute(config.borderColor)}; --layer-bg: ${escapeAttribute(config.bgColor)}">
          <div class="layer-heading-left">
            <span class="layer-icon-large" style="background: ${escapeAttribute(config.color)}">${escapeHtml(config.icon)}</span>
            <div>
              <p class="eyebrow">Stage ${escapeHtml(config.num)} · ${escapeHtml(config.subtitle)}</p>
              <h2>${escapeHtml(config.title)}</h2>
              <p class="layer-question-main">${escapeHtml(config.question)}</p>
              <p class="note">${escapeHtml(config.oneLiner)}</p>
            </div>
          </div>
          ${statusBadge(stage.status)}
        </div>
        <div class="workspace-grid">
          ${renderActiveLayerBody(stage)}
        </div>
      </section>
    `;
  }

  function renderActiveLayerBody(stage) {
    const id = stage.id;
    if (id === LAYER_STAGE_IDS.calendar) {
      return `${renderSelectionControls()}${renderGlobalDatasetOverview()}${renderLayerOutputSummary(id)}${renderStageConfirmButton(id)}`;
    }
    if (id === LAYER_STAGE_IDS.trading) {
      return `${renderSelectedScopeSummary()}${renderTradingExpectationPanel()}${renderLayerOutputSummary(id)}${renderStageConfirmButton(id)}`;
    }
    if (id === LAYER_STAGE_IDS.metricCoverage) {
      return `${renderSelectedScopeSummary()}${renderMetricCoveragePanel()}${renderLayerOutputSummary(id)}${renderStageConfirmButton(id)}`;
    }
    if (id === LAYER_STAGE_IDS.comparableCoverage) {
      return `${renderSelectedScopeSummary()}${renderPeriodDefinitions()}${renderGenerateMask()}${renderValidationSummary()}${renderStageConfirmButton(id)}`;
    }
    // presentation
    return `${renderL4LComparisonVisualization()}${renderPrepareL4LWorkflowPanel()}${renderEvidenceTabs()}`;
  }

  function renderStageConfirmButton(stageId) {
    const stage = layerStages().find((s) => s.id === stageId);
    if (!stage) return '';
    // Show button if stage is NOT complete, OR if user is actively viewing this completed stage
    const isViewing = activeLayerStage().id === stageId;
    if (stage.status === 'complete' && !isViewing) return '';

    const btnStyle = isViewing && (stage.status === 'ready' || stage.status === 'complete') ? 'primary' : 'secondary';

    const labels = {
      [LAYER_STAGE_IDS.calendar]: 'Confirm Calendar → Trading Expectation',
      [LAYER_STAGE_IDS.trading]: 'Confirm Trading → Metric Coverage',
      [LAYER_STAGE_IDS.metricCoverage]: 'Confirm Coverage → Comparable Coverage',
      [LAYER_STAGE_IDS.comparableCoverage]: 'Complete & Unlock Presentation'
    };
    const label = labels[stageId] || 'Confirm & Continue';
    const disabled = !isViewing || stage.status === 'locked' ? 'disabled' : '';

    return `
      <section class="panel stage-confirm-panel">
        <div class="panel-heading">
          <h3>Proceed to Next Stage</h3>
          ${statusBadge(stage.status)}
        </div>
        <p class="note">${stage.status === 'locked' ? 'Complete the current stage requirements first.' : 'Confirm this stage is complete to unlock the next one.'}</p>
        <button type="button" class="${btnStyle}" data-action="confirm-stage" data-stage-id="${escapeAttribute(stageId)}" ${disabled}>${escapeHtml(label)}</button>
      </section>
    `;
  }

  function handleConfirmStage(stageId) {
    if (stageId === LAYER_STAGE_IDS.calendar) {
      state.stageConfirmed.calendar = true;
      // Reset downstream stages when scope may have changed
      state.stageConfirmed.trading = false;
      state.stageConfirmed.metricCoverage = false;
      state.stageConfirmed.comparableCoverage = false;
      state.stageConfirmed.presentation = false;
      state.activeLayerId = LAYER_STAGE_IDS.trading;
      state.status = 'Calendar layer confirmed. Proceeding to Trading Expectation.';
    } else if (stageId === LAYER_STAGE_IDS.trading) {
      state.stageConfirmed.trading = true;
      state.stageConfirmed.metricCoverage = false;
      state.stageConfirmed.comparableCoverage = false;
      state.stageConfirmed.presentation = false;
      state.activeLayerId = LAYER_STAGE_IDS.metricCoverage;
      state.status = 'Trading expectations confirmed. Proceeding to Metric Coverage.';
    } else if (stageId === LAYER_STAGE_IDS.metricCoverage) {
      state.stageConfirmed.metricCoverage = true;
      state.stageConfirmed.comparableCoverage = false;
      state.stageConfirmed.presentation = false;
      state.activeLayerId = LAYER_STAGE_IDS.comparableCoverage;
      state.status = 'Metric coverage confirmed. Proceeding to Comparable Coverage.';
    } else if (stageId === LAYER_STAGE_IDS.comparableCoverage) {
      state.stageConfirmed.comparableCoverage = true;
      state.stageConfirmed.presentation = false;
      state.activeLayerId = LAYER_STAGE_IDS.presentation;
      state.status = 'CCM mask complete. Proceeding to Presentation.';
    }
    invalidateScopeCache();
    render();
  }

  function renderLayerOutputSummary(layerId) {
    const config = getLayerConfig(layerId);
    const stage = layerStages().find((s) => s.id === layerId);
    const values = layerOutputValues(layerId);
    return `
      <section class="panel layer-output-panel" style="--layer-color: ${escapeAttribute(config.color)}; --layer-border: ${escapeAttribute(config.borderColor)}">
        <div class="panel-heading">
          <h3>${escapeHtml(config.title)} Outputs ${renderInfoTooltip(config.oneLiner)}</h3>
          ${statusBadge(stage?.status || 'locked')}
        </div>
        <div class="metric-grid compact-grid">
          ${config.outputs.map((output) => {
            const val = values[output];
            const short = outputShortName(output);
            return `<div class="metric"><span title="${escapeAttribute(output)}">${escapeHtml(short)}</span><strong>${escapeHtml(val != null ? val : '-')}</strong></div>`;
          }).join('')}
        </div>
        <p class="note">Derived from ${config.outputs.length} field(s). Data flows into the next layer.</p>
      </section>
    `;
  }

  function outputShortName(field) {
    const map = {
      period_type: 'Period Type', comparison_side: 'Side', comparable_week_slot: 'Slot',
      comparison_window_id: 'Window ID', system_include_flag: 'Sys Include', system_reason_code: 'Sys Reason',
      source_data_exists: 'Data Exists', source_row_count: 'Row Count', source_value: 'Value',
      manual_include_flag: 'Manual Incl', paired_slot_include_flag: 'Paired Slot',
      final_include_flag: 'Final Incl', mask_include_flag: 'Mask Incl', final_reason_code: 'Reason'
    };
    return map[field] || field;
  }

  function layerOutputValues(layerId) {
    const periodRows = state.periodRows || [];
    const summary = selectedScopeSummary();
    const uniquePeriodTypes = new Set(periodRows.map((r) => r.period_type)).size;
    const uniqueSlots = new Set(periodRows.map((r) => r.comparable_week_slot)).size;
    const uniqueWindows = new Set(periodRows.map((r) => r.comparison_window_id).filter(Boolean)).size;

    if (layerId === LAYER_STAGE_IDS.calendar) {
      return {
        period_type: uniquePeriodTypes || '5-6',
        comparison_side: 'current / prior',
        comparable_week_slot: uniqueSlots,
        comparison_window_id: uniqueWindows
      };
    }
    if (layerId === LAYER_STAGE_IDS.trading) {
      return {
        system_include_flag: `${summary.final_included_rows || 0} Y / ${summary.system_excluded_week_count || summary.final_excluded_rows || 0} N`,
        system_reason_code: summary.system_excluded_week_count > 0 ? 'see review table' : 'INCLUDED'
      };
    }
    if (layerId === LAYER_STAGE_IDS.metricCoverage) {
      return {
        source_data_exists: `${summary.source_rows_available > 0 ? 'Y' : 'N'} (${summary.missing_source_week_count || 0} weeks missing)`,
        source_row_count: summary.source_rows_available || summary.scoped_source_row_count || 0,
        source_value: summary.scoped_source_row_count ? 'Aggregated' : '-'
      };
    }
    if (layerId === LAYER_STAGE_IDS.comparableCoverage) {
      return {
        manual_include_flag: `${summary.active_manual_override_count || 0} overrides`,
        paired_slot_include_flag: summary.final_excluded_rows > 0 ? 'N on excluded' : 'Y',
        final_include_flag: `${summary.final_included_rows || 0} Y / ${summary.final_excluded_rows || 0} N`,
        mask_include_flag: `${summary.final_included_rows || 0} Y / ${summary.final_excluded_rows || 0} N`,
        final_reason_code: 'see validation summary'
      };
    }
    return {};
  }

  function renderTradingExpectationPanel() {
    const summary = selectedScopeSummary();
    const includedFlag = summary.final_included_rows && summary.final_included_rows > 0 ? 'Y' : '-';
    const excludedFlag = summary.final_excluded_rows && summary.final_excluded_rows > 0 ? 'N' : '-';
    return `
      <section class="panel panel-wide">
        <div class="panel-heading">
          <h2>Trading Expectation ${renderInfoTooltip(getTooltipCopy('tradingExpectation'))}</h2>
        </div>
        <div class="metric-grid">
          ${metric(labels.selectedStore, selectedStoreDisplay())}
          ${metric(labels.storeTradingDateWarnings, summary.missing_commencement_count)}
          ${metric(labels.storeClosureStatus, summary.selected_store_closure_status)}
          ${metric(labels.weeksNotExpectedToTrade, summary.system_excluded_week_count)}
          ${metric('Store-Weeks Expected to Trade', summary.final_included_rows || 'N/A')}
          ${metric('Store-Weeks Not Expected', summary.system_excluded_week_count || summary.final_excluded_rows || 'N/A')}
        </div>
        <p class="note">Default disposition: TRADING. A store is expected to trade unless a lifecycle event or override says otherwise. Flag: system_include_flag.</p>
      </section>
    `;
  }

  function renderMetricCoveragePanel() {
    const summary = selectedScopeSummary();
    const totalExpectedWeeks = (summary.weekly_coverage_record_count || 0) + (summary.missing_source_week_count || 0);
    const pctCovered = totalExpectedWeeks > 0
      ? Math.round(((summary.weekly_coverage_record_count || 0) / totalExpectedWeeks) * 100)
      : 0;
    return `
      <section class="panel panel-wide">
        <div class="panel-heading">
          <h2>Metric Coverage ${renderInfoTooltip('Indicates whether metric data exists for each store-metric-week. This is a transparency layer — missing data is a warning, not a blocking exclusion.')}</h2>
        </div>
        <div class="metric-grid">
          ${metric(labels.weeklyCoverageRecords, summary.weekly_coverage_record_count)}
          ${metric('Source Records Matched', summary.source_rows_available)}
          ${metric('Weeks Without Source Data', summary.missing_source_week_count)}
          ${metric('Data Coverage %', `${pctCovered}%`)}
        </div>
        <p class="note">Missing data within an expected trading week is tolerated by default — surfaced transparently, not punished. Flags: source_data_exists, source_row_count.</p>
      </section>
    `;
  }

  function layerStages() {
    return getLayerStages({
      hasSourceProfile: Boolean(state.sourceProfile),
      hasSelectedScope: Boolean(scopeSelectionReady()),
      hasReviewConfirmed: Boolean(state.reviewConfirmed),
      hasMaskCompleted: Boolean(state.stepCompletion?.mask || state.stepCompletion?.ccm),
      hasMaskAcknowledged: Boolean(state.stepAcknowledged?.mask || state.stepAcknowledged?.ccm),
      hasComparisonRows: Boolean(state.l4lRows.length),
      hasWorkflowAcknowledged: Boolean(state.stepAcknowledged?.workflow || state.stepAcknowledged?.presentation),
      hasMaskError: Boolean(state.validationSummary?.rebuild_status === 'failed' || state.validationSummary?.rebuild_status === 'clear_failed'),
      hasWorkflowError: Boolean(state.error && state.error.includes('Workflow')),
      hasComparisonError: Boolean(state.l4lValidation && state.l4lValidation.valid === false),
      stageConfirmed: state.stageConfirmed
    });
  }

  function activeLayerStage() {
    const stages = layerStages();
    const activeId = getActiveLayerStageId(stages, state.activeLayerId);
    return stages.find((stage) => stage.id === activeId) || stages[0];
  }

  function workflowSteps() { return layerStages(); }
  function activeWorkflowStep() { return activeLayerStage(); }

  function nextBestAction() {
    const stage = activeLayerStage();
    const support = getWorkflowTriggerSupport();

    if (!state.sourceProfile) {
      return {
        title: 'Load source data to begin.',
        reason: 'The Calendar Layer needs the mapped sourceMetrics alias to derive fiscal periods and comparable slots.',
        action: 'refresh-source',
        buttonLabel: 'Refresh Source',
        disabled: state.loading
      };
    }

    if (stage.id === LAYER_STAGE_IDS.calendar) {
      return {
        title: 'Calendar structure is loaded.',
        reason: 'Fiscal periods, comparison windows, and comparable slots have been derived from source data. Proceed to review Trading Expectations.',
        status: stage.status
      };
    }

    if (stage.id === LAYER_STAGE_IDS.trading) {
      return {
        title: 'Review trading expectations for each store.',
        reason: 'Select a Store and Metric to see which weeks the store was expected to trade.',
        status: stage.status
      };
    }

    if (stage.id === LAYER_STAGE_IDS.metricCoverage) {
      return {
        title: 'Review metric data coverage.',
        reason: 'Check which store-metric-weeks have source data and which are missing. Missing data is tolerated by default — visible, not excluded.',
        status: stage.status
      };
    }

    if (stage.id === LAYER_STAGE_IDS.comparableCoverage) {
      if (!state.reviewConfirmed) {
        return {
          title: 'Confirm Comparable Week Review.',
          reason: 'Review the comparable weeks and click Save Overrides before building the mask.',
          action: 'save-overrides',
          buttonLabel: 'Save Overrides',
          disabled: state.loading || !scopeSelectionReady(),
          kind: 'secondary'
        };
      }
      return {
        title: `Build the coverage mask for ${selectedStoreDisplay()} / ${selectedMetricDisplay()}.`,
        reason: 'All six period types are generated. Manual overrides and propagation rules will be applied.',
        action: 'generate-mask',
        buttonLabel: 'Rebuild Selected Scope Mask',
        disabled: stage.status === 'locked' || state.loading,
        disabledReason: stage.disabledReason
      };
    }

    // presentation
    if (!state.l4lRows.length) {
      if (support.supported) {
        return {
          title: 'Run Prepare L4L Comparison Facts.',
          reason: 'The mask is ready. Trigger the Domo Workflow to prepare comparison facts.',
          action: 'run-l4l-workflow',
          buttonLabel: 'Run Workflow and Refresh Results',
          disabled: state.loading,
          kind: 'primary'
        };
      }
      return {
        title: 'Refresh L4L results.',
        reason: 'Run the Workflow manually in Domo, then refresh results here.',
        action: 'refresh-l4l-results',
        buttonLabel: 'Refresh Results',
        disabled: state.loading
      };
    }
    return {
      title: 'Review L4L ON vs L4L OFF results.',
      reason: `${state.l4lRows.length} comparison fact rows loaded. Use L4L ON/OFF toggle and explore excluded weeks.`,
      status: stage.status
    };
  }

  function renderGlobalDatasetOverview() {
    const profile = state.sourceProfile;
    const overview = computeGlobalDatasetOverview(state.sourceRows, profile);
    return `
      <section class="panel">
        <div class="panel-heading">
          <h2>Global Dataset Overview</h2>
          <button type="button" class="secondary" data-action="refresh-source" ${state.loading ? 'disabled' : ''}>Refresh</button>
        </div>
        ${profile ? `
          <div class="metric-grid">
            ${metric(labels.sourceRecords, overview.source_row_count)}
            ${metric(labels.stores, overview.store_count)}
            ${metric(labels.fiscalWeeks, overview.week_count)}
            ${metric(labels.metrics, overview.metric_count)}
            ${metric(labels.firstWeekEnding, overview.min_week_ending || '-')}
            ${metric(labels.latestWeekEnding, overview.max_week_ending || '-')}
            ${metric(labels.storesMissingTradingCommencementDate, overview.stores_missing_commencement_date)}
            ${metric(labels.storesWithClosureDate, overview.stores_with_closure_date)}
          </div>
          <p class="note">${escapeHtml(helperText.sourceRecords)} Global overview is not affected by Store, Metric, or Period Lens selection. Source mode: ${escapeHtml(sourceModeText(state.sourceMode))}. Date warning check: ${escapeHtml(overview.date_parsing_warnings)}.</p>
        ` : emptyState('No source profile loaded.')}
      </section>
    `;
  }

  function renderSelectionControls() {
    const profile = state.sourceProfile;
    return `
      <section class="panel">
        <div class="panel-heading">
          <h2>Selection</h2>
        </div>
        ${profile ? `
          <div class="field-grid">
            <label>
              <span>Store</span>
              <select data-action="select-store" ${state.loading ? 'disabled' : ''}>
                <option value="${ALL_STORES_VALUE}" ${state.selectedStoreCode === ALL_STORES_VALUE ? 'selected' : ''}>All Stores</option>
                ${(profile.stores || []).map((store) => `<option value="${escapeAttribute(store.store_code)}" ${store.store_code === state.selectedStoreCode ? 'selected' : ''}>${escapeHtml(store.store_code)} - ${escapeHtml(store.store_name || 'Unknown')}</option>`).join('')}
              </select>
            </label>
            <label>
              <span>Metric</span>
              <select data-action="select-metrics" multiple size="4" ${state.loading ? 'disabled' : ''}>
                <option value="${ALL_METRICS_VALUE}" ${state.selectedMetrics.includes(ALL_METRICS_VALUE) ? 'selected' : ''}>All Metrics</option>
                ${(profile.metrics || []).map((item) => `<option value="${escapeAttribute(item.metric)}" ${selectedMetricList().includes(item.metric) ? 'selected' : ''}>${escapeHtml(item.metric)}</option>`).join('')}
              </select>
            </label>
          </div>
          <p class="note">Current selection: ${escapeHtml(selectedStoreDisplay())} / ${escapeHtml(selectedMetricDisplay())}. All six approved period types are generated automatically.</p>
        ` : emptyState('Load source data before selecting a scope.')}
      </section>
    `;
  }

  function renderSelectedScopeSummary() {
    const profile = state.sourceProfile;
    const summary = selectedScopeSummary();
    const excludedPct = summary.comparableWeekTotal > 0
      ? Math.round((summary.final_excluded_rows / summary.comparableWeekTotal) * 100)
      : 0;
    if (!profile) return emptyState('No selected scope is available yet.');
    return `
      <section class="panel panel-wide scope-summary-panel">
        <div class="panel-heading">
          <h2>Selected Scope Summary</h2>
          <span class="scope-summary-badge">${escapeHtml(selectedStoreDisplay())} · ${escapeHtml(selectedMetricDisplay())}</span>
        </div>

        <div class="scope-summary-layout">
          <div class="ss-card ss-card-scope">
            <p class="ss-eyebrow">Scope</p>
            <div class="ss-row">${ssMetric('Store', selectedStoreDisplay(), 'The store(s) included in this CCM run.')}</div>
            <div class="ss-row">${ssMetric('Metric', selectedMetricDisplay(), 'The metric(s) included in this CCM run.')}</div>
            <div class="ss-row">${ssMetric('Period Types', 'All 6 · LCW/LCM/LCQ/YTD/QTD/MTD', 'All six approved period types are generated automatically for every run.')}</div>
          </div>

          <div class="ss-card ss-card-weeks">
            <p class="ss-eyebrow">Comparable Weeks</p>
            <div class="ss-metric-row">
              ${ssBigMetric('Current', summary.current_side_week_count, 'Comparable weeks on the current side of the comparison window.')}
              ${ssBigMetric('Prior', summary.prior_side_week_count, 'Comparable weeks on the prior side of the comparison window.')}
            </div>
            <div class="ss-metric-row">
              ${ssBigMetric('Included', summary.final_included_rows, 'Weeks included in LFL ON after all CCM rules are applied. These weeks are fair to compare.')}
              ${ssBigMetric('Excluded', summary.final_excluded_rows, `Weeks excluded from LFL ON (${excludedPct}% of comparable weeks). Visible in LFL OFF.`)}
            </div>
          </div>

          <div class="ss-card ss-card-quality">
            <p class="ss-eyebrow">Data Quality &amp; Overrides</p>
            <div class="ss-row">${ssMetric('Weeks Without Source Data', summary.missing_source_week_count, 'Store-metric-weeks that have no source data. Tolerated by default — visible, not excluded.')}</div>
            <div class="ss-row">${ssMetric('Manual Overrides', summary.active_manual_override_count, 'User-applied manual coverage adjustments (Store + Metric + Week grain).')}</div>
            <div class="ss-row">${ssMetric('Store Status', summary.selected_store_closure_status, 'Store lifecycle status — trading commencement and closure dates.')}</div>
          </div>
        </div>

        <p class="note scope-summary-note">Comparable weeks are the core unit of CCM. <strong>Included</strong> weeks pass all comparability rules and appear in LFL ON. <strong>Excluded</strong> weeks are removed by slot completeness, paired propagation, or manual overrides but remain visible in LFL OFF.</p>
      </section>
    `;
  }

  function ssMetric(label, value, tooltip) {
    const tip = tooltip ? ` title="${escapeAttribute(tooltip)}"` : '';
    return `<span class="ss-label"${tip}>${escapeHtml(label)}${tooltip ? ' <em class="ss-tip-icon">?</em>' : ''}</span> <strong class="ss-value">${escapeHtml(value)}</strong>`;
  }

  function ssBigMetric(label, value, tooltip) {
    const tip = tooltip ? ` title="${escapeAttribute(tooltip)}"` : '';
    return `<div class="ss-big"${tip}><span class="ss-big-value">${escapeHtml(value)}</span><span class="ss-big-label">${escapeHtml(label)}${tooltip ? ' <em class="ss-tip-icon">?</em>' : ''}</span></div>`;
  }

  function renderPeriodDefinitions() {
    if (!singleOverrideScope()) {
      return `
        <section class="panel panel-wide">
          <div class="panel-heading">
            <div>
              <h2>Comparable Week Review / Override Editor</h2>
              ${statusBadge('locked')}
            </div>
            <button type="button" class="secondary" data-action="save-overrides" ${state.loading || !scopeSelectionReady() ? 'disabled' : ''}>Save Overrides</button>
          </div>
          <p class="note">Fiscal weeks are derived from sourceMetrics at runtime and are not persisted in AppDB. ${escapeHtml(helperText.tradingExpectation)}</p>
          <p class="note">Manual override editing requires selecting a single Store and a single Metric. With multiple stores or All Metrics selected, Save Overrides will confirm the review without writing new override documents.</p>
          ${state.reviewConfirmed ? '<p class="success-message">Comparable Week Review confirmed. Build Coverage Mask is now available.</p>' : ''}
          ${!scopeSelectionReady() ? '<p class="disabled-reason">Select a Store and at least one Metric before reviewing comparable weeks.</p>' : '<p class="note">Select a single Store and a single Metric to enable the override editor.</p>'}
        </section>
      `;
    }

    const allRows = allPeriodRowsForGeneration();
    const filterRows = state.selectedPeriodType
      ? allRows.filter((row) => row.period_type === state.selectedPeriodType)
      : allRows;
    const validation = validatePeriods(filterRows);
    const periodTypeFilter = state.selectedPeriodType
      ? `Filtered to: ${escapeHtml(state.selectedPeriodType)}`
      : 'Showing all period types';

    return `
      <section class="panel panel-wide">
        <div class="panel-heading">
          <div>
            <h2>Comparable Week Review / Override Editor</h2>
            ${statusBadge(state.reviewConfirmed ? 'complete' : 'locked')}
          </div>
          <button type="button" class="secondary" data-action="save-overrides" ${state.loading || !scopeSelectionReady() ? 'disabled' : ''}>Save Overrides</button>
        </div>
        <p class="note">Source: ${escapeHtml(state.periodSource)}. Validation: ${validation.valid ? 'valid' : `${validation.errors.length} error(s)`}. Fiscal weeks are derived from sourceMetrics at runtime and are not persisted in AppDB. ${escapeHtml(helperText.tradingExpectation)} ${escapeHtml(periodTypeFilter)}. Use the Period Filter above to narrow the view for easier review.</p>
        ${state.reviewConfirmed ? '<p class="success-message">Comparable Week Review confirmed. Build Coverage Mask is now available.</p>' : '<p class="disabled-reason">Save Overrides to confirm Comparable Week Review before building the selected-scope mask.</p>'}
        ${filterRows.length ? renderPeriodTable(filterRows) : emptyState('No comparable weeks are available.')}
      </section>
    `;
  }

  function renderGenerateMask() {
    const step = workflowSteps().find((item) => item.id === 'mask');
    const isLocked = step?.status === 'locked' || state.loading;
    return `
      <section class="panel step-card">
        <div class="panel-heading">
          <h2>Build Coverage Mask ${renderInfoTooltip(getTooltipCopy('comparableCoverage'))}</h2>
          ${statusBadge(step?.status || 'locked')}
        </div>
        <p class="note">${escapeHtml(displayText.selectedScopeOutput)}</p>
        <p class="note">${escapeHtml(displayText.selectedScopeCollection)}</p>
        <p class="note">All six approved period types are generated by default for the selected Store and Metric scope. This rebuilds the selected-scope CCM output. It is intended for Phase 1 validation, not production full-mask processing.</p>
        ${step?.disabledReason ? `<p class="disabled-reason">${escapeHtml(step.disabledReason)}</p>` : ''}
        <button type="button" class="primary" data-action="generate-mask" ${isLocked || !state.reviewConfirmed || !state.sourceProfile || !selectedPeriodRows().length || !scopeSelectionReady() ? 'disabled' : ''}>
          Rebuild Selected Scope Mask
        </button>
      </section>
      <div class="future-state-note">
        <p>Generate Full CCM Mask: Coming soon, planned for production, and intentionally disabled during Phase 1 prototype validation. ${escapeHtml(displayText.fullMaskOutput)} ${escapeHtml(displayText.fullMaskCollection)} ${escapeHtml(displayText.fullMaskStatus)}</p>
        <button type="button" class="secondary compact" disabled>Generate Full CCM Mask</button>
      </div>
    `;
  }

  function renderValidationSummary() {
    const summary = state.validationSummary;
    return `
      <section class="panel panel-wide">
        <div class="panel-heading">
          <h2>Selected Scope Validation Summary</h2>
        </div>
        ${summary ? `
          <h3>${escapeHtml(displayText.businessValidation)}</h3>
          <div class="metric-grid">
            ${metric(labels.comparableWeekRecords, summary.total_mask_rows)}
            ${metric(labels.includedComparableWeeks, summary.included_mask_rows)}
            ${metric(labels.excludedComparableWeeks, summary.excluded_mask_rows)}
            ${metric(labels.weeksWithoutSourceData, summary.weeks_without_source_data)}
            ${metric(labels.manualCoverageAdjustmentsApplied, summary.manual_coverage_adjustments_applied)}
            ${metric(labels.storeTradingDateWarnings, summary.missing_commencement_date_warnings)}
            ${metric(labels.dateQualityWarnings, summary.invalid_date_warnings)}
          </div>
          <h3>${escapeHtml(displayText.technicalWriteSummary)}</h3>
          <div class="metric-grid">
            ${metric(labels.generationMode, summary.generation_mode || 'SELECTED_SCOPE')}
            ${metric(labels.outputCollection, summary.output_collection || COLLECTIONS.selectedScopeMask)}
            ${metric(labels.selectedStore, summary.selected_store || '-')}
            ${metric(labels.selectedMetric, summary.selected_metric || '-')}
            ${metric(labels.selectedPeriodLens, summary.selected_period_type || '-')}
            ${metric(labels.runId, summary.run_id)}
            ${metric(labels.previousMaskRecordsCleared, summary.mask_rows_deleted ?? 0)}
            ${metric(labels.maskRecordsWritten, summary.mask_rows_inserted ?? 0)}
            ${metric(labels.rebuildStatus, summary.rebuild_status || 'pending')}
          </div>
          ${renderCountList('Excluded Stores by Outcome Reason', summary.excluded_stores_by_reason_code)}
          ${renderCountList('Comparable Weeks by Period Lens and Comparison Side', summary.rows_by_period_type_and_side)}
          ${renderCountList('Comparable Weeks by Region', summary.rows_by_region)}
          <p class="note">${escapeHtml(summary.zero_fill_note)}</p>
        ` : emptyState('No mask generation has run yet.')}
      </section>
    `;
  }

  function renderPrepareL4LWorkflowPanel() {
    const support = getWorkflowTriggerSupport();
    const step = workflowSteps().find((item) => item.id === 'workflow');
    const canRunWorkflow = step?.status === 'ready' && support.supported && !state.loading;
    const workflowErrorCopy = state.error && state.error.includes('Workflow')
      ? 'Workflow could not be started. No comparison facts were changed. Check the Workflow mapping in Domo, or run the Workflow manually and then refresh results.'
      : '';
    return `
      <section class="panel panel-wide phase2-panel step-card">
        <div class="panel-heading">
          <div>
            <h2>Prepare L4L Comparison Facts ${renderInfoTooltip(getTooltipCopy('workflowAlias'))}</h2>
            <p class="note">Workflow ${escapeHtml(PREPARE_L4L_WORKFLOW.version)} writes the output dataset used by this read-only visualization.</p>
          </div>
          <div class="button-row">
            ${statusBadge(step?.status || 'locked')}
            <button type="button" class="primary compact" data-action="run-l4l-workflow" ${canRunWorkflow ? '' : 'disabled'}>${support.supported ? 'Run Workflow and Refresh Results' : 'Run Workflow Automatically'}</button>
            <button type="button" class="secondary" data-action="refresh-l4l-results" ${state.loading ? 'disabled' : ''}>Refresh Results</button>
          </div>
        </div>
        <div class="metric-grid">
          ${metric('Workflow', PREPARE_L4L_WORKFLOW.name)}
          ${metric('Workflow Alias', PREPARE_L4L_WORKFLOW.alias)}
          ${metric('Version', PREPARE_L4L_WORKFLOW.version)}
          ${metric('Start Inputs', 'None')}
          ${metric('Output Dataset', PREPARE_L4L_WORKFLOW.outputDatasetName)}
          ${metric('Dataset Alias', L4L_COMPARISON_ALIAS || 'l4lComparisonFact')}
        </div>
        ${support.supported ? '<p class="note">Automatic Workflow trigger is available in Domo runtime.</p>' : `
          <div class="manual-fallback">
            <strong>Automatic trigger is unavailable in this runtime.</strong>
            <p class="note">${escapeHtml(support.manualInstruction)}</p>
          </div>
        `}
        <p class="note">${escapeHtml(support.reason)}</p>
        ${step?.disabledReason ? `<p class="disabled-reason">${escapeHtml(step.disabledReason)}</p>` : ''}
        ${workflowErrorCopy ? `<p class="diagnostic-error" role="alert">${escapeHtml(workflowErrorCopy)}</p>` : ''}
        ${renderWorkflowProgress()}
      </section>
    `;
  }

  function renderWorkflowProgress() {
    const progress = state.workflowProgress;
    if (!progress) return '';

    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    const pollText = progress.maxPollAttempts
      ? `Poll ${progress.attempt || 0} of ${progress.maxPollAttempts}`
      : 'Starting';

    return `
      <div class="workflow-progress" role="status" aria-live="polite">
        <div class="progress-heading">
          <span>Workflow Status</span>
          <strong>${escapeHtml(progress.status || 'STARTING')}</strong>
        </div>
        <div class="progress-track" aria-label="Workflow execution progress">
          <div class="progress-fill" style="width: ${escapeAttribute(percent)}%;"></div>
        </div>
        <p class="note">${escapeHtml(pollText)}${progress.instanceId ? ` · Instance ${escapeHtml(progress.instanceId)}` : ''}</p>
        ${progress.errorMessage ? `<p class="diagnostic-error">${escapeHtml(progress.errorMessage)}</p>` : ''}
      </div>
    `;
  }

  function renderDiagnosticsDrawer() {
    if (!state.diagnosticsOpen) return '';
    const source = state.diagnostics?.source || {};
    const appDb = state.diagnostics?.appDb || {};
    const l4l = state.l4lDiagnostics || {};
    const support = getWorkflowTriggerSupport();

    return `
      <section class="modal-backdrop diagnostics-backdrop" role="presentation" data-action="close-diagnostics">
        <div class="execution-modal diagnostics-modal" role="dialog" aria-modal="true" aria-labelledby="diagnostics-modal-title" onclick="event.stopPropagation()">
          <div class="execution-header">
            <div>
              <p class="eyebrow">Technical Details</p>
              <h2 id="diagnostics-modal-title">Diagnostics ${renderInfoTooltip(getTooltipCopy('diagnostics'))}</h2>
            </div>
            <button type="button" class="secondary compact" data-action="close-diagnostics">Close</button>
          </div>
          <div class="diagnostics-grid">
            ${diagnosticCard('Source alias', source.alias || SOURCE_DATASET_ALIAS, source.queryable, source.message || sourceStatusText(source), source)}
            ${diagnosticCard('AppDB collections', appDb.reachable ? 'Reachable' : 'Fallback', appDb.reachable, appDb.message || appDbStatusText(appDb), appDb)}
            ${diagnosticCard('Workflow trigger', PREPARE_L4L_WORKFLOW.alias, support.supported, support.reason, {})}
            ${diagnosticCard('L4L comparison dataset', l4l.alias || L4L_COMPARISON_ALIAS, l4l.queryable, l4l.message || state.l4lMessage, l4l)}
          </div>
        </div>
      </section>
    `;
  }

  function renderExecutionModal(modalState) {
    const modal = buildExecutionModal(modalState);
    return `
      <section class="modal-backdrop execution-backdrop" role="presentation">
        <div class="execution-modal" role="dialog" aria-modal="true" aria-labelledby="execution-modal-title" aria-describedby="execution-modal-status">
          <div class="execution-header">
            <div>
              <p class="eyebrow">${escapeHtml(modal.progressLabel)}</p>
              <h2 id="execution-modal-title">${escapeHtml(modal.title)}</h2>
            </div>
            ${statusBadge(modalState.status || 'running')}
          </div>
          <p class="note">${escapeHtml(modal.explanation)}</p>
          <div class="progress-track execution-track" aria-label="Execution progress">
            <div class="progress-fill" style="width: ${escapeAttribute(modal.percent)}%;"></div>
          </div>
          <p id="execution-modal-status" class="execution-status" role="status" aria-live="polite">${escapeHtml(modal.currentStatusText)}</p>
          <ol class="execution-stages">
            ${modal.stages.map((stage) => `
              <li class="stage-${escapeAttribute(stage.state)}">
                <span>${escapeHtml(stageIcon(stage.state))}</span>
                <strong>${escapeHtml(stage.label)}</strong>
              </li>
            `).join('')}
          </ol>
          ${modal.resultSummary ? `<p class="success-message">${escapeHtml(modal.resultSummary)}</p>` : ''}
          ${modal.errorMessage ? `<p class="diagnostic-error" role="alert">${escapeHtml(modal.errorMessage)}</p>` : ''}
          <p class="note">No cancel button is shown while Domo is running the operation.</p>
          <div class="button-row confirmation-actions">
            ${modal.showCloseButton ? '<button type="button" class="secondary" data-action="close-execution-modal">Close</button>' : ''}
            ${modal.showCompleteButton ? `<button type="button" class="primary compact" data-action="complete-execution-modal">${escapeHtml(modalState.completeLabel || executionCompleteButtonLabel(modalState.type))}</button>` : ''}
          </div>
        </div>
      </section>
    `;
  }

  function executionCompleteButtonLabel(type) {
    if (type === 'mask') return 'Complete and Unlock Workflow';
    if (type === 'workflow' || type === 'refresh') return 'Complete and Review Results';
    return 'Complete';
  }

  function diagnosticCard(title, value, ok, message, details = {}) {
    return `
      <div class="diagnostic-item ${ok ? 'diagnostic-ok' : 'diagnostic-warning'}">
        <span>${escapeHtml(title)}</span>
        <strong>${escapeHtml(value || '-')}</strong>
        <p>${escapeHtml(message || 'Status is unknown.')}</p>
        ${details.errorStatus || details.errorMessage ? `<p class="diagnostic-error">Status ${escapeHtml(details.errorStatus || 'unknown')}: ${escapeHtml(details.errorMessage)}</p>` : ''}
        ${details.collections ? `<p class="diagnostic-list">${escapeHtml(details.collections.join(', '))}</p>` : ''}
      </div>
    `;
  }

  function renderL4LComparisonVisualization() {
    const rows = state.l4lRows;
    const validation = state.l4lValidation || { valid: true, missingFields: [] };

    if (!rows.length) {
      const emptyMessage = state.comparisonRefreshPending
        ? 'Workflow completed. Domo may still be refreshing the output dataset. Click Refresh Results after the Domo dataset refresh completes.'
        : 'No L4L comparison data is available. Run the Prepare L4L Comparison Facts Workflow first.';
      return `
        <section class="panel panel-wide phase2-panel">
          <div class="panel-heading">
            <h2>Store Performance — L4L Comparison</h2>
          </div>
          ${emptyState(emptyMessage)}
          ${renderL4LDiagnostics()}
        </section>
      `;
    }

    if (!validation.valid) {
      return `
        <section class="panel panel-wide phase2-panel">
          <div class="panel-heading">
            <h2>Store Performance — L4L Comparison</h2>
            <button type="button" class="secondary" data-action="refresh-l4l-results" ${state.loading ? 'disabled' : ''}>Refresh Results</button>
          </div>
          <p class="diagnostic-error">Missing required L4L comparison fields: ${escapeHtml(validation.missingFields.join(', '))}</p>
          ${renderL4LDiagnostics()}
        </section>
      `;
    }

    const context = inferComparisonContext(rows);
    const selectedSummary = calculateComparisonSummary(rows, { comparableCoverageOn: state.l4lComparableCoverageOn });
    const coverageMode = getCoverageModeLabel(state.l4lComparableCoverageOn);

    return `
      <section class="panel panel-wide phase2-panel result-board" aria-label="Result Board">
        <div class="panel-heading">
          <div>
            <h2>Store Performance — L4L Comparison ${renderInfoTooltip('L4L ON applies Comparable Coverage. L4L OFF keeps all rows in the comparison window.')}</h2>
            <p class="note">Comparing ${escapeHtml(context.period_label_current || 'Current')} vs ${escapeHtml(context.period_label_prior || 'Prior')} · ${escapeHtml(context.metric_display_name || context.metric || 'Metric')} · ${escapeHtml(context.store_name || context.store_code || 'Store')}</p>
          </div>
          <button type="button" class="secondary" data-action="refresh-l4l-results" ${state.loading ? 'disabled' : ''}>Refresh Results</button>
        </div>
        <div class="toggle-row" aria-label="Comparable Coverage mode">
          <div>
            <span>Comparable Coverage ${renderInfoTooltip(getTooltipCopy('comparableCoverage'))}</span>
            <p class="note">${escapeHtml(coverageMode.description)}</p>
          </div>
          <button type="button" class="switch-toggle ${state.l4lComparableCoverageOn ? 'switch-on' : ''}" role="switch" aria-checked="${state.l4lComparableCoverageOn ? 'true' : 'false'}" data-action="toggle-l4l-coverage">
            <span class="switch-thumb"></span>
            <strong>${escapeHtml(coverageMode.title)}</strong>
          </button>
        </div>
        ${renderComparableCoverageImpact(rows)}
        <h3>Main KPI Summary (${escapeHtml(coverageMode.title)})</h3>
        <div class="metric-grid">
          ${metric('Current Value', formatNumber(selectedSummary.current_value), getTooltipCopy('l4lOn'))}
          ${metric('Prior Value', formatNumber(selectedSummary.prior_value))}
          ${metric('Absolute Variance', formatSignedNumber(selectedSummary.absolute_variance))}
          ${metric('Variance %', selectedSummary.percent_change_display, getTooltipCopy('variancePercent'))}
          ${metric('Current Weeks', selectedSummary.included_current_weeks)}
          ${metric('Prior Weeks', selectedSummary.included_prior_weeks)}
          ${metric('Weeks Without Source Data', selectedSummary.weeks_without_source_data)}
          ${metric('Source Records Matched', selectedSummary.source_records_matched)}
          ${metric('Status', selectedSummary.comparison_status)}
        </div>
        ${renderVarianceStatusExplanation(selectedSummary)}
        ${renderComparisonScorecards(rows)}
        ${renderL4LResultComparisonTable(rows)}
      </section>
    `;
  }

  function renderL4LDiagnostics() {
    const diagnostics = state.l4lDiagnostics || {};
    return `
      <div class="diagnostic-item ${diagnostics.queryable ? 'diagnostic-ok' : 'diagnostic-warning'}">
        <span>L4L comparison dataset</span>
        <strong>${escapeHtml(diagnostics.alias || L4L_COMPARISON_ALIAS)}</strong>
        <p>${escapeHtml(diagnostics.message || state.l4lMessage || 'L4L comparison status is unknown.')}</p>
        ${diagnostics.errorStatus || diagnostics.errorMessage ? `<p class="diagnostic-error">Status ${escapeHtml(diagnostics.errorStatus || 'unknown')}: ${escapeHtml(diagnostics.errorMessage)}</p>` : ''}
      </div>
    `;
  }

  function renderL4LResultComparisonTable(rows) {
    const onSummary = calculateComparisonSummary(rows, { comparableCoverageOn: true });
    const offSummary = calculateComparisonSummary(rows, { comparableCoverageOn: false });
    return `
      <h3>Result Comparison</h3>
      <div class="table-wrap">
        <table>
          <caption>L4L ON and L4L OFF comparison summary</caption>
          <thead>
            <tr>
              <th>Coverage Mode</th>
              <th>Current Value</th>
              <th>Prior Value</th>
              <th>Absolute Variance</th>
              <th>Variance %</th>
              <th>Current Weeks</th>
              <th>Prior Weeks</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${renderComparisonSummaryRow('L4L ON', onSummary)}
            ${renderComparisonSummaryRow('L4L OFF', offSummary)}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderComparableCoverageImpact(rows) {
    const onSummary = calculateComparisonSummary(rows, { comparableCoverageOn: true });
    const offSummary = calculateComparisonSummary(rows, { comparableCoverageOn: false });
    const excludedRows = getExcludedWeeks(rows);
    const varianceImpact = onSummary.absolute_variance - offSummary.absolute_variance;
    const topReason = topOutcomeReason(excludedRows);
    const lowerHigher = varianceImpact < 0 ? 'lower' : varianceImpact > 0 ? 'higher' : 'the same as';

    return `
      <section class="impact-card" aria-label="Comparable Coverage Impact">
        <div>
          <p class="eyebrow">Comparable Coverage Impact</p>
          <h3>${escapeHtml(formatSignedNumber(varianceImpact))}</h3>
          <p class="note">L4L ON variance is ${escapeHtml(formatNumber(Math.abs(varianceImpact)))} ${escapeHtml(lowerHigher)} L4L OFF because ${escapeHtml(excludedRows.length)} week(s) were excluded, mainly due to ${escapeHtml(topReason)}.</p>
        </div>
        <div class="impact-metrics">
          ${metric('Excluded Weeks', excludedRows.length, getTooltipCopy('excludedWeeks'))}
          ${metric('Top Outcome Reason', topReason)}
          ${metric('Selected Mode', getCoverageModeLabel(state.l4lComparableCoverageOn).title)}
        </div>
      </section>
    `;
  }

  function renderComparisonScorecards(rows) {
    const onSummary = calculateComparisonSummary(rows, { comparableCoverageOn: true });
    const offSummary = calculateComparisonSummary(rows, { comparableCoverageOn: false });

    return `
      <section class="comparison-scorecards" aria-label="L4L ON and L4L OFF scorecards">
        ${renderComparisonScorecard('L4L ON', 'Governed Comparable Coverage', onSummary, 'Included Weeks')}
        ${renderComparisonScorecard('L4L OFF', 'Inclusive Comparison Window', offSummary, 'Total Weeks')}
      </section>
    `;
  }

  function renderComparisonScorecard(title, subtitle, summary, weekLabel) {
    const weekCount = Number(summary.included_current_weeks || 0) + Number(summary.included_prior_weeks || 0);
    return `
      <article class="scorecard">
        <div class="scorecard-heading">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p class="note">${escapeHtml(subtitle)}</p>
          </div>
          ${statusBadge(summary.comparison_status === 'OK' ? 'complete' : 'completed_unacknowledged')}
        </div>
        <div class="metric-grid compact-grid">
          ${metric('Current', formatNumber(summary.current_value))}
          ${metric('Prior', formatNumber(summary.prior_value))}
          ${metric('Variance', formatSignedNumber(summary.absolute_variance))}
          ${metric('Variance %', summary.percent_change_display)}
          ${metric(weekLabel, weekCount)}
        </div>
      </article>
    `;
  }

  function renderVarianceStatusExplanation(summary) {
    const status = summary.comparison_status || 'OK';
    if (status === 'OK') {
      return '<p class="status-explainer"><strong>OK:</strong> Variance percentage is calculated from a non-zero prior value.</p>';
    }

    const explanations = {
      PRIOR_ZERO: 'Prior value is zero, so variance percentage is not meaningful.',
      BOTH_ZERO: 'Current and Prior are both zero, so variance percentage is not meaningful.',
      WEEK_COUNT_MISMATCH: 'Current and Prior have different comparable week counts.'
    };

    return `<p class="status-explainer status-explainer-warning"><strong>${escapeHtml(status)}:</strong> ${escapeHtml(explanations[status] || 'Review comparison inputs before interpreting variance percentage.')}</p>`;
  }

  function renderComparisonSummaryRow(label, summary) {
    return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(formatNumber(summary.current_value))}</td>
        <td>${escapeHtml(formatNumber(summary.prior_value))}</td>
        <td>${escapeHtml(formatSignedNumber(summary.absolute_variance))}</td>
        <td>${escapeHtml(formatPercentChange(summary.percent_change))}</td>
        <td>${escapeHtml(summary.included_current_weeks)}</td>
        <td>${escapeHtml(summary.included_prior_weeks)}</td>
        <td>${escapeHtml(summary.comparison_status)}</td>
      </tr>
    `;
  }

  function renderEvidenceTabs() {
    const rows = state.l4lRows;
    const tabs = [
      ['excluded', 'Excluded Weeks'],
      ['weekly', 'All Weekly Detail'],
      ['validation', 'Validation'],
      ['technical', 'Technical Details']
    ];
    const activeTab = state.activeEvidenceTab || 'excluded';

    return `
      <section class="evidence-tabs" aria-label="Evidence">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Evidence</p>
            <h2>Coverage Evidence and Technical Context</h2>
          </div>
        </div>
        <div class="tab-list" role="tablist" aria-label="Evidence views">
          ${tabs.map(([id, label]) => `
            <button type="button" class="tab-button ${activeTab === id ? 'tab-active' : ''}" role="tab" aria-selected="${activeTab === id ? 'true' : 'false'}" data-action="set-evidence-tab" data-tab="${escapeAttribute(id)}">
              ${escapeHtml(label)}
            </button>
          `).join('')}
        </div>
        <div class="evidence-panel" role="tabpanel">
          ${renderEvidencePanel(activeTab, rows)}
        </div>
      </section>
    `;
  }

  function renderEvidencePanel(activeTab, rows) {
    if (activeTab === 'weekly') {
      return rows.length && state.l4lValidation?.valid ? renderL4LWeeklyDetail(rows) : emptyState('Weekly detail is available after L4L comparison data is loaded.');
    }
    if (activeTab === 'validation') {
      return `${renderSelectedScopeSummary()}${renderValidationSummary()}`;
    }
    if (activeTab === 'technical') {
      return `${renderGlobalDatasetOverview()}${renderL4LDiagnostics()}`;
    }
    return rows.length && state.l4lValidation?.valid ? renderExcludedCoverageWeeks(rows) : emptyState('Excluded-week evidence is available after L4L comparison data is loaded.');
  }

  function renderExcludedCoverageWeeks(rows) {
    const excludedRows = getExcludedWeeks(rows);
    const filteredRows = filterExcludedRows(excludedRows);
    const reasonOptions = unique(excludedRows.map((row) => row.final_reason_code || row.system_reason_code || row.manual_reason || 'Unknown'));
    const currentExcluded = excludedRows.filter((row) => String(row.comparison_side).toLowerCase() === 'current').length;
    const priorExcluded = excludedRows.filter((row) => String(row.comparison_side).toLowerCase() === 'prior').length;
    const manualCount = excludedRows.filter((row) => String(row.manual_include_flag || '').toUpperCase() === 'N').length;
    return `
      <h3>Weeks Excluded by Comparable Coverage ${renderInfoTooltip(getTooltipCopy('excludedWeeks'))}</h3>
      <p class="note">These weeks are included when Comparable Coverage is OFF, but removed when L4L is ON.</p>
      <div class="excluded-summary">
        ${metric('Total Excluded Weeks', excludedRows.length)}
        ${metric('Excluded Current Weeks', currentExcluded)}
        ${metric('Excluded Prior Weeks', priorExcluded)}
        ${metric('Manual Adjustments', manualCount)}
        ${metric('Top Outcome Reason', topOutcomeReason(excludedRows))}
      </div>
      <div class="filter-bar" aria-label="Excluded weeks filters">
        <label>
          <span>Side</span>
          <select data-action="filter-excluded-side">
            ${['all', 'current', 'prior'].map((value) => `<option value="${value}" ${state.excludedFilters.side === value ? 'selected' : ''}>${escapeHtml(value === 'all' ? 'All' : value)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Reason</span>
          <select data-action="filter-excluded-reason">
            <option value="all" ${state.excludedFilters.reason === 'all' ? 'selected' : ''}>All</option>
            ${reasonOptions.map((reason) => `<option value="${escapeAttribute(reason)}" ${state.excludedFilters.reason === reason ? 'selected' : ''}>${escapeHtml(reason)}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="secondary ${state.excludedFilters.manualOnly ? 'filter-active' : ''}" data-action="toggle-manual-only">Manual only</button>
        <button type="button" class="secondary ${state.excludedFilters.week53Only ? 'filter-active' : ''}" data-action="toggle-week53-only">Week 53 only</button>
      </div>
      ${renderReasonGuide()}
      ${renderCcmLayerBreakdown()}
      ${excludedRows.length ? `
        <div class="table-wrap">
          <table>
            <caption>Weeks excluded by Comparable Coverage and the reason each week was removed</caption>
            <thead>
              <tr>
                <th>Comparison Side</th>
                <th>Comparable Slot</th>
                <th>Fiscal Year</th>
                <th>Fiscal Week</th>
                <th>Week Ending</th>
                <th>Weekly Metric Value</th>
                <th>Source Records</th>
                <th>Trading Expectation</th>
                <th>Manual Coverage Adjustment</th>
                <th>Final CCM Outcome</th>
                <th>Outcome Reason</th>
                <th>Why Excluded</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.comparison_side)}</td>
                  <td>${escapeHtml(row.comparable_week_slot ?? '-')}</td>
                  <td>${escapeHtml(row.financial_year || '-')}</td>
                  <td>${escapeHtml(row.week_of_year ?? '-')}</td>
                  <td>${escapeHtml(row.week_ending)}</td>
                  <td>${escapeHtml(formatNumber(row.source_value))}</td>
                  <td>${escapeHtml(row.source_row_count ?? '-')}</td>
                  <td>${flagBadge(row.system_include_flag || '-')}</td>
                  <td>${flagBadge(row.manual_include_flag || '-')}</td>
                  <td>${flagBadge(row.final_include_flag || row.mask_include_flag || '-')}</td>
                  <td>${reasonBadge(row.final_reason_code || row.system_reason_code || '-')}</td>
                  <td>
                    <details class="row-reason">
                      <summary>Why was this week excluded?</summary>
                      <p>Trading expectation: ${escapeHtml(row.system_include_flag || '-')} · Manual adjustment: ${escapeHtml(row.manual_include_flag || '-')} · Final outcome: ${escapeHtml(row.final_include_flag || row.mask_include_flag || '-')} · Source records: ${escapeHtml(row.source_row_count ?? '-')} · ${escapeHtml(l4lPropagationImpact(row))}</p>
                    </details>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : emptyState('No weeks are excluded by comparable coverage.')}
    `;
  }

  function renderReasonGuide() {
    return `
      <details class="reason-guide">
        <summary>Reason guide</summary>
        <dl>
          <dt>Slot Completeness Rule</dt>
          <dd>LFL ON includes only comparable slots that exist on all required comparison sides (current AND prior). Unmatched slots are visible in LFL OFF but excluded from LFL ON.</dd>
          <dt>UNPAIRED_PERIOD_WEEK</dt>
          <dd>Comparable slot exists on only one comparison side. Caused by unequal week counts (e.g., 4 vs 5 weeks in a month, or quarter mismatches). Excluded from LFL ON.</dd>
          <dt>WEEK_53_EXCLUDED</dt>
          <dd>Week 53 excluded from comparable-slot equivalence logic (subtype of the Slot Completeness Rule). Excluded regardless of pairing.</dd>
          <dt>MANUAL_EXCLUDED</dt>
          <dd>A user-approved manual coverage adjustment excluded this week. Applies across all period types for the same Store + Metric + Week.</dd>
          <dt>PAIRED_SLOT_EXCLUSION</dt>
          <dd>Current/prior paired slot excluded to keep comparison alignment. Scoped within Store + Metric + Period Type + Comparable Slot.</dd>
          <dt>STORE_METRIC_WEEK_PROPAGATED_EXCLUSION</dt>
          <dd>Same Store + Metric + Week exclusion applied anywhere that week appears across period types.</dd>
        </dl>
      </details>
    `;
  }

  function renderCcmLayerBreakdown() {
    return `
      <details class="reason-guide layer-breakdown">
        <summary>CCM Five-Layer Architecture ${renderInfoTooltip(getTooltipCopy('fiveLayerArchitecture'))}</summary>
        <dl>
          <dt>L1 — Calendar / Time Truth</dt>
          <dd>Defines fiscal periods, comparison windows, comparison sides, and comparable slots. Produces: period_type, comparison_side, comparable_week_slot.</dd>
          <dt>L2 — Trading Expectation / Operational Truth</dt>
          <dd>Determines whether a store was expected to trade. Flag: system_include_flag. Reason: system_reason_code.</dd>
          <dt>L3 — Metric Coverage / Data Truth</dt>
          <dd>Indicates whether metric data exists (transparency layer — missing data is a warning, not a blocking exclusion). Flag: source_data_exists.</dd>
          <dt>L4 — Comparable Coverage / Comparability Truth</dt>
          <dd>Combines L1-L3 outputs, manual overrides, slot completeness, and paired propagation into final LFL inclusion. Flag: mask_include_flag. Reason: final_reason_code.</dd>
          <dt>L5 — Dashboards & Consumption / Presentation</dt>
          <dd>LFL ON: filter mask_include_flag = Y. LFL OFF: inclusive view, no mask filter.</dd>
        </dl>
      </details>
    `;
  }

  function filterExcludedRows(rows) {
    return (rows || []).filter((row) => {
      const side = String(row.comparison_side || '').toLowerCase();
      const reason = row.final_reason_code || row.system_reason_code || row.manual_reason || 'Unknown';
      const manualFlag = String(row.manual_include_flag || '').toUpperCase();
      const week = Number(row.week_of_year);

      if (state.excludedFilters.side !== 'all' && side !== state.excludedFilters.side) return false;
      if (state.excludedFilters.reason !== 'all' && reason !== state.excludedFilters.reason) return false;
      if (state.excludedFilters.manualOnly && manualFlag !== 'N') return false;
      if (state.excludedFilters.week53Only && week !== 53) return false;
      return true;
    });
  }

  function renderL4LWeeklyDetail(rows) {
    const detailRows = getRowsForCoverageMode(rows, { comparableCoverageOn: state.l4lComparableCoverageOn });
    return `
      <h3>Weekly Detail</h3>
      <div class="table-wrap">
        <table>
          <caption>All weekly comparison rows for the selected Comparable Coverage mode</caption>
          <thead>
            <tr>
              <th>Period Type</th>
              <th>Side</th>
              <th>Slot</th>
              <th>Financial Year</th>
              <th>Week</th>
              <th>Month</th>
              <th>Week Ending</th>
              <th>Source Value</th>
              <th>Source Data Status</th>
              <th>Trading Expectation</th>
              <th>Manual Coverage Adjustment</th>
              <th>Coverage Decision</th>
              <th>Final CCM Outcome</th>
              <th>Outcome Reason</th>
              <th>Alignment Impact</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row) => `
              <tr>
                <td>${escapeHtml(row.period_type)}</td>
                <td>${escapeHtml(row.comparison_side)}</td>
                <td>${escapeHtml(row.comparable_week_slot ?? '-')}</td>
                <td>${escapeHtml(row.financial_year || '-')}</td>
                <td>${escapeHtml(row.week_of_year ?? '-')}</td>
                <td>${escapeHtml(row.month_of_year ?? '-')}</td>
                <td>${escapeHtml(row.week_ending)}</td>
                <td>${escapeHtml(formatNumber(row.source_value))}</td>
                <td>${escapeHtml(row.source_data_status || (row.source_row_count > 0 ? 'Available' : 'Missing / Zero-filled'))}</td>
                <td>${escapeHtml(row.system_include_flag || '-')}</td>
                <td>${escapeHtml(row.manual_include_flag || '-')}</td>
                <td>${escapeHtml(row.effective_include_flag || row.final_include_flag || '-')}</td>
                <td>${escapeHtml(row.final_include_flag || row.mask_include_flag || '-')}</td>
                <td>${escapeHtml(row.final_reason_code || row.manual_reason || row.system_reason_code || '-')}</td>
                <td>${escapeHtml(l4lPropagationImpact(row))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPeriodTable(rows) {
    const reviewRows = reviewRowsForRows(rows);
    if (!reviewRows.length && !singleOverrideScope()) {
      const page = getPeriodPage(rows, state.periodPage);
      return `
        <div class="table-controls" aria-label="Period table pagination">
          <span>Page ${escapeHtml(page.currentPage)} of ${escapeHtml(page.totalPages)} · Showing ${escapeHtml(page.startRow)}-${escapeHtml(page.endRow)} of ${escapeHtml(page.totalRows)} period week rows</span>
          <div class="button-row">
            <button type="button" class="secondary" data-action="period-page-prev" ${page.currentPage <= 1 ? 'disabled' : ''}>Previous</button>
            <button type="button" class="secondary" data-action="period-page-next" ${page.currentPage >= page.totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <caption>Comparable week review for broad selected scope</caption>
            <thead>
              <tr>
                <th>${escapeHtml(labels.periodLens)}</th>
                <th>${escapeHtml(labels.comparisonSide)}</th>
                <th>${escapeHtml(labels.comparableSlot)}</th>
                <th>Financial Year</th>
                <th>Week</th>
                <th>Month</th>
                <th>Week Ending</th>
                <th>Fixed Comparison</th>
              </tr>
            </thead>
            <tbody>
              ${page.rows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.period_type)}</td>
                  <td>${escapeHtml(row.comparison_side)}</td>
                  <td>${escapeHtml(row.comparable_week_slot)}</td>
                  <td>${escapeHtml(row.financial_year || '-')}</td>
                  <td>${escapeHtml(row.week_of_year)}</td>
                  <td>${escapeHtml(row.month_of_year)}</td>
                  <td>${escapeHtml(row.week_ending)}</td>
                  <td>${escapeHtml(row.comparison_mode || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const page = getPeriodPage(reviewRows, state.periodPage);
    return `
      <div class="table-controls" aria-label="Period table pagination">
        <span>Page ${escapeHtml(page.currentPage)} of ${escapeHtml(page.totalPages)} · Showing ${escapeHtml(page.startRow)}-${escapeHtml(page.endRow)} of ${escapeHtml(page.totalRows)} period week rows</span>
        <div class="button-row">
          <button type="button" class="secondary" data-action="period-page-prev" ${page.currentPage <= 1 ? 'disabled' : ''}>Previous</button>
          <button type="button" class="secondary" data-action="period-page-next" ${page.currentPage >= page.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <caption>Comparable week review and manual override editor</caption>
          <thead>
            <tr>
              <th>${escapeHtml(labels.periodLens)}</th>
              <th>${escapeHtml(labels.comparisonSide)}</th>
              <th>${escapeHtml(labels.comparableSlot)}</th>
              <th>Financial Year</th>
              <th>${escapeHtml(labels.fiscalWeek)}</th>
              <th>${escapeHtml(labels.fiscalMonth)}</th>
              <th>Week Ending</th>
              <th>${escapeHtml(labels.weeklyMetricValue)}</th>
              <th>${escapeHtml(labels.sourceDataStatus)}</th>
              <th>${escapeHtml(labels.tradingExpectation)}</th>
              <th>${escapeHtml(labels.manualCoverageAdjustment)}</th>
              <th>${escapeHtml(labels.coverageDecision)}</th>
              <th>${escapeHtml(labels.finalCcmOutcome)}</th>
              <th>${escapeHtml(labels.outcomeReason)}</th>
              <th>${escapeHtml(labels.alignmentImpact)}</th>
            </tr>
          </thead>
          <tbody>
            ${page.rows.map((row) => renderPeriodTableRow(row)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPeriodTableRow(row) {
    const override = manualOverrideForWeek(row.week_ending);
    const contextAttributes = periodContextAttributes(row);
    const overrideDisabled = singleOverrideScope() ? '' : 'disabled';
    return `
      <tr>
        <td>${escapeHtml(row.period_type)}</td>
        <td>${escapeHtml(row.comparison_side)}</td>
        <td>${escapeHtml(row.comparable_week_slot)}</td>
        <td>${escapeHtml(row.financial_year || '-')}</td>
        <td>${escapeHtml(row.week_of_year)}</td>
        <td>${escapeHtml(row.month_of_year)}</td>
        <td>${escapeHtml(row.week_ending)}</td>
        <td>${escapeHtml(row.source_value ?? '-')}</td>
        <td>${escapeHtml(row.source_data_exists ?? 'Unknown')}</td>
        <td>${escapeHtml(row.system_include_flag)}</td>
        <td>
          <button type="button" class="chip" data-action="toggle-override" data-week-ending="${escapeAttribute(row.week_ending)}" ${contextAttributes} ${overrideDisabled}>${escapeHtml(override.manual_include_flag)}</button>
        </td>
        <td>${escapeHtml(row.effective_include_flag)}</td>
        <td>${escapeHtml(row.final_include_flag)}</td>
        <td><input class="reason-input" data-action="edit-override-reason" data-week-ending="${escapeAttribute(row.week_ending)}" ${contextAttributes} value="${escapeAttribute(displayOutcomeReason(row, override))}" ${overrideDisabled} /></td>
        <td>${escapeHtml(propagationImpact(row))}</td>
      </tr>
    `;
  }

  function bindEvents() {
    bindAll('refresh-source', 'click', refreshSource);
    root.querySelector('[data-action="select-store"]')?.addEventListener('change', (event) => updateSelection({ storeCode: event.target.value }));
    root.querySelector('[data-action="select-metrics"]')?.addEventListener('change', (event) => {
      const selectedValues = Array.from(event.target.selectedOptions || []).map((option) => option.value).filter(Boolean);
      const allMetricsSelected = selectedValues.includes(ALL_METRICS_VALUE);
      const hadAllMetrics = state.selectedMetrics.includes(ALL_METRICS_VALUE);

      if (allMetricsSelected && !hadAllMetrics) {
        updateSelection({ metrics: [ALL_METRICS_VALUE] });
      } else if (allMetricsSelected && hadAllMetrics && selectedValues.length > 1) {
        const withoutAll = selectedValues.filter((v) => v !== ALL_METRICS_VALUE);
        updateSelection({ metrics: withoutAll });
      } else if (!allMetricsSelected && selectedValues.length === 0 && hadAllMetrics) {
        updateSelection({ metrics: [ALL_METRICS_VALUE] });
      } else {
        updateSelection({ metrics: selectedValues.length ? selectedValues : [ALL_METRICS_VALUE] });
      }
    });
    root.querySelector('[data-action="select-period-type"]')?.addEventListener('change', (event) => {
      state.selectedPeriodType = event.target.value;
      state.periodPage = 1;
      state.status = state.selectedPeriodType
        ? `Period filter set to: ${state.selectedPeriodType}. Override Editor shows only this period type.`
        : 'Showing all period types in Override Editor.';
      render();
    });
    bindAll('save-overrides', 'click', saveOverrides);
    bindAll('generate-mask', 'click', generateMask);
    bindAll('run-l4l-workflow', 'click', runL4LWorkflow);
    bindAll('refresh-l4l-results', 'click', refreshL4LResults);
    bindAll('toggle-l4l-coverage', 'click', () => setL4LCoverageMode(!state.l4lComparableCoverageOn));
    bindAll('open-layer-stage', 'click', openLayerStage);
    bindAll('confirm-stage', 'click', (event) => {
      const stageId = event.currentTarget?.dataset?.stageId || '';
      handleConfirmStage(stageId);
    });
    bindAll('start-new-run', 'click', startNewRun);
    bindAll('change-scope', 'click', changeScope);
    bindAll('toggle-diagnostics', 'click', toggleDiagnostics);
    bindAll('close-diagnostics', 'click', closeDiagnostics);
    root.querySelector('[data-action="complete-execution-modal"]')?.addEventListener('click', completeExecutionModal);
    root.querySelector('[data-action="close-execution-modal"]')?.addEventListener('click', closeExecutionModal);
    root.querySelector('[data-action="confirm-appdb-write"]')?.addEventListener('click', confirmAppDbWrite);
    root.querySelector('[data-action="cancel-appdb-write"]')?.addEventListener('click', cancelAppDbWrite);
    root.querySelectorAll('[data-action="set-evidence-tab"]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeEvidenceTab = button.dataset.tab || 'excluded';
        render();
      });
    });
    root.querySelector('[data-action="filter-excluded-side"]')?.addEventListener('change', (event) => {
      state.excludedFilters.side = event.target.value;
      render();
    });
    root.querySelector('[data-action="filter-excluded-reason"]')?.addEventListener('change', (event) => {
      state.excludedFilters.reason = event.target.value;
      render();
    });
    root.querySelector('[data-action="toggle-manual-only"]')?.addEventListener('click', () => {
      state.excludedFilters.manualOnly = !state.excludedFilters.manualOnly;
      render();
    });
    root.querySelector('[data-action="toggle-week53-only"]')?.addEventListener('click', () => {
      state.excludedFilters.week53Only = !state.excludedFilters.week53Only;
      render();
    });
    root.querySelector('[data-action="period-page-prev"]')?.addEventListener('click', () => {
      state.periodPage = Math.max(1, state.periodPage - 1);
      render();
    });
    root.querySelector('[data-action="period-page-next"]')?.addEventListener('click', () => {
      state.periodPage += 1;
      render();
    });
    root.querySelectorAll('[data-action="toggle-override"]').forEach((button) => {
      button.addEventListener('click', () => {
        toggleManualOverride(button.dataset.weekEnding, periodContextFromDataset(button.dataset));
        state.reviewConfirmed = false;
        render();
      });
    });

    root.querySelectorAll('[data-action="edit-override-reason"]').forEach((input) => {
      input.addEventListener('change', () => {
        updateManualOverride(input.dataset.weekEnding, { manual_reason: input.value }, periodContextFromDataset(input.dataset));
        state.reviewConfirmed = false;
        state.status = 'Manual coverage adjustment reason updated locally.';
        render();
      });
    });

    root.querySelectorAll('[data-action="edit-override-note"]').forEach((input) => {
      input.addEventListener('change', () => {
        updateManualOverride(input.dataset.weekEnding, { manual_note: input.value }, periodContextFromDataset(input.dataset));
        state.reviewConfirmed = false;
        state.status = 'Manual coverage adjustment note updated locally.';
        render();
      });
    });
  }

  function bindAll(action, eventName, handler) {
    root.querySelectorAll(`[data-action="${action}"]`).forEach((element) => {
      element.addEventListener(eventName, handler);
    });
  }

  function openLayerStage(event) {
    const layerId = event.currentTarget?.dataset?.layerId || '';
    const stage = layerStages().find((item) => item.id === layerId);
    if (!stage) return;

    state.activeLayerId = stage.id;
    state.status = stage.status === 'locked'
      ? `${stage.title} is locked. Complete earlier stages first.`
      : `${stage.title} is in focus.`;
    render();
  }

  function openWorkflowStep(event) {
    const stepId = event.currentTarget?.dataset?.stepId || '';
    if (stepId) {
      state.activeLayerId = stepId;
      state.status = 'Navigated to selected stage.';
      render();
      return;
    }
    openLayerStage(event);
  }

  function changeScope() {
    state.activeLayerId = LAYER_STAGE_IDS.comparableCoverage;
    state.status = 'Choose a Store and Metric in the active work area. All six period types are generated automatically.';
    render();
  }

  function startNewRun() {
    state.reviewConfirmed = false;
    state.comparisonRefreshPending = false;
    state.workflowCompletedAt = '';
    state.scopeDirty = false;
    state.pendingWrite = null;
    state.lastRun = null;
    state.workflowProgress = null;
    state.executionModal = null;
    state.l4lRows = [];
    state.l4lValidation = { valid: true, missingFields: [] };
    state.l4lSource = 'none';
    state.l4lMessage = 'Select Store and Metric in Stage 1, then proceed through each stage.';
    state.activeLayerId = LAYER_STAGE_IDS.calendar;
    state.activeEvidenceTab = 'excluded';
    state.stageConfirmed = {
      calendar: false,
      trading: false,
      metricCoverage: false,
      comparableCoverage: false,
      presentation: false
    };
    state.stepAcknowledged = {
      mask: false,
      workflow: false
    };
    state.stepCompletion = {
      mask: false
    };
    state.validationSummary = null;
    state.status = 'New run started. Select Store and Metric in Stage 1, then confirm each stage sequentially.';
    render();
  }

  async function refreshSource() {
    setLoading('Refreshing source profile...');
    try {
      const sourceResult = await profileSource();
      const periods = derivePeriodDefinitions(sourceResult.rows);
      state.sourceRows = sourceResult.rows;
      state.sourceMode = sourceResult.source;
      state.sourceProfile = sourceResult.profile;
      state.periodRows = periods.rows;
      state.periodPage = 1;
      state.reviewConfirmed = false;
      state.activeLayerId = LAYER_STAGE_IDS.comparableCoverage;
      if (!state.selectedStoreCode) state.selectedStoreCode = sourceResult.profile?.stores?.[0]?.store_code || '';
      state.selectedMetrics = resolveMetrics(sourceResult.profile, state.selectedMetrics, state.selectedMetric);
      state.selectedMetric = state.selectedMetrics[0] || '';
      if (!state.selectedPeriodType) state.selectedPeriodType = periods.rows[0]?.period_type || '';
      state.manualOverrides = await loadOverridesForSelection();
      state.diagnostics = mergeDiagnostics(state.diagnostics, sourceResult.diagnostics);
      state.status = 'Source profile refreshed.';
      state.error = '';
    } catch (error) {
      state.error = readableError(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  async function generateMask() {
    if (!state.reviewConfirmed) {
      state.error = 'Save Overrides to confirm Comparable Week Review before building the selected-scope mask.';
      render();
      return;
    }

    const runId = createRunId();
    const generatedAt = new Date().toISOString();
    const stores = selectedStores();
    const store = selectedStore();
    const metrics = selectedMetricList();
    const generationPeriodRows = allPeriodRowsForGeneration();
    const scopeSummary = selectedScopeSummary();
    const maskRows = generateMaskRows({
      stores,
      metrics,
      periodRows: generationPeriodRows,
      manualOverrides: state.manualOverrides,
      runId,
      generatedAt,
      generationMode: 'SELECTED_SCOPE',
      outputCollection: COLLECTIONS.selectedScopeMask
    });
    const runRecord = buildRunRecord({
      runId,
      startedAt: generatedAt,
      status: 'pending_confirmation',
      profile: state.sourceProfile,
      periodRows: generationPeriodRows,
      maskRows,
      generationMode: 'SELECTED_SCOPE',
      selectedStore: selectedStoreValueForRun(),
      selectedMetric: selectedMetricValueForRun(),
      selectedPeriodType: 'All period types',
      outputCollection: COLLECTIONS.selectedScopeMask,
      rebuildStatus: 'pending_confirmation'
    });
    const summary = buildValidationSummary({
      runId,
      profile: state.sourceProfile,
      periodRows: generationPeriodRows,
      maskRows,
      selectedStore: selectedScopeSummaryStore(),
      selectedMetric: singleMetricSelection() ? selectedMetricList()[0] : '',
      selectedStoreLabel: selectedStoreValueForRun(),
      selectedMetricLabel: selectedMetricValueForRun(),
      selectedStoreCodes: selectedStores().map((item) => item.store_code),
      selectedMetrics: selectedMetricList(),
      selectedPeriodType: 'All period types',
      selectedScopeSummary: scopeSummary,
      generationMode: 'SELECTED_SCOPE',
      outputCollection: COLLECTIONS.selectedScopeMask,
      maskRowsDeleted: 0,
      maskRowsInserted: 0,
      rebuildStatus: 'pending_confirmation'
    });

    state.validationSummary = summary;
    state.lastRun = { runRecord, maskRows };
    state.pendingWrite = {
      runId,
      maskRowCount: maskRows.length,
      touchedCollections: [
        COLLECTIONS.selectedScopeMask,
        COLLECTIONS.generationRuns
      ],
      generationMode: 'SELECTED_SCOPE',
      outputCollection: COLLECTIONS.selectedScopeMask,
      selectedStore: selectedStoreValueForRun(),
      selectedMetric: selectedMetricValueForRun(),
      selectedPeriodType: 'All period types'
    };
    state.status = `Review the selected-scope rebuild confirmation for ${runId}.`;
    render();
  }

  function cancelAppDbWrite() {
    state.pendingWrite = null;
    state.status = 'Selected-scope rebuild cancelled. No AppDB records were changed.';
    render();
  }

  async function confirmAppDbWrite() {
    if (!state.lastRun) {
      state.pendingWrite = null;
      state.error = 'No generated mask run is available to write.';
      render();
      return;
    }

    const { runRecord, maskRows } = state.lastRun;
    state.pendingWrite = null;
    state.loading = true;
    state.executionModal = {
      type: 'mask',
      status: 'running',
      currentStage: 2,
      message: `Clearing and rebuilding ${maskRows.length} selected-scope comparable week records...`
    };
    state.status = `Rebuilding selected-scope mask output for ${runRecord.run_id}.`;
    render();
    try {
      state.executionModal = {
        ...state.executionModal,
        currentStage: 3,
        message: `Writing ${maskRows.length} selected-scope mask record(s)...`
      };
      render();
      const result = await writeMaskRun({ runRecord, maskRows, dryRun: false });
      state.validationSummary = {
        ...state.validationSummary,
        mask_rows_deleted: result.maskRowsDeleted,
        mask_rows_inserted: result.maskRowsInserted,
        output_collection: result.runRecord.output_collection,
        rebuild_status: result.runRecord.rebuild_status
      };
      state.stepCompletion.mask = true;
      state.stepAcknowledged.mask = false;
      state.stepAcknowledged.workflow = false;
      state.activeLayerId = LAYER_STAGE_IDS.comparableCoverage;
      state.scopeDirty = false;
      state.l4lRows = [];
      state.l4lValidation = { valid: true, missingFields: [] };
      state.l4lMessage = 'Run the Workflow to prepare comparison facts for the rebuilt mask.';
      state.status = `Run ${runRecord.run_id} rebuilt selected-scope mask output.`;
      state.error = '';
      state.executionModal = {
        type: 'mask',
        status: 'success',
        currentStage: 5,
        message: 'Selected-scope mask rebuild completed.',
        resultSummary: `${result.maskRowsInserted} mask record(s) written after clearing ${result.maskRowsDeleted} existing selected-scope record(s).`
      };
    } catch (error) {
      state.error = `Blocked during AppDB write: ${readableError(error)}`;
      state.validationSummary = {
        ...state.validationSummary,
        rebuild_status: readableError(error).includes('clear') ? 'clear_failed' : 'failed'
      };
      state.status = 'Selected-scope rebuild failed. No fallback collection changes were attempted.';
      state.executionModal = {
        type: 'mask',
        status: 'error',
        currentStage: 3,
        message: 'Selected-scope mask rebuild failed.',
        errorMessage: readableError(error)
      };
    } finally {
      state.loading = false;
      render();
    }
  }

  async function updateSelection({
    storeCode = state.selectedStoreCode,
    metric = state.selectedMetric,
    metrics = selectedMetricList()
  } = {}) {
    const nextMetrics = Array.isArray(metrics) && metrics.length ? metrics : [metric].filter(Boolean);
    if (storeCode !== state.selectedStoreCode || nextMetrics.join('|') !== selectedMetricList().join('|')) {
      markScopeChanged();
      state.reviewConfirmed = false;
    }
    state.selectedStoreCode = storeCode;
    state.selectedMetrics = nextMetrics;
    state.selectedMetric = nextMetrics[0] || '';
    state.periodPage = 1;
    state.pendingWrite = null;
    invalidateScopeCache();
    state.loading = true;
    state.status = 'Loading manual coverage adjustments for selected Store and Metric...';
    render();

    try {
      state.manualOverrides = await loadOverridesForSelection();
      state.status = `Loaded manual coverage adjustments for ${selectedStoreDisplay()} / ${selectedMetricDisplay()}.`;
      state.error = '';
    } catch (error) {
      state.error = readableError(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  function markScopeChanged() {
    invalidateScopeCache();
    const hasGeneratedContext = state.stepCompletion.mask || state.stepAcknowledged.mask || state.stepAcknowledged.workflow || state.l4lRows.length;
    state.reviewConfirmed = false;
    if (!hasGeneratedContext) return;

    state.scopeDirty = true;
    // Do NOT auto-navigate — user stays on current stage
    state.stepCompletion.mask = false;
    state.stepAcknowledged.mask = false;
    state.stepAcknowledged.workflow = false;
    state.l4lRows = [];
    state.l4lValidation = { valid: true, missingFields: [] };
    state.l4lMessage = 'Scope changed. Rebuild the selected-scope mask before preparing comparison facts.';
    state.status = 'Scope changed. Rebuild the selected-scope mask before running the Workflow.';
  }

  async function loadOverridesForSelection() {
    if (!state.selectedStoreCode || !selectedMetricList().length) return [];

    // Fast path: skip AppDB call in mock mode to avoid 404 timeout
    if (state.sourceMode === 'mock' || state.diagnostics?.source?.queryable === false) {
      invalidateScopeCache();
      state.diagnostics = mergeDiagnostics(state.diagnostics, {
        appDb: {
          reachable: false,
          source: 'mock (local fallback)',
          collections: Object.values(COLLECTIONS),
          message: 'Local mock mode — AppDB is not available. Manual overrides are stored in memory only.'
        }
      });
      return state.manualOverrides.length ? state.manualOverrides : [];
    }

    try {
      const overrides = await loadManualOverridesForScope({
        storeCodes: selectedStores().map((store) => store.store_code),
        metrics: selectedMetricList()
      });
      state.diagnostics = mergeDiagnostics(state.diagnostics, {
        appDb: {
          reachable: true,
          source: COLLECTIONS.metricWeekOverrides,
          collections: Object.values(COLLECTIONS),
          message: 'Manual coverage adjustment collection is reachable.'
        }
      });
      return overrides;
    } catch (error) {
      console.warn(`Using empty manual coverage adjustments because AppDB is unavailable: ${readableError(error)}`);
      state.diagnostics = mergeDiagnostics(state.diagnostics, {
        appDb: {
          reachable: false,
          source: 'local',
          collections: Object.values(COLLECTIONS),
          errorStatus: getErrorStatus(error),
          errorMessage: readableError(error),
          message: 'Manual coverage adjustment collection is not reachable; default Y is active.'
        }
      });
      return [];
    }
  }

  async function saveOverrides() {
    const store = selectedStore();
    if (!scopeSelectionReady()) {
      state.error = 'Select a Store and at least one Metric before saving overrides.';
      render();
      return;
    }

    if (!singleOverrideScope()) {
      state.reviewConfirmed = true;
      invalidateScopeCache();
      state.activeLayerId = LAYER_STAGE_IDS.comparableCoverage;
      state.status = `Comparable Week Review confirmed for ${selectedStoreDisplay()} / ${selectedMetricDisplay()}. Existing active overrides will be applied during mask generation.`;
      state.error = '';
      render();
      return;
    }

    setLoading(`Saving manual coverage adjustments for ${store.store_code} / ${selectedMetricList()[0]}...`);
    try {
      const result = await saveManualOverrides({
        store,
        metric: selectedMetricList()[0],
        overrides: state.manualOverrides,
        updatedBy: 'Domo app user'
      });
      state.manualOverrides = await loadOverridesForSelection();
      state.reviewConfirmed = true;
      invalidateScopeCache();
      state.activeLayerId = LAYER_STAGE_IDS.comparableCoverage;
      state.status = `Saved ${result.savedCount} manual coverage adjustment document(s).`;
      state.error = '';
    } catch (error) {
      state.error = `Blocked while saving manual coverage adjustments: ${readableError(error)}`;
      state.status = 'Manual coverage adjustment save failed.';
    } finally {
      state.loading = false;
      render();
    }
  }

  async function runL4LWorkflow() {
    if (!state.stepAcknowledged.mask) {
      state.error = 'Build the selected-scope mask and click Complete before running the Workflow.';
      render();
      return;
    }

    state.loading = true;
    state.workflowProgress = {
      phase: 'starting',
      status: 'STARTING',
      attempt: 0,
      maxPollAttempts: 60,
      percent: 0
    };
    state.executionModal = {
      type: 'workflow',
      status: 'running',
      currentStage: 1,
      message: 'Starting prepareL4LFacts through the mapped Domo Workflow alias.'
    };
    state.status = 'Running Prepare L4L Comparison Facts Workflow...';
    render();
    try {
      const result = await runPrepareL4LWorkflow({
        onProgress: (progress) => {
          state.workflowProgress = progress;
          state.executionModal = {
            type: 'workflow',
            status: 'running',
            currentStage: workflowStageFromProgress(progress),
            message: workflowProgressMessage(progress)
          };
          render();
        }
      });
      if (result.status === 'COMPLETED') {
        state.comparisonRefreshPending = true;
        state.workflowCompletedAt = new Date().toISOString();
        state.l4lRows = [];
        state.l4lValidation = { valid: true, missingFields: [] };
        state.l4lMessage = 'Workflow completed. Domo may still be refreshing the output dataset. Click Refresh Results after the Domo dataset refresh completes.';
        state.stepAcknowledged.workflow = false;
        state.activeStepId = 'workflow';
        state.status = state.l4lMessage;
        state.error = '';
        state.executionModal = {
          type: 'workflow',
          status: 'success',
          currentStage: 5,
          message: 'Prepare L4L Comparison Facts completed. Domo may still be refreshing the output dataset.',
          resultSummary: 'Click Refresh Results after the Domo dataset refresh completes. The app will not show previous-run comparison rows as new output.'
        };
      } else {
        state.status = result.message;
        state.executionModal = {
          type: 'workflow',
          status: ['START_FAILED', 'FAILED', 'CANCELED'].includes(result.status) ? 'error' : 'success',
          currentStage: ['START_FAILED', 'FAILED', 'CANCELED'].includes(result.status) ? 1 : 2,
          message: result.message,
          errorMessage: ['START_FAILED', 'FAILED', 'CANCELED'].includes(result.status) ? result.message : ''
        };
      }
      state.l4lMessage = state.comparisonRefreshPending ? state.l4lMessage : result.message;
      if (['START_FAILED', 'FAILED', 'CANCELED'].includes(result.status)) {
        state.error = result.message;
      } else {
        state.error = '';
      }
    } catch (error) {
      state.error = `Workflow trigger failed: ${readableError(error)}`;
      state.executionModal = {
        type: 'workflow',
        status: 'error',
        currentStage: 1,
        message: 'Workflow trigger failed.',
        errorMessage: readableError(error)
      };
    } finally {
      state.loading = false;
      render();
    }
  }

  async function refreshL4LResults() {
    state.loading = true;
    state.executionModal = {
      type: 'refresh',
      status: 'running',
      currentStage: 0,
      message: 'Refreshing L4L comparison results through the mapped dataset alias.'
    };
    state.status = 'Refreshing L4L comparison results...';
    render();
    try {
      const result = await loadComparisonRows();
      state.executionModal = {
        type: 'refresh',
        status: 'running',
        currentStage: 2,
        message: 'Validating comparison rows and recalculating L4L summaries.'
      };
      render();
      applyL4LResult(result);
      state.status = result.empty && state.comparisonRefreshPending
        ? 'Domo dataset refresh is not visible yet. Wait a few seconds, then click Refresh Results again.'
        : result.empty ? result.message : `Loaded ${result.rows.length} L4L comparison fact row(s).`;
      if (result.empty && state.comparisonRefreshPending) {
        state.l4lMessage = state.status;
      }
      state.error = '';
      if (!result.empty && result.rows.length) {
        state.comparisonRefreshPending = false;
        state.stepAcknowledged.workflow = true;
        state.activeLayerId = LAYER_STAGE_IDS.presentation;
      } else {
        state.activeStepId = 'workflow';
      }
      state.executionModal = {
        type: 'refresh',
        status: 'success',
        currentStage: 3,
        title: result.empty ? 'No Results Yet' : 'Results Refreshed',
        message: result.empty ? 'No L4L comparison results are available yet.' : 'L4L comparison results refreshed.',
        resultSummary: result.empty ? result.message : `Loaded ${result.rows.length} L4L comparison fact row(s).`,
        completeLabel: result.empty ? 'Complete and Stay on Workflow' : 'Complete and Review Results'
      };
    } catch (error) {
      state.error = `Unable to refresh L4L comparison results: ${readableError(error)}`;
      state.executionModal = {
        type: 'refresh',
        status: 'error',
        currentStage: 0,
        message: 'L4L comparison result refresh failed.',
        errorMessage: readableError(error)
      };
    } finally {
      state.loading = false;
      render();
    }
  }

  function applyL4LResult(result) {
    state.l4lRows = result.rows || [];
    state.l4lSource = result.source || 'unknown';
    state.l4lValidation = result.validation || { valid: true, missingFields: [] };
    state.l4lDiagnostics = result.diagnostics || state.l4lDiagnostics;
    state.l4lMessage = result.message || state.l4lDiagnostics?.message || '';
  }

  function setL4LCoverageMode(comparableCoverageOn) {
    state.l4lComparableCoverageOn = comparableCoverageOn;
    state.status = comparableCoverageOn
      ? 'Comparable Coverage set to L4L ON.'
      : 'Comparable Coverage set to L4L OFF.';
    render();
  }

  function completeExecutionModal() {
    if (state.executionModal?.type === 'mask') {
      if (!state.stepAcknowledged) state.stepAcknowledged = {};
      state.stepAcknowledged.mask = true;
      state.stepAcknowledged.ccm = true;
      state.stageConfirmed.comparableCoverage = true;
      state.activeLayerId = LAYER_STAGE_IDS.presentation;
      state.status = 'Coverage mask is ready. Review results in the Presentation layer.';
    }

    if (state.executionModal?.type === 'workflow') {
      if (!state.stepAcknowledged) state.stepAcknowledged = {};
      state.stepAcknowledged.workflow = true;
      state.stepAcknowledged.presentation = true;
      state.stageConfirmed.presentation = true;
      state.activeLayerId = LAYER_STAGE_IDS.presentation;
      state.status = state.comparisonRefreshPending
        ? 'Workflow completed. Domo may still be refreshing the output dataset. Click Refresh Results after the Domo dataset refresh completes.'
        : state.l4lRows.length
          ? 'Comparison facts are ready. Review L4L results next.'
          : 'Workflow completed. Refresh Results when the comparison dataset is available.';
    }

    if (state.executionModal?.type === 'refresh') {
      state.activeLayerId = LAYER_STAGE_IDS.presentation;
      state.status = state.l4lRows.length
        ? 'L4L comparison results are ready.'
        : state.l4lMessage || 'Refresh completed.';
    }

    state.executionModal = null;
    render();
  }

  function closeExecutionModal() {
    state.executionModal = null;
    render();
  }

  function toggleDiagnostics() {
    state.diagnosticsOpen = !state.diagnosticsOpen;
    render();
  }

  function closeDiagnostics() {
    state.diagnosticsOpen = false;
    render();
  }

  function selectedStore() {
    if (state.selectedStoreCode === ALL_STORES_VALUE) return null;
    return (state.sourceProfile?.stores || []).find((store) => store.store_code === state.selectedStoreCode) || null;
  }

  function selectedStores() {
    const stores = state.sourceProfile?.stores || [];
    if (state.selectedStoreCode === ALL_STORES_VALUE) return stores;
    return selectedStore() ? [selectedStore()] : [];
  }

  function selectedStoreDisplay() {
    if (state.selectedStoreCode === ALL_STORES_VALUE) return 'All Stores';
    const store = selectedStore();
    if (!store) return '-';
    return `${store.store_code}${store.store_name ? ` - ${store.store_name}` : ''}`;
  }

  function selectedStoreValueForRun() {
    return state.selectedStoreCode === ALL_STORES_VALUE ? 'All Stores' : selectedStore()?.store_code || '';
  }

  function selectedScopeSummaryStore() {
    if (state.selectedStoreCode !== ALL_STORES_VALUE) return selectedStore();
    return { store_code: 'All Stores', store_name: 'All Stores', region: '', store_trading_commencement_date: 'MULTI', store_closure_date: '' };
  }

  function selectedMetricList() {
    const metrics = (Array.isArray(state.selectedMetrics) && state.selectedMetrics.length)
      ? state.selectedMetrics
      : [state.selectedMetric].filter(Boolean);
    if (metrics.includes(ALL_METRICS_VALUE)) {
      return (state.sourceProfile?.metrics || []).map((item) => item.metric).filter(Boolean);
    }
    return metrics;
  }

  function selectedMetricDisplay() {
    if (state.selectedMetrics.includes(ALL_METRICS_VALUE)) return 'All Metrics';
    const metrics = selectedMetricList();
    if (!metrics.length) return '-';
    if (metrics.length === 1) return metrics[0];
    return `${metrics.length} metrics selected`;
  }

  function selectedMetricValueForRun() {
    const metrics = selectedMetricList();
    return metrics.length <= 3 ? metrics.join(', ') : `${metrics.length} metrics selected`;
  }

  function singleMetricSelection() {
    return !state.selectedMetrics.includes(ALL_METRICS_VALUE) && selectedMetricList().length === 1;
  }

  function singleOverrideScope() {
    return state.selectedStoreCode !== ALL_STORES_VALUE && Boolean(selectedStore()) && singleMetricSelection();
  }

  function scopeSelectionReady() {
    return Boolean(state.selectedStoreCode && selectedMetricList().length);
  }

  function selectedPeriodRows() {
    return state.periodRows.filter((row) => !state.selectedPeriodType || row.period_type === state.selectedPeriodType);
  }

  function allPeriodRowsForGeneration() {
    return state.periodRows;
  }

  let _cachedSummary = null;
  let _cachedReviewRows = null;
  let _cacheKey = '';

  function scopeCacheKey() {
    return [
      state.selectedStoreCode,
      selectedMetricList().join(','),
      state.selectedPeriodType || '',
      state.reviewConfirmed ? '1' : '0',
      state.manualOverrides.length,
      state.periodRows.length
    ].join('|');
  }

  function invalidateScopeCache() {
    _cachedSummary = null;
    _cachedReviewRows = null;
    _cacheKey = '';
  }

  function selectedScopeSummary() {
    const key = scopeCacheKey();
    if (_cachedSummary && _cacheKey === key) return _cachedSummary;

    _cachedReviewRows = computeReviewRows(selectedPeriodRows());
    _cachedSummary = computeSelectedScopeSummary({
      sourceRows: state.sourceRows,
      sourceFacts: state.sourceProfile?.sourceFacts,
      selectedStore: selectedStore(),
      selectedStores: selectedStores(),
      selectedMetric: singleMetricSelection() ? selectedMetricList()[0] : '',
      selectedMetrics: selectedMetricList(),
      selectedPeriodType: state.selectedPeriodType,
      periodRows: state.periodRows,
      manualOverrides: state.manualOverrides,
      maskRows: _cachedReviewRows
    });
    _cacheKey = key;
    return _cachedSummary;
  }

  function reviewRowsForRows(periodRows) {
    const key = scopeCacheKey();
    if (_cachedReviewRows && _cacheKey === key) return _cachedReviewRows;
    const store = selectedStore();
    if (!store || !singleMetricSelection()) return [];
    _cachedReviewRows = computeReviewRows(periodRows);
    _cacheKey = key;
    return _cachedReviewRows;
  }

  function computeReviewRows(periodRows) {
    const store = selectedStore();
    if (!store || !singleMetricSelection()) return [];

    const rows = state.selectedPeriodType
      ? periodRows.filter((row) => row.period_type === state.selectedPeriodType)
      : periodRows;

    return generateMaskRows({
      stores: [store],
      metrics: selectedMetricList(),
      periodRows: rows,
      manualOverrides: state.manualOverrides,
      runId: 'review',
      generatedAt: ''
    }).map((row) => {
      const sourceFact = sourceFactForWeek(row.week_ending);
      return {
        ...row,
        source_value: sourceFact?.source_value ?? null,
        source_data_exists: sourceFact?.source_data_exists ?? 'Unknown'
      };
    });
  }

  function manualOverrideForWeek(weekEnding) {
    if (!singleOverrideScope()) {
      return {
        store_code: '',
        metric: '',
        week_ending: weekEnding,
        manual_include_flag: FLAGS.yes,
        manual_reason: '',
        manual_note: ''
      };
    }

    return state.manualOverrides.find((override) => override.week_ending === weekEnding) || {
      store_code: state.selectedStoreCode,
      metric: selectedMetricList()[0],
      week_ending: weekEnding,
      manual_include_flag: FLAGS.yes,
      manual_reason: '',
      manual_note: ''
    };
  }

  function sourceFactForWeek(weekEnding) {
    return getSourceFactForScope({
      sourceRows: state.sourceRows,
      sourceFacts: state.sourceProfile?.sourceFacts,
      storeCode: state.selectedStoreCode,
      metric: selectedMetricList()[0],
      weekEnding
    });
  }

  function propagationImpact(row) {
    if (row.final_reason_code === 'WEEK_53_EXCLUDED') return displayText.week53AlignmentImpact;
    if (row.final_reason_code === 'STORE_METRIC_WEEK_PROPAGATED_EXCLUSION') return 'Same Store + Metric + Week excluded elsewhere';
    if (row.final_reason_code === 'PAIRED_SLOT_EXCLUSION') return 'Current/prior paired slot excluded';
    if (row.final_include_flag === FLAGS.no) return 'Direct exclusion';
    return 'None';
  }

  function l4lPropagationImpact(row) {
    if (row.final_reason_code === 'WEEK_53_EXCLUDED') return 'Automatically excluded from comparable week alignment';
    if (row.final_reason_code === 'STORE_METRIC_WEEK_PROPAGATED_EXCLUSION') return 'Same Store + Metric + Week excluded elsewhere';
    if (row.final_reason_code === 'PAIRED_SLOT_EXCLUSION') return 'Current/prior paired slot excluded';
    if (row.mask_include_flag === FLAGS.no || row.final_include_flag === FLAGS.no) return 'Excluded from L4L ON';
    return 'Included';
  }

  function displayOutcomeReason(row, override) {
    if (row.final_reason_code === 'WEEK_53_EXCLUDED') return displayText.week53OutcomeReason;
    return override.manual_reason || row.final_reason_code || '';
  }

  function periodContextAttributes(row) {
    return [
      ['periodType', row.period_type],
      ['comparisonSide', row.comparison_side],
      ['comparableWeekSlot', row.comparable_week_slot],
      ['financialYear', row.financial_year],
      ['weekOfYear', row.week_of_year],
      ['monthOfYear', row.month_of_year]
    ].map(([key, value]) => `data-${kebabCase(key)}="${escapeAttribute(value ?? '')}"`).join(' ');
  }

  function periodContextFromDataset(dataset) {
    return {
      period_type: dataset.periodType || '',
      comparison_side: dataset.comparisonSide || '',
      comparable_week_slot: numberOrNull(dataset.comparableWeekSlot),
      financial_year: dataset.financialYear || '',
      week_of_year: numberOrNull(dataset.weekOfYear),
      month_of_year: numberOrNull(dataset.monthOfYear)
    };
  }

  function toggleManualOverride(weekEnding, context = {}) {
    const current = manualOverrideForWeek(weekEnding);
    const nextFlag = current.manual_include_flag === FLAGS.no ? FLAGS.yes : FLAGS.no;
    updateManualOverride(weekEnding, {
      manual_include_flag: nextFlag,
      manual_reason: nextFlag === FLAGS.no ? current.manual_reason || 'Manual exclusion' : current.manual_reason
    }, context);
    state.status = `Manual include for ${weekEnding} set to ${nextFlag}.`;
  }

  function updateManualOverride(weekEnding, patch, context = {}) {
    const existing = manualOverrideForWeek(weekEnding);
    const next = {
      ...existing,
      ...context,
      ...patch,
      store_code: state.selectedStoreCode,
      metric: selectedMetricList()[0] || '',
      week_ending: weekEnding,
      override_scope: 'STORE_METRIC_WEEK'
    };
    const index = state.manualOverrides.findIndex((override) => override.week_ending === weekEnding);

    if (index >= 0) {
      state.manualOverrides = state.manualOverrides.map((override, itemIndex) => (itemIndex === index ? next : override));
      invalidateScopeCache();
      return;
    }

    state.manualOverrides = [...state.manualOverrides, next];
    invalidateScopeCache();
  }

  function setLoading(message) {
    state.loading = true;
    state.status = message;
    render();
  }

  render();
  init();
}

function loadPersistedUiState() {
  if (typeof sessionStorage === 'undefined') return {};

  try {
    return JSON.parse(sessionStorage.getItem(CCM_UI_STATE_STORAGE_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

function persistUiState(state) {
  if (typeof sessionStorage === 'undefined') return;

  try {
    sessionStorage.setItem(CCM_UI_STATE_STORAGE_KEY, JSON.stringify({
      selectedStoreCode: state.selectedStoreCode,
      selectedMetric: state.selectedMetric,
      selectedMetrics: selectedMetricList(),
      selectedPeriodType: state.selectedPeriodType,
      periodPage: state.periodPage,
      reviewConfirmed: state.reviewConfirmed,
      comparisonRefreshPending: state.comparisonRefreshPending,
      workflowCompletedAt: state.workflowCompletedAt,
      scopeDirty: state.scopeDirty,
      status: state.status,
      l4lMessage: state.l4lMessage,
      l4lComparableCoverageOn: state.l4lComparableCoverageOn,
      activeLayerId: state.activeLayerId,
      stageConfirmed: state.stageConfirmed,
      diagnosticsOpen: state.diagnosticsOpen,
      activeEvidenceTab: state.activeEvidenceTab,
      excludedFilters: state.excludedFilters,
      stepAcknowledged: state.stepAcknowledged,
      stepCompletion: state.stepCompletion,
      validationSummary: state.validationSummary
    }));
  } catch (_) {
    // Storage can be unavailable in some embedded browser modes; the app should still run.
  }
}

function resolveStoreCode(profile, preferredStoreCode) {
  const stores = profile?.stores || [];
  if (preferredStoreCode === ALL_STORES_VALUE) return ALL_STORES_VALUE;
  if (stores.some((store) => store.store_code === preferredStoreCode)) return preferredStoreCode;
  return stores[0]?.store_code || '';
}

function resolveMetric(profile, preferredMetric) {
  const metrics = profile?.metrics || [];
  if (metrics.some((item) => item.metric === preferredMetric)) return preferredMetric;
  return metrics[0]?.metric || '';
}

function resolveMetrics(profile, preferredMetrics = [], preferredMetric = '') {
  const available = new Set((profile?.metrics || []).map((item) => item.metric));
  const preferred = [
    ...(Array.isArray(preferredMetrics) ? preferredMetrics : []),
    preferredMetric
  ].filter(Boolean);
  const resolved = Array.from(new Set(preferred)).filter((metric) => available.has(metric));
  if (resolved.length) return resolved;
  const fallback = resolveMetric(profile, preferredMetric);
  return fallback ? [fallback] : [];
}

function resolvePeriodType(periodRows, preferredPeriodType) {
  const periodTypes = unique((periodRows || []).map((row) => row.period_type));
  if (periodTypes.includes(preferredPeriodType)) return preferredPeriodType;
  return periodTypes[0] || '';
}

function initialStatusMessage({
  recoveredAfterDomoRefresh = false,
  l4lRowCount = 0,
  comparisonRefreshPending = false,
  sourceWarning = ''
} = {}) {
  if (recoveredAfterDomoRefresh) {
    return `Domo dataset refresh detected. Loaded ${l4lRowCount} L4L comparison fact row(s).`;
  }

  if (comparisonRefreshPending) {
    return 'Workflow completed. Domo may still be refreshing the output dataset. Click Refresh Results after the Domo dataset refresh completes.';
  }

  if (sourceWarning) return `Source loaded from mock mode: ${sourceWarning}`;
  return 'Source summary loaded.';
}

function metric(label, value, tooltip = '') {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}${tooltip ? ` ${renderInfoTooltip(tooltip)}` : ''}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderInfoTooltip(text) {
  if (!text) return '';
  return `
    <span class="info-tooltip" tabindex="0" aria-label="${escapeAttribute(text)}">
      i
      <span class="tooltip-bubble" role="tooltip">${escapeHtml(text)}</span>
    </span>
  `;
}

function statusBadge(status) {
  const label = statusLabel(status);
  return `<span class="status-badge status-${escapeAttribute(status || 'unknown')}">${escapeHtml(label)}</span>`;
}

function layerStatusLabel(status) {
  if (status === 'ready') return 'Ready';
  if (status === 'running') return 'Active';
  if (status === 'complete') return 'Done';
  if (status === 'completed_unacknowledged') return 'Review';
  if (status === 'error') return 'Error';
  return 'Locked';
}

function statusLabel(status) {
  if (status === 'ready') return 'Ready';
  if (status === 'running') return 'Running';
  if (status === 'complete') return 'Complete';
  if (status === 'completed_unacknowledged') return 'Complete - Acknowledge';
  if (status === 'error') return 'Error';
  if (status === 'success') return 'Complete';
  return 'Locked';
}

function stepStatusIcon(status, number) {
  if (status === 'complete') return '✓';
  if (status === 'completed_unacknowledged') return '!';
  if (status === 'locked') return 'L';
  if (status === 'error') return '!';
  return number;
}

function stageIcon(state) {
  if (state === 'done') return '✓';
  if (state === 'current') return '...';
  if (state === 'error') return '!';
  return '-';
}

function workflowStageFromProgress(progress = {}) {
  const status = String(progress.status || '').toUpperCase();
  if (status === 'COMPLETED') return 3;
  if (['FAILED', 'CANCELED', 'START_FAILED'].includes(status)) return 1;
  if (progress.phase === 'started') return 2;
  if (progress.phase === 'polling') return 2;
  return 1;
}

function workflowProgressMessage(progress = {}) {
  const status = progress.status || 'IN_PROGRESS';
  const pollText = progress.maxPollAttempts
    ? `Poll ${progress.attempt || 0} of ${progress.maxPollAttempts}`
    : 'Starting';
  return `Workflow status ${status}. ${pollText}.`;
}

function flagBadge(value) {
  const flag = String(value || '-').trim().toUpperCase();
  const label = flag === 'Y' ? 'Yes' : flag === 'N' ? 'No' : flag || '-';
  return `<span class="flag-badge flag-${escapeAttribute(flag || 'unknown')}">${escapeHtml(label)}</span>`;
}

function reasonBadge(value) {
  const reason = String(value || '-');
  const isWeek53 = reason === 'WEEK_53_EXCLUDED';
  const isManual = reason.includes('MANUAL');
  const className = isWeek53 ? 'reason-week53' : isManual ? 'reason-manual' : 'reason-default';
  return `<span class="reason-badge ${className}">${escapeHtml(reason)}</span>`;
}

function topOutcomeReason(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const reason = row.final_reason_code || row.system_reason_code || row.manual_reason || 'Unknown';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'None';
}

function renderCountList(title, counts) {
  const entries = Object.entries(counts || {});
  if (!entries.length) return `<p class="note">${escapeHtml(title)}: none.</p>`;
  return `
    <div class="count-list">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${entries.map(([key, count]) => `<li><span>${escapeHtml(key)}</span><strong>${escapeHtml(count)}</strong></li>`).join('')}
      </ul>
    </div>
  `;
}

function renderDiagnosticsPanel(diagnostics) {
  const source = diagnostics?.source || {};
  const appDb = diagnostics?.appDb || {};
  return `
    <section class="diagnostics-panel" aria-label="Application diagnostics">
      <div class="diagnostic-item ${source.queryable ? 'diagnostic-ok' : 'diagnostic-warning'}">
        <span>Source alias</span>
        <strong>${escapeHtml(source.alias || SOURCE_DATASET_ALIAS)}</strong>
        <p>${escapeHtml(source.message || sourceStatusText(source))}</p>
        ${source.errorStatus || source.errorMessage ? `<p class="diagnostic-error">Status ${escapeHtml(source.errorStatus || 'unknown')}: ${escapeHtml(source.errorMessage)}</p>` : ''}
      </div>
      <div class="diagnostic-item ${appDb.reachable ? 'diagnostic-ok' : 'diagnostic-warning'}">
        <span>AppDB collections</span>
        <strong>${escapeHtml(appDb.reachable ? 'Reachable' : 'Fallback')}</strong>
        <p>${escapeHtml(appDb.message || appDbStatusText(appDb))}</p>
        <p class="diagnostic-list">${escapeHtml((appDb.collections || Object.values(COLLECTIONS)).join(', '))}</p>
        ${appDb.errorStatus || appDb.errorMessage ? `<p class="diagnostic-error">Status ${escapeHtml(appDb.errorStatus || 'unknown')}: ${escapeHtml(appDb.errorMessage)}</p>` : ''}
      </div>
    </section>
  `;
}

function renderWriteConfirmation(pendingWrite) {
  return `
    <section class="modal-backdrop" role="presentation">
      <div class="write-confirmation" role="dialog" aria-modal="true" aria-labelledby="write-confirmation-title">
        <h2 id="write-confirmation-title">Confirm Selected Scope Rebuild</h2>
        <p class="note">Existing selected-scope mask records will be cleared and replaced with the selected scope only. Manual coverage adjustments will not be affected. Continue?</p>
        <p class="note">This action writes only to project AppDB collections and does not modify the source dataset.</p>
        <div class="confirm-summary">
          ${metric(labels.generationMode, pendingWrite.generationMode || 'SELECTED_SCOPE')}
          ${metric(labels.outputCollection, pendingWrite.outputCollection || COLLECTIONS.selectedScopeMask)}
          ${metric(labels.selectedStore, pendingWrite.selectedStore || '-')}
          ${metric(labels.selectedMetric, pendingWrite.selectedMetric || '-')}
          ${metric(labels.selectedPeriodLens, pendingWrite.selectedPeriodType || '-')}
          ${metric(labels.runId, pendingWrite.runId)}
          ${metric(labels.comparableWeekRecordsToWrite, pendingWrite.maskRowCount)}
        </div>
        <div class="count-list">
          <h3>Collections touched</h3>
          <ul>
            ${pendingWrite.touchedCollections.map((collectionName) => `<li><span>${escapeHtml(collectionName)}</span><strong>write</strong></li>`).join('')}
          </ul>
        </div>
        <p class="diagnostic-error">${escapeHtml(helperText.selectedScopeClear)} ${escapeHtml(COLLECTIONS.metricWeekOverrides)}, ${escapeHtml(COLLECTIONS.generationRuns)}, and ${escapeHtml(COLLECTIONS.fullMask)} will not be cleared.</p>
        <div class="button-row confirmation-actions">
          <button type="button" class="secondary" data-action="cancel-appdb-write">Cancel</button>
          <button type="button" class="primary danger" data-action="confirm-appdb-write">Confirm Rebuild</button>
        </div>
      </div>
    </section>
  `;
}

function mergeDiagnostics(current, ...updates) {
  return updates.reduce((merged, update) => ({
    ...merged,
    ...(update || {}),
    source: {
      ...(merged.source || {}),
      ...(update?.source || {})
    },
    appDb: {
      ...(merged.appDb || {}),
      ...(update?.appDb || {})
    }
  }), current || {});
}

function sourceStatusText(source) {
  if (source.queryable) return `Alias ${source.alias || SOURCE_DATASET_ALIAS} is queryable.`;
  return `Alias ${source.alias || SOURCE_DATASET_ALIAS} is not mapped or not queryable.`;
}

function appDbStatusText(appDb) {
  if (appDb.reachable) return 'AppDB collections are reachable.';
  return 'AppDB collections are not reachable; local fallback is active.';
}

function sourceModeText(mode) {
  if (mode === 'domo') return 'Domo aggregate SQL';
  if (mode === 'mock') return 'mock';
  return mode || 'unknown';
}

function getErrorStatus(error) {
  return error?.status || error?.statusCode || error?.response?.status || '';
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function kebabCase(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyState(message) {
  return `<p class="empty">${escapeHtml(message)}</p>`;
}

function readableError(error) {
  if (!error) return 'Unknown error';
  return error.message || String(error);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('\n', ' ');
}

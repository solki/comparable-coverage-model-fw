import { COLLECTIONS, FLAGS, SOURCE_DATASET_ALIAS } from './constants.js';
import { generateMaskRows } from './maskGenerator.js';
import { createRunId, buildRunRecord, writeMaskRun } from './maskWriteService.js';
import { derivePeriodDefinitions, validatePeriods } from './periodDefinitionService.js';
import { loadManualOverrides, saveManualOverrides } from './manualOverrideService.js';
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
  computeGlobalDatasetOverview,
  computeSelectedScopeSummary,
  getSourceFactForScope
} from './scopeSummary.js';
import { displayText, helperText, labels } from './terminology.js';

export function createApp(root) {
  const state = {
    loading: false,
    status: 'Ready',
    error: '',
    sourceRows: [],
    sourceMode: 'unknown',
    sourceProfile: null,
    periodRows: [],
    periodPage: 1,
    periodSource: 'none',
    selectedStoreCode: '',
    selectedMetric: '',
    selectedPeriodType: '',
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
    validationSummary: null,
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
    l4lComparableCoverageOn: true,
    l4lMessage: 'No L4L comparison data is available. Run the Prepare L4L Comparison Facts Workflow first.',
    workflowProgress: null
  };

  async function init() {
    setLoading('Loading source summary and comparable weeks...');
    try {
      const sourceResult = await profileSource();
      const periods = derivePeriodDefinitions(sourceResult.rows);
      state.sourceRows = sourceResult.rows;
      state.sourceMode = sourceResult.source;
      state.sourceProfile = sourceResult.profile;
      state.selectedStoreCode = sourceResult.profile?.stores?.[0]?.store_code || '';
      state.selectedMetric = sourceResult.profile?.metrics?.[0]?.metric || '';
      state.periodRows = periods.rows;
      state.selectedPeriodType = periods.rows[0]?.period_type || '';
      state.periodSource = periods.source;
      state.manualOverrides = await loadOverridesForSelection();
      const l4lResult = await loadComparisonRows();
      applyL4LResult(l4lResult);
      state.diagnostics = mergeDiagnostics(
        state.diagnostics,
        sourceResult.diagnostics,
        periods.diagnostics
      );
      state.status = sourceResult.warning
        ? `Source loaded from mock mode: ${sourceResult.warning}`
        : 'Source summary loaded.';
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
        <header class="topbar">
          <div>
            <p class="eyebrow">Forty Winks CCM</p>
            <h1>Weekly Mask Generator</h1>
          </div>
          <div class="runtime-pill">${escapeHtml(getRuntimeLabel())}</div>
        </header>

        ${state.error ? `<section class="banner banner-error">${escapeHtml(state.error)}</section>` : ''}
        <section class="banner">${escapeHtml(state.status)}</section>
        ${renderDiagnosticsPanel(state.diagnostics)}

        <section class="panel-grid">
          ${renderGlobalDatasetOverview()}
          ${renderSelectionControls()}
          ${renderSelectedScopeSummary()}
          ${renderPeriodDefinitions()}
          ${renderGenerateMask()}
          ${renderValidationSummary()}
          ${renderPrepareL4LWorkflowPanel()}
          ${renderL4LComparisonVisualization()}
        </section>
        ${state.pendingWrite ? renderWriteConfirmation(state.pendingWrite) : ''}
      </main>
    `;

    bindEvents();
  }

  function renderGlobalDatasetOverview() {
    const profile = state.sourceProfile;
    const overview = computeGlobalDatasetOverview(state.sourceRows, profile);
    return `
      <section class="panel">
        <div class="panel-heading">
          <h2>Global Dataset Overview</h2>
          <button class="secondary" data-action="refresh-source" ${state.loading ? 'disabled' : ''}>Refresh</button>
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
    const periodTypes = unique(state.periodRows.map((row) => row.period_type));
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
                ${(profile.stores || []).map((store) => `<option value="${escapeAttribute(store.store_code)}" ${store.store_code === state.selectedStoreCode ? 'selected' : ''}>${escapeHtml(store.store_code)} - ${escapeHtml(store.store_name || 'Unknown')}</option>`).join('')}
              </select>
            </label>
            <label>
              <span>Metric</span>
              <select data-action="select-metric" ${state.loading ? 'disabled' : ''}>
                ${(profile.metrics || []).map((item) => `<option value="${escapeAttribute(item.metric)}" ${item.metric === state.selectedMetric ? 'selected' : ''}>${escapeHtml(item.metric)}</option>`).join('')}
              </select>
            </label>
            <label>
              <span>${escapeHtml(labels.periodLens)}</span>
              <select data-action="select-period-type" ${state.loading ? 'disabled' : ''}>
                ${periodTypes.map((periodType) => `<option value="${escapeAttribute(periodType)}" ${periodType === state.selectedPeriodType ? 'selected' : ''}>${escapeHtml(periodType)}</option>`).join('')}
              </select>
            </label>
          </div>
          <p class="note">Current selection: ${escapeHtml(state.selectedStoreCode || '-')} / ${escapeHtml(state.selectedMetric || '-')} / ${escapeHtml(state.selectedPeriodType || '-')}.</p>
        ` : emptyState('Load source data before selecting a scope.')}
      </section>
    `;
  }

  function renderSelectedScopeSummary() {
    const profile = state.sourceProfile;
    const summary = selectedScopeSummary();
    return `
      <section class="panel panel-wide">
        <div class="panel-heading">
          <h2>Selected Scope Summary</h2>
        </div>
        ${profile ? `
          <div class="metric-grid">
            ${metric(labels.selectedSourceRecords, summary.scoped_source_row_count)}
            ${metric(labels.weeklyCoverageRecords, summary.weekly_coverage_record_count)}
            ${metric(labels.selectedStore, selectedStoreDisplay())}
            ${metric(labels.selectedMetric, state.selectedMetric || '-')}
            ${metric(labels.selectedPeriodLens, summary.selected_period_type || '-')}
            ${metric(labels.currentComparableWeeks, summary.current_side_week_count)}
            ${metric(labels.priorComparableWeeks, summary.prior_side_week_count)}
            ${metric(labels.firstComparableWeek, summary.scoped_min_week_ending || '-')}
            ${metric(labels.latestComparableWeek, summary.scoped_max_week_ending || '-')}
            ${metric(labels.storeTradingDateWarnings, summary.missing_commencement_count)}
            ${metric(labels.storeClosureStatus, summary.selected_store_closure_status)}
            ${metric(labels.sourceRecordsMatched, summary.source_rows_available)}
            ${metric(labels.weeksWithoutSourceData, summary.missing_source_week_count)}
            ${metric(labels.manualCoverageAdjustments, summary.active_manual_override_count)}
            ${metric(labels.weeksNotExpectedToTrade, summary.system_excluded_week_count)}
            ${metric(labels.includedComparableWeeks, summary.final_included_rows)}
            ${metric(labels.excludedComparableWeeks, summary.final_excluded_rows)}
          </div>
          <p class="note">${escapeHtml(helperText.weeklyCoverageRecords)} ${escapeHtml(helperText.comparableWeekCounts)}</p>
        ` : emptyState('No selected scope is available yet.')}
      </section>
    `;
  }

  function renderPeriodDefinitions() {
    const visibleRows = selectedPeriodRows();
    const validation = validatePeriods(visibleRows);
    return `
      <section class="panel panel-wide">
        <div class="panel-heading">
          <h2>Comparable Week Review / Override Editor</h2>
          <button class="secondary" data-action="save-overrides" ${state.loading || !state.selectedStoreCode || !state.selectedMetric ? 'disabled' : ''}>Save Overrides</button>
        </div>
        <p class="note">Source: ${escapeHtml(state.periodSource)}. Validation: ${validation.valid ? 'valid' : `${validation.errors.length} error(s)`}. Fiscal weeks are derived from sourceMetrics at runtime and are not persisted in AppDB. ${escapeHtml(helperText.tradingExpectation)}</p>
        ${visibleRows.length ? renderPeriodTable(visibleRows) : emptyState('No comparable weeks are available for the selected Period Lens.')}
      </section>
    `;
  }

  function renderGenerateMask() {
    return `
      <section class="panel">
        <div class="panel-heading">
          <h2>Generate Selected Scope</h2>
        </div>
        <p class="note">${escapeHtml(displayText.selectedScopeOutput)}</p>
        <p class="note">${escapeHtml(displayText.selectedScopeCollection)}</p>
        <p class="note">${escapeHtml(helperText.selectedScopeMask)}</p>
        <button class="primary" data-action="generate-mask" ${state.loading || !state.sourceProfile || !selectedPeriodRows().length || !state.selectedStoreCode || !state.selectedMetric ? 'disabled' : ''}>
          Rebuild Selected Scope Mask
        </button>
      </section>
      <section class="panel">
        <div class="panel-heading">
          <h2>Generate Full CCM Mask</h2>
        </div>
        <p class="note">${escapeHtml(displayText.fullMaskOutput)}</p>
        <p class="note">${escapeHtml(displayText.fullMaskCollection)}</p>
        <p class="note">${escapeHtml(displayText.fullMaskStatus)}</p>
        <p class="note">Coming soon &mdash; planned for production. Full generation will rebuild the mask for all Stores x Metrics x Period Lenses. This may take longer and is intentionally disabled during Phase 1 prototype validation.</p>
        <button class="secondary" disabled>
          Generate Full CCM Mask
        </button>
      </section>
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
    return `
      <section class="panel panel-wide phase2-panel">
        <div class="panel-heading">
          <div>
            <h2>Prepare L4L Comparison Facts</h2>
            <p class="note">Workflow ${escapeHtml(PREPARE_L4L_WORKFLOW.version)} writes the output dataset used by this read-only visualization.</p>
          </div>
          <div class="button-row">
            <button class="secondary" data-action="run-l4l-workflow" ${support.supported && !state.loading ? '' : 'disabled'}>Run Workflow and Refresh Results</button>
            <button class="primary" data-action="refresh-l4l-results" ${state.loading ? 'disabled' : ''}>Refresh Results</button>
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
        ${support.supported ? '<p class="note">Automatic Workflow trigger is available in Domo runtime.</p>' : `<p class="note">${escapeHtml(support.manualInstruction)}</p>`}
        <p class="note">${escapeHtml(support.reason)}</p>
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

  function renderL4LComparisonVisualization() {
    const rows = state.l4lRows;
    const validation = state.l4lValidation || { valid: true, missingFields: [] };

    if (!rows.length) {
      return `
        <section class="panel panel-wide phase2-panel">
          <div class="panel-heading">
            <h2>Store Performance — L4L Comparison</h2>
          </div>
          ${emptyState('No L4L comparison data is available. Run the Prepare L4L Comparison Facts Workflow first.')}
          ${renderL4LDiagnostics()}
        </section>
      `;
    }

    if (!validation.valid) {
      return `
        <section class="panel panel-wide phase2-panel">
          <div class="panel-heading">
            <h2>Store Performance — L4L Comparison</h2>
            <button class="secondary" data-action="refresh-l4l-results" ${state.loading ? 'disabled' : ''}>Refresh Results</button>
          </div>
          <p class="diagnostic-error">Missing required L4L comparison fields: ${escapeHtml(validation.missingFields.join(', '))}</p>
          ${renderL4LDiagnostics()}
        </section>
      `;
    }

    const context = inferComparisonContext(rows);
    const selectedSummary = calculateComparisonSummary(rows, { comparableCoverageOn: state.l4lComparableCoverageOn });
    const coverageText = state.l4lComparableCoverageOn ? 'L4L ON' : 'L4L OFF';

    return `
      <section class="panel panel-wide phase2-panel">
        <div class="panel-heading">
          <div>
            <h2>Store Performance — L4L Comparison</h2>
            <p class="note">Comparing ${escapeHtml(context.period_label_current || 'Current')} vs ${escapeHtml(context.period_label_prior || 'Prior')} · ${escapeHtml(context.metric_display_name || context.metric || 'Metric')} · ${escapeHtml(context.store_name || context.store_code || 'Store')}</p>
          </div>
          <button class="secondary" data-action="refresh-l4l-results" ${state.loading ? 'disabled' : ''}>Refresh Results</button>
        </div>
        ${renderL4LDiagnostics()}
        <div class="toggle-row" aria-label="Comparable Coverage">
          <span>Comparable Coverage</span>
          <div class="segmented-control">
            <button class="${state.l4lComparableCoverageOn ? 'active' : ''}" data-action="set-l4l-on">L4L ON</button>
            <button class="${state.l4lComparableCoverageOn ? '' : 'active'}" data-action="set-l4l-off">L4L OFF</button>
          </div>
        </div>
        <p class="note">L4L ON uses mask_include_flag = Y. L4L OFF uses all rows in the prepared comparison fact dataset.</p>
        <h3>Main Result Summary (${escapeHtml(coverageText)})</h3>
        <div class="metric-grid">
          ${metric('Current Value', formatNumber(selectedSummary.current_value))}
          ${metric('Prior Value', formatNumber(selectedSummary.prior_value))}
          ${metric('Absolute Variance', formatSignedNumber(selectedSummary.absolute_variance))}
          ${metric('Variance %', selectedSummary.percent_change_display)}
          ${metric('Current Weeks', selectedSummary.included_current_weeks)}
          ${metric('Prior Weeks', selectedSummary.included_prior_weeks)}
          ${metric('Weeks Without Source Data', selectedSummary.weeks_without_source_data)}
          ${metric('Source Records Matched', selectedSummary.source_records_matched)}
          ${metric('Status', selectedSummary.comparison_status)}
        </div>
        ${renderL4LResultComparisonTable(rows)}
        ${renderExcludedCoverageWeeks(rows)}
        ${renderL4LWeeklyDetail(rows)}
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

  function renderExcludedCoverageWeeks(rows) {
    const excludedRows = getExcludedWeeks(rows);
    return `
      <h3>Weeks Excluded by Comparable Coverage</h3>
      ${excludedRows.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period Type</th>
                <th>Side</th>
                <th>Slot</th>
                <th>Financial Year</th>
                <th>Week</th>
                <th>Month</th>
                <th>Week Ending</th>
                <th>Final CCM Outcome</th>
                <th>Outcome Reason</th>
              </tr>
            </thead>
            <tbody>
              ${excludedRows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.period_type)}</td>
                  <td>${escapeHtml(row.comparison_side)}</td>
                  <td>${escapeHtml(row.comparable_week_slot ?? '-')}</td>
                  <td>${escapeHtml(row.financial_year || '-')}</td>
                  <td>${escapeHtml(row.week_of_year ?? '-')}</td>
                  <td>${escapeHtml(row.month_of_year ?? '-')}</td>
                  <td>${escapeHtml(row.week_ending)}</td>
                  <td>${escapeHtml(row.final_include_flag || row.mask_include_flag || '-')}</td>
                  <td>${escapeHtml(row.final_reason_code || row.system_reason_code || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : emptyState('No weeks are excluded by comparable coverage.')}
    `;
  }

  function renderL4LWeeklyDetail(rows) {
    const detailRows = getRowsForCoverageMode(rows, { comparableCoverageOn: state.l4lComparableCoverageOn });
    return `
      <h3>Weekly Detail</h3>
      <div class="table-wrap">
        <table>
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
    const page = getPeriodPage(reviewRowsForRows(rows), state.periodPage);
    return `
      <div class="table-controls" aria-label="Period table pagination">
        <span>Page ${escapeHtml(page.currentPage)} of ${escapeHtml(page.totalPages)} · Showing ${escapeHtml(page.startRow)}-${escapeHtml(page.endRow)} of ${escapeHtml(page.totalRows)} period week rows</span>
        <div class="button-row">
          <button class="secondary" data-action="period-page-prev" ${page.currentPage <= 1 ? 'disabled' : ''}>Previous</button>
          <button class="secondary" data-action="period-page-next" ${page.currentPage >= page.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
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
          <button class="chip" data-action="toggle-override" data-week-ending="${escapeAttribute(row.week_ending)}" ${contextAttributes}>${escapeHtml(override.manual_include_flag)}</button>
        </td>
        <td>${escapeHtml(row.effective_include_flag)}</td>
        <td>${escapeHtml(row.final_include_flag)}</td>
        <td><input class="reason-input" data-action="edit-override-reason" data-week-ending="${escapeAttribute(row.week_ending)}" ${contextAttributes} value="${escapeAttribute(displayOutcomeReason(row, override))}" /></td>
        <td>${escapeHtml(propagationImpact(row))}</td>
      </tr>
    `;
  }

  function bindEvents() {
    root.querySelector('[data-action="refresh-source"]')?.addEventListener('click', refreshSource);
    root.querySelector('[data-action="select-store"]')?.addEventListener('change', (event) => updateSelection({ storeCode: event.target.value }));
    root.querySelector('[data-action="select-metric"]')?.addEventListener('change', (event) => updateSelection({ metric: event.target.value }));
    root.querySelector('[data-action="select-period-type"]')?.addEventListener('change', (event) => {
      state.selectedPeriodType = event.target.value;
      state.periodPage = 1;
      state.pendingWrite = null;
      state.status = `Selected Period Lens: ${state.selectedPeriodType}.`;
      render();
    });
    root.querySelector('[data-action="save-overrides"]')?.addEventListener('click', saveOverrides);
    root.querySelector('[data-action="generate-mask"]')?.addEventListener('click', generateMask);
    root.querySelector('[data-action="run-l4l-workflow"]')?.addEventListener('click', runL4LWorkflow);
    root.querySelector('[data-action="refresh-l4l-results"]')?.addEventListener('click', refreshL4LResults);
    root.querySelector('[data-action="set-l4l-on"]')?.addEventListener('click', () => setL4LCoverageMode(true));
    root.querySelector('[data-action="set-l4l-off"]')?.addEventListener('click', () => setL4LCoverageMode(false));
    root.querySelector('[data-action="confirm-appdb-write"]')?.addEventListener('click', confirmAppDbWrite);
    root.querySelector('[data-action="cancel-appdb-write"]')?.addEventListener('click', cancelAppDbWrite);
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
        render();
      });
    });

    root.querySelectorAll('[data-action="edit-override-reason"]').forEach((input) => {
      input.addEventListener('change', () => {
        updateManualOverride(input.dataset.weekEnding, { manual_reason: input.value }, periodContextFromDataset(input.dataset));
        state.status = 'Manual coverage adjustment reason updated locally.';
        render();
      });
    });

    root.querySelectorAll('[data-action="edit-override-note"]').forEach((input) => {
      input.addEventListener('change', () => {
        updateManualOverride(input.dataset.weekEnding, { manual_note: input.value }, periodContextFromDataset(input.dataset));
        state.status = 'Manual coverage adjustment note updated locally.';
        render();
      });
    });
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
      if (!state.selectedStoreCode) state.selectedStoreCode = sourceResult.profile?.stores?.[0]?.store_code || '';
      if (!state.selectedMetric) state.selectedMetric = sourceResult.profile?.metrics?.[0]?.metric || '';
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
    const runId = createRunId();
    const generatedAt = new Date().toISOString();
    const store = selectedStore();
    const scopeSummary = selectedScopeSummary();
    const maskRows = generateMaskRows({
      stores: store ? [store] : [],
      metrics: state.selectedMetric ? [state.selectedMetric] : [],
      periodRows: selectedPeriodRows(),
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
      periodRows: selectedPeriodRows(),
      maskRows,
      generationMode: 'SELECTED_SCOPE',
      selectedStore: store?.store_code || '',
      selectedMetric: state.selectedMetric,
      selectedPeriodType: state.selectedPeriodType,
      outputCollection: COLLECTIONS.selectedScopeMask,
      rebuildStatus: 'pending_confirmation'
    });
    const summary = buildValidationSummary({
      runId,
      profile: state.sourceProfile,
      periodRows: selectedPeriodRows(),
      maskRows,
      selectedStore: store,
      selectedMetric: state.selectedMetric,
      selectedPeriodType: state.selectedPeriodType,
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
      selectedStore: store?.store_code || '',
      selectedMetric: state.selectedMetric,
      selectedPeriodType: state.selectedPeriodType
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
    setLoading(`Clearing and rebuilding ${maskRows.length} selected-scope comparable week records...`);
    try {
      const result = await writeMaskRun({ runRecord, maskRows, dryRun: false });
      state.validationSummary = {
        ...state.validationSummary,
        mask_rows_deleted: result.maskRowsDeleted,
        mask_rows_inserted: result.maskRowsInserted,
        output_collection: result.runRecord.output_collection,
        rebuild_status: result.runRecord.rebuild_status
      };
      state.status = `Run ${runRecord.run_id} rebuilt selected-scope mask output.`;
      state.error = '';
    } catch (error) {
      state.error = `Blocked during AppDB write: ${readableError(error)}`;
      state.validationSummary = {
        ...state.validationSummary,
        rebuild_status: readableError(error).includes('clear') ? 'clear_failed' : 'failed'
      };
      state.status = 'Selected-scope rebuild failed. No fallback collection changes were attempted.';
    } finally {
      state.loading = false;
      render();
    }
  }

  async function updateSelection({ storeCode = state.selectedStoreCode, metric = state.selectedMetric } = {}) {
    state.selectedStoreCode = storeCode;
    state.selectedMetric = metric;
    state.periodPage = 1;
    state.pendingWrite = null;
    state.loading = true;
    state.status = 'Loading manual coverage adjustments for selected Store and Metric...';
    render();

    try {
      state.manualOverrides = await loadOverridesForSelection();
      state.status = `Loaded manual coverage adjustments for ${state.selectedStoreCode} / ${state.selectedMetric}.`;
      state.error = '';
    } catch (error) {
      state.error = readableError(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadOverridesForSelection() {
    if (!state.selectedStoreCode || !state.selectedMetric) return [];

    try {
      const overrides = await loadManualOverrides({
        storeCode: state.selectedStoreCode,
        metric: state.selectedMetric
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
    if (!store || !state.selectedMetric) {
      state.error = 'Select a Store and Metric before saving overrides.';
      render();
      return;
    }

    setLoading(`Saving manual coverage adjustments for ${store.store_code} / ${state.selectedMetric}...`);
    try {
      const result = await saveManualOverrides({
        store,
        metric: state.selectedMetric,
        overrides: state.manualOverrides,
        updatedBy: 'Domo app user'
      });
      state.manualOverrides = await loadOverridesForSelection();
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
    setLoading('Running Prepare L4L Comparison Facts Workflow...');
    state.workflowProgress = {
      phase: 'starting',
      status: 'STARTING',
      attempt: 0,
      maxPollAttempts: 60,
      percent: 0
    };
    render();
    try {
      const result = await runPrepareL4LWorkflow({
        onProgress: (progress) => {
          state.workflowProgress = progress;
          render();
        }
      });
      if (result.status === 'COMPLETED') {
        const comparisonResult = await loadComparisonRows();
        applyL4LResult(comparisonResult);
        state.status = comparisonResult.empty
          ? `${result.message} ${comparisonResult.message}`
          : `${result.message} Loaded ${comparisonResult.rows.length} L4L comparison fact row(s).`;
      } else {
        state.status = result.message;
      }
      state.l4lMessage = result.message;
      if (['START_FAILED', 'FAILED', 'CANCELED'].includes(result.status)) {
        state.error = result.message;
      } else {
        state.error = '';
      }
    } catch (error) {
      state.error = `Workflow trigger failed: ${readableError(error)}`;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function refreshL4LResults() {
    setLoading('Refreshing L4L comparison results...');
    try {
      const result = await loadComparisonRows();
      applyL4LResult(result);
      state.status = result.empty ? result.message : `Loaded ${result.rows.length} L4L comparison fact row(s).`;
      state.error = '';
    } catch (error) {
      state.error = `Unable to refresh L4L comparison results: ${readableError(error)}`;
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

  function selectedStore() {
    return (state.sourceProfile?.stores || []).find((store) => store.store_code === state.selectedStoreCode) || null;
  }

  function selectedStoreDisplay() {
    const store = selectedStore();
    if (!store) return '-';
    return `${store.store_code}${store.store_name ? ` - ${store.store_name}` : ''}`;
  }

  function selectedPeriodRows() {
    return state.periodRows.filter((row) => !state.selectedPeriodType || row.period_type === state.selectedPeriodType);
  }

  function selectedScopeSummary() {
    return computeSelectedScopeSummary({
      sourceRows: state.sourceRows,
      sourceFacts: state.sourceProfile?.sourceFacts,
      selectedStore: selectedStore(),
      selectedMetric: state.selectedMetric,
      selectedPeriodType: state.selectedPeriodType,
      periodRows: state.periodRows,
      manualOverrides: state.manualOverrides,
      maskRows: reviewRowsForRows(selectedPeriodRows())
    });
  }

  function reviewRowsForRows(periodRows) {
    const store = selectedStore();
    if (!store || !state.selectedMetric) return [];

    return generateMaskRows({
      stores: [store],
      metrics: [state.selectedMetric],
      periodRows,
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
    return state.manualOverrides.find((override) => override.week_ending === weekEnding) || {
      store_code: state.selectedStoreCode,
      metric: state.selectedMetric,
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
      metric: state.selectedMetric,
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
      metric: state.selectedMetric,
      week_ending: weekEnding,
      override_scope: 'STORE_METRIC_WEEK'
    };
    const index = state.manualOverrides.findIndex((override) => override.week_ending === weekEnding);

    if (index >= 0) {
      state.manualOverrides = state.manualOverrides.map((override, itemIndex) => (itemIndex === index ? next : override));
      return;
    }

    state.manualOverrides = [...state.manualOverrides, next];
  }

  function setLoading(message) {
    state.loading = true;
    state.status = message;
    render();
  }

  render();
  init();
}

function metric(label, value) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
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
          <button class="secondary" data-action="cancel-appdb-write">Cancel</button>
          <button class="primary danger" data-action="confirm-appdb-write">Confirm Rebuild</button>
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

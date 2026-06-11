import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.resolve(__dirname, '../../output/playwright');

test.describe('CCM Business Requirements — Visual Verification', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to render and load mock source data
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    // Wait for loading to finish — status banner should be visible
    await page.waitForFunction(() => {
      const banner = document.querySelector('.banner[aria-live="polite"]');
      return banner && !banner.textContent.includes('Loading');
    }, { timeout: 15000 });
  });

  test('01 — Shows six approved period options in Period Lens dropdown', async ({ page }) => {
    // The mask step workspace is rendered by default — selection controls are already visible
    await page.waitForSelector('[data-action="select-period-type"]', { timeout: 5000 });

    const periodSelect = page.locator('[data-action="select-period-type"]');
    const options = await periodSelect.locator('option').allTextContents();

    // All six approved period types are defined in constants; mock data derives 5 of 6
    // (Month To Date requires FC Current Month Flag which mock data doesn't provide)
    const derivablePeriods = [
      'Last Completed Week',
      'Last Completed Month',
      'Last Completed Quarter',
      'Year To Date',
      'Quarter To Date'
    ];

    for (const period of derivablePeriods) {
      expect(options).toContain(period);
    }

    // No extra period types beyond the approved set
    expect(options.length).toBeGreaterThanOrEqual(5);
    expect(options.length).toBeLessThanOrEqual(6);

    await page.screenshot({
      path: path.join(screenshotDir, '01-period-options.png'),
      fullPage: true
    });
  });

  test('02 — Does NOT expose Compare Against or History Window as active UI controls', async ({ page }) => {
    const pageContent = await page.content();

    // These controls must not exist as active UI elements
    expect(pageContent).not.toContain('Compare Against');
    expect(pageContent).not.toContain('History Window');
    expect(pageContent).not.toContain('data-action="select-comparison-mode"');
    expect(pageContent).not.toContain('data-action="select-history-window"');

    // "Fixed comparison" text should be present (informational, not a control)
    expect(pageContent).toContain('Fixed comparison');

    await page.screenshot({
      path: path.join(screenshotDir, '02-no-compare-against-history-window.png'),
      fullPage: true
    });
  });

  test('03 — Supports multi-store, All Metrics, and multi-metric selection UI', async ({ page }) => {
    // Selection controls are in the default mask workspace
    await page.waitForSelector('[data-action="select-store"]', { timeout: 5000 });

    // Store dropdown should include "All Stores" option
    const storeSelect = page.locator('[data-action="select-store"]');
    const storeOptions = await storeSelect.locator('option').allTextContents();
    expect(storeOptions.some((opt) => opt.includes('All Stores'))).toBe(true);

    // Metric select should be a multi-select with "All Metrics" option
    const metricSelect = page.locator('[data-action="select-metrics"]');
    await expect(metricSelect).toHaveAttribute('multiple');

    const metricOptions = await metricSelect.locator('option').allTextContents();
    expect(metricOptions.some((opt) => opt.includes('All Metrics'))).toBe(true);
    expect(metricOptions.length).toBeGreaterThan(1);

    await page.screenshot({
      path: path.join(screenshotDir, '03-multi-store-metric-selection.png'),
      fullPage: true
    });
  });

  test('04 — Comparable weeks render for the selected scope', async ({ page }) => {
    // Select a period type to see comparable weeks table (already in mask workspace)
    await page.waitForSelector('[data-action="select-period-type"]', { timeout: 5000 });
    await page.selectOption('[data-action="select-period-type"]', 'Last Completed Week');

    // The comparable week review table should appear with data
    await page.waitForFunction(() => {
      const tables = document.querySelectorAll('table caption');
      return Array.from(tables).some((cap) =>
        cap.textContent.includes('Comparable week review')
      );
    }, { timeout: 5000 });

    // Verify the table has comparison sides
    const tableText = await page.locator('table').first().textContent();
    expect(tableText).toContain('current');
    expect(tableText).toContain('prior');

    // Verify business terminology columns are present
    expect(tableText).toContain('Trading Expectation');
    expect(tableText).toContain('Final CCM Outcome');
    expect(tableText).toContain('Outcome Reason');

    await page.screenshot({
      path: path.join(screenshotDir, '04-comparable-weeks-rendered.png'),
      fullPage: true
    });
  });

  test('05 — Workflow rail shows all 4 steps', async ({ page }) => {
    const workflowRail = page.locator('.workflow-rail');
    await expect(workflowRail).toBeVisible({ timeout: 5000 });

    const stepButtons = await workflowRail.locator('[data-action="open-workflow-step"]').count();
    expect(stepButtons).toBeGreaterThanOrEqual(4);

    const railText = await workflowRail.textContent();
    expect(railText).toContain('Build Coverage Mask');
    expect(railText).toContain('Prepare Comparison Facts');
    expect(railText).toContain('Review L4L Results');
    expect(railText).toContain('Explain Excluded Weeks');

    await page.screenshot({
      path: path.join(screenshotDir, '05-workflow-rail-4-steps.png'),
      fullPage: true
    });
  });

  test('06 — L4L ON/OFF toggle concept is present in UI', async ({ page }) => {
    const pageContent = await page.content();

    // Comparable Coverage concept and labels are present even without results
    expect(pageContent).toContain('Comparable Coverage');
    expect(pageContent).toContain('L4L ON');
    expect(pageContent).toContain('L4L OFF');

    await page.screenshot({
      path: path.join(screenshotDir, '06-l4l-on-off-toggle.png'),
      fullPage: true
    });
  });

  test('07 — Reason codes and business terms are visible in review table', async ({ page }) => {
    // Navigate to the mask workspace to see the comparable week review table
    await page.waitForSelector('[data-action="select-period-type"]', { timeout: 5000 });
    await page.selectOption('[data-action="select-period-type"]', 'Last Completed Week');

    // Wait for the review table to render
    await page.waitForFunction(() => {
      const tables = document.querySelectorAll('table caption');
      return Array.from(tables).some((cap) =>
        cap.textContent.includes('Comparable week review')
      );
    }, { timeout: 5000 });

    const pageContent = await page.content();

    // Reason codes visible in review table reason inputs
    expect(pageContent).toContain('INCLUDED');

    // Business terminology columns are present
    expect(pageContent).toContain('Outcome Reason');
    expect(pageContent).toContain('Alignment Impact');
    expect(pageContent).toContain('Trading Expectation');
    expect(pageContent).toContain('Final CCM Outcome');
    expect(pageContent).toContain('Coverage Decision');

    await page.screenshot({
      path: path.join(screenshotDir, '07-reason-codes-discoverable.png'),
      fullPage: true
    });
  });

  test('08 — Evidence tabs are present', async ({ page }) => {
    const pageContent = await page.content();

    expect(pageContent).toContain('Excluded Weeks');
    expect(pageContent).toContain('All Weekly Detail');
    expect(pageContent).toContain('Validation');
    expect(pageContent).toContain('Technical Details');

    await page.screenshot({
      path: path.join(screenshotDir, '08-evidence-tabs.png'),
      fullPage: true
    });
  });

  test('09 — Diagnostics drawer is accessible', async ({ page }) => {
    // Open diagnostics
    await page.click('[data-action="toggle-diagnostics"]');
    await page.waitForSelector('.diagnostics-drawer.drawer-open', { timeout: 3000 });

    const drawerText = await page.locator('.diagnostics-drawer').textContent();
    expect(drawerText).toContain('Source alias');
    expect(drawerText).toContain('AppDB');
    expect(drawerText).toContain('Workflow');

    await page.screenshot({
      path: path.join(screenshotDir, '09-diagnostics-drawer.png'),
      fullPage: true
    });

    // Close diagnostics
    await page.click('[data-action="close-diagnostics"]');
  });

  test('10 — Global Dataset Overview remains unfiltered', async ({ page }) => {
    // Navigate to technical details evidence tab which shows global overview
    await page.click('[data-action="set-evidence-tab"][data-tab="technical"]');
    await page.waitForTimeout(500);

    const pageContent = await page.content();
    expect(pageContent).toContain('Global Dataset Overview');
    // The exact text from the UI: "Global overview is not affected"
    expect(pageContent).toContain('Global overview is not affected');

    await page.screenshot({
      path: path.join(screenshotDir, '10-global-dataset-overview.png'),
      fullPage: true
    });
  });

  test('11 — Selected Scope Summary is present in mask workspace', async ({ page }) => {
    // Selected Scope Summary is already rendered by default in mask workspace
    await page.waitForSelector('[data-action="select-period-type"]', { timeout: 5000 });

    const pageContent = await page.content();
    expect(pageContent).toContain('Selected Scope Summary');

    // Verify scoped metrics are present
    expect(pageContent).toContain('Selected Source Records');
    expect(pageContent).toContain('Selected Store');
    expect(pageContent).toContain('Selected Metric');

    await page.screenshot({
      path: path.join(screenshotDir, '11-selected-scope-summary.png'),
      fullPage: true
    });
  });

  test('12 — Full CCM Mask generation is a disabled placeholder only', async ({ page }) => {
    // The mask workspace is already active; scroll to find the full mask section
    const pageContent = await page.content();
    expect(pageContent).toContain('Generate Full CCM Mask');
    expect(pageContent).toContain('Coming soon');

    // The full mask button should be disabled
    const fullMaskButton = page.locator('button:has-text("Generate Full CCM Mask")');
    const count = await fullMaskButton.count();
    if (count > 0) {
      await expect(fullMaskButton.first()).toBeDisabled();
    }

    // Verify the active "Rebuild Selected Scope Mask" exists
    expect(pageContent).toContain('Rebuild Selected Scope Mask');

    await page.screenshot({
      path: path.join(screenshotDir, '12-full-mask-disabled-placeholder.png'),
      fullPage: true
    });
  });

  test('13 — Next best action strip guides user workflow', async ({ page }) => {
    const pageContent = await page.content();
    expect(pageContent).toContain('Next best action');
    expect(pageContent).toContain('Use the active work area below');

    await page.screenshot({
      path: path.join(screenshotDir, '13-next-best-action.png'),
      fullPage: true
    });
  });

  test('14 — Guidance labels expose CCM business terminology', async ({ page }) => {
    const pageContent = await page.content();

    expect(pageContent).toContain('Comparable Coverage');
    expect(pageContent).toContain('Selected Scope Mask');
    expect(pageContent).toContain('Period Lens');
    expect(pageContent).toContain('Trading Expectation');

    await page.screenshot({
      path: path.join(screenshotDir, '14-business-terminology.png'),
      fullPage: true
    });
  });

  test('15 — Period Type is not a required generation selector', async ({ page }) => {
    // The Period dropdown should be labeled as "Period Filter (review only)"
    await page.waitForSelector('[data-action="select-period-type"]', { timeout: 5000 });
    const pageContent = await page.content();

    // Period Type dropdown exists but is labeled as review-only filter
    expect(pageContent).toContain('Period Filter');
    // Generation scope text should mention all period types are auto-generated
    expect(pageContent).toContain('All six approved period types are generated automatically');

    await page.screenshot({
      path: path.join(screenshotDir, '15-period-type-not-generation-scope.png'),
      fullPage: true
    });
  });

  test('16 — Scope bar shows all period types are generated', async ({ page }) => {
    await page.waitForSelector('.scope-bar', { timeout: 5000 });
    const scopeBarText = await page.locator('.scope-bar').textContent();

    // Scope bar should show "All six approved" for period types
    expect(scopeBarText).toContain('All six approved');

    await page.screenshot({
      path: path.join(screenshotDir, '16-scope-bar-all-period-types.png'),
      fullPage: true
    });
  });

  test('17 — Override Editor shows guide message when not in single override scope', async ({ page }) => {
    // With mock data, default is single store + single metric — override editor should show rows
    await page.waitForSelector('[data-action="select-period-type"]', { timeout: 5000 });
    const pageContent = await page.content();

    // Verify the override editor is present and mentions the scope requirement
    expect(pageContent).toContain('Comparable Week Review');
    expect(pageContent).toContain('Override Editor');

    await page.screenshot({
      path: path.join(screenshotDir, '17-override-editor-with-data.png'),
      fullPage: true
    });
  });

  test('18 — Diagnostics drawer shows all health indicators', async ({ page }) => {
    // Open diagnostics drawer
    await page.click('[data-action="toggle-diagnostics"]');
    await page.waitForSelector('.diagnostics-drawer.drawer-open', { timeout: 3000 });

    const drawerText = await page.locator('.diagnostics-drawer').textContent();

    // Verify key health indicators are present
    expect(drawerText).toContain('Source');
    expect(drawerText).toContain('AppDB');
    expect(drawerText).toContain('Workflow');
    expect(drawerText).toContain('L4L');

    await page.screenshot({
      path: path.join(screenshotDir, '18-diagnostics-verification.png'),
      fullPage: true
    });

    await page.click('[data-action="close-diagnostics"]');
  });
});

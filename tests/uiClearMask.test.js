import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('UI does not expose standalone clear-mask action during selected-scope generation', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.doesNotMatch(uiSource, /data-action="clear-mask"/);
  assert.doesNotMatch(uiSource, /data-action="confirm-clear-mask"/);
  assert.doesNotMatch(uiSource, /data-action="cancel-clear-mask"/);
  assert.match(uiSource, /Rebuild Selected Scope Mask/);
});

test('UI no longer exposes a mask row limit toggle in selected-scope generation', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.doesNotMatch(uiSource, /data-action="toggle-mask-row-limit"/);
  assert.doesNotMatch(uiSource, /Test limit: 100 rows/);
  assert.doesNotMatch(uiSource, /maskRowLimit/);
});

test('UI paginates period definitions and displays financial year', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /periodPage/);
  assert.match(uiSource, /data-action="period-page-prev"/);
  assert.match(uiSource, /data-action="period-page-next"/);
  assert.match(uiSource, /Financial Year/);
  assert.match(uiSource, /getPeriodPage/);
});

test('UI uses comparable week review and override editor language', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /Comparable Week Review \/ Override Editor/);
  assert.doesNotMatch(uiSource, /Period Definition Manager/);
  assert.doesNotMatch(uiSource, /data-action="load-periods"/);
});

test('UI review table exposes business-facing CCM terminology', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const terminologySource = readFileSync('src/terminology.js', 'utf8');
  const displaySources = `${uiSource}\n${terminologySource}`;

  for (const label of [
    'Period Lens',
    'Comparison Side',
    'Comparable Slot',
    'Financial Year',
    'Fiscal Week',
    'Fiscal Month',
    'Week Ending',
    'Weekly Metric Value',
    'Source Data Status',
    'Trading Expectation',
    'Manual Coverage Adjustment',
    'Coverage Decision',
    'Final CCM Outcome',
    'Outcome Reason',
    'Alignment Impact'
  ]) {
    assert.match(displaySources, new RegExp(label));
  }

  for (const oldLabel of [
    'Manual Include',
    'Effective Include',
    'Final Include',
    'Source Data Exists',
    'Propagation Impact'
  ]) {
    assert.doesNotMatch(uiSource, new RegExp(oldLabel));
  }

  assert.match(uiSource, /labels\.periodLens/);
  assert.match(uiSource, /labels\.tradingExpectation/);
});

test('UI separates global dataset overview from selected scope summary', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.match(uiSource, /Global Dataset Overview/);
  assert.match(uiSource, /Selected Scope Summary/);
  assert.match(uiSource, /renderGlobalDatasetOverview/);
  assert.match(uiSource, /renderSelectedScopeSummary/);
});

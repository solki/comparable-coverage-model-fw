import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('UI labels selected-scope generation as the only active Phase 1 action', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const terminologySource = readFileSync('src/terminology.js', 'utf8');
  const displaySources = `${uiSource}\n${terminologySource}`;

  assert.match(uiSource, /Commit CCM Mask/);
  assert.match(displaySources, /commits the loaded working data/i);
  assert.match(displaySources, /ccm_selected_scope_mask/);
  assert.match(displaySources, /All six approved period types are included/i);
  assert.match(uiSource, /six approved period types/);
  assert.doesNotMatch(uiSource, /Generate Phase 1 CCM Mask/);
  assert.doesNotMatch(uiSource, /This rebuilds ccm_l4l_week_mask/);
});

test('UI confirms selected-scope rebuild before clearing mask output', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const terminologySource = readFileSync('src/terminology.js', 'utf8');
  const displaySources = `${uiSource}\n${terminologySource}`;

  assert.match(displaySources, /Existing selected-scope mask records will be cleared/);
  assert.match(displaySources, /ccm_selected_scope_mask/);
  assert.match(displaySources, /Manual coverage adjustments will not be affected/);
  assert.match(displaySources, /Comparable Week Records to Write/);
  assert.match(uiSource, /data-action="confirm-appdb-write"/);
});

test('UI reserves Full CCM Mask generation as a disabled placeholder only', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const terminologySource = readFileSync('src/terminology.js', 'utf8');
  const displaySources = `${uiSource}\n${terminologySource}`;

  assert.match(uiSource, /Generate Full CCM Mask/);
  assert.match(displaySources, /Output: Full CCM Mask/);
  assert.match(displaySources, /AppDB collection: ccm_full_mask/);
  assert.match(displaySources, /ccm_full_mask/);
  assert.match(uiSource, /Coming soon/);
  assert.match(uiSource, /planned for production/);
  assert.match(uiSource, /intentionally disabled during Phase 1 prototype validation/);
  assert.match(uiSource, /disabled[^>]*>\s*Generate Full CCM Mask/);
  assert.doesNotMatch(uiSource, /data-action="generate-full-mask"/);
});

test('validation summary exposes business validation and technical write sections', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');
  const terminologySource = readFileSync('src/terminology.js', 'utf8');
  const displaySources = `${uiSource}\n${terminologySource}`;

  for (const label of [
    'Business Validation',
    'Comparable Week Records',
    'Included Comparable Weeks',
    'Excluded Comparable Weeks',
    'Weeks Without Source Data',
    'Manual Coverage Adjustments Applied',
    'Store Trading Date Warnings',
    'Date Quality Warnings',
    'Technical Write Summary',
    'Generation Mode',
    'Output Collection',
    'Selected Store',
    'Selected Metric',
    'Selected Period Lens',
    'Previous Mask Records Cleared',
    'Mask Records Written',
    'Rebuild Status'
  ]) {
    assert.match(displaySources, new RegExp(label));
  }

  assert.match(uiSource, /SELECTED_SCOPE/);
  assert.doesNotMatch(uiSource, /Total rows/);
  assert.doesNotMatch(uiSource, /Included rows/);
});

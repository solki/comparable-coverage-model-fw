import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('AppDB write confirmation does not use sandbox-blocked browser modals', () => {
  const uiSource = readFileSync('src/ui.js', 'utf8');

  assert.doesNotMatch(uiSource, /window\.confirm|confirm\(/);
  assert.match(uiSource, /data-action="confirm-appdb-write"/);
  assert.match(uiSource, /data-action="cancel-appdb-write"/);
});

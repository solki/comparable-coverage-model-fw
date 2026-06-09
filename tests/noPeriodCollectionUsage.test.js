import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('runtime code and manifest do not reference ccm_period_definition as an AppDB collection', () => {
  const files = execFileSync('rg', [
    '--files',
    'src',
    'manifest.json'
  ], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('ccm_period_definition'));

  assert.deepEqual(offenders, []);
});

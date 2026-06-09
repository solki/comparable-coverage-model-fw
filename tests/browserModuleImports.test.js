import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('browser-loaded source modules do not use npm bare imports', () => {
  const files = execFileSync('rg', ['--files', 'src'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /(?:from\s+['"]|import\(\s*['"])(@domoinc\/toolkit|@domoinc\/query|ryuu\.js)/,
      `${file} must not import npm packages directly when loaded as browser modules`
    );
  }
});

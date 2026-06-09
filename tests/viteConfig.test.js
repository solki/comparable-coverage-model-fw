import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('vite build uses relative asset base for Domo hosting', () => {
  const config = readFileSync('vite.config.js', 'utf8');

  assert.match(config, /base:\s*['"]\.\/['"]/);
});

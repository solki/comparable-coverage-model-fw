import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('index loads CSS as a stylesheet and uses relative source paths', () => {
  const indexHtml = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.match(indexHtml, /<link\s+rel="stylesheet"\s+href="\.\/src\/styles\.css\?direct"\s*\/?>/);
  assert.match(indexHtml, /<script\s+type="module"\s+src="\.\/src\/main\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /src="\/src\//);
  assert.doesNotMatch(mainJs, /import\s+['"].*\.css['"]/);
});

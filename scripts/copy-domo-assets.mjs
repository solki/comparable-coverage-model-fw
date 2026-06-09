import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

await mkdir('dist', { recursive: true });
await copyFile('manifest.json', 'dist/manifest.json');

if (existsSync('thumbnail.png')) {
  await copyFile('thumbnail.png', 'dist/thumbnail.png');
}


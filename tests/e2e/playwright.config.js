import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    screenshot: 'on',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173',
    cwd: projectRoot,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },
  outputDir: path.join(projectRoot, 'output', 'playwright')
});

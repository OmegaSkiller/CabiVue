import { mkdtempSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const dir = mkdtempSync(join(tmpdir(), 'cabivue-pwa-'));
mkdirSync(join(dir, 'dist'));
for (const path of ['dist/web', 'migrations', 'prompts'])
  cpSync(path, join(dir, path), { recursive: true });
const env = {
  ...process.env,
  PWA_TEST_DIR: dir,
  DATA_DIR: join(dir, 'data'),
  DEMO_MODE: 'true',
  APP_ORIGIN: 'http://localhost:5175',
  PORT: '5175',
};
const seed = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/demo.ts'], {
  env,
  stdio: 'inherit',
});
if (seed.status !== 0) {
  rmSync(dir, { recursive: true, force: true });
  process.exit(seed.status || 1);
}
const child = spawn(
  process.execPath,
  [resolve('node_modules/@playwright/test/cli.js'), 'test', '-c', 'playwright.pwa.config.ts'],
  { env, stdio: 'inherit' },
);
child.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exitCode = code || 0;
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));

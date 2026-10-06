import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const dataDir = mkdtempSync(join(tmpdir(), 'cabivue-browser-'));
const env = {
  ...process.env,
  DATA_DIR: dataDir,
  DEMO_MODE: 'true',
  APP_ORIGIN: 'http://localhost:5174',
  WEB_PORT: '5174',
  PORT: '3211',
};
const seed = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/demo.ts'], {
  env,
  stdio: 'inherit',
});
if (seed.status !== 0) {
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(seed.status || 1);
}
const child = spawn(process.execPath, ['scripts/dev.mjs'], { env, stdio: 'inherit' });
child.on('exit', (code) => {
  rmSync(dataDir, { recursive: true, force: true });
  process.exitCode = code || 0;
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));

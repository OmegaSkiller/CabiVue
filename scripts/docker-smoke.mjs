import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { validateBackup } from '../dist/contracts/backup.js';

const suffix = randomUUID();
const container = `cabivue-smoke-${suffix}`;
const volume = `cabivue-smoke-data-${suffix}`;
const image = process.argv[2] || 'cabivue:verification';
const origin = 'http://localhost';
const secret = 'synthetic-bootstrap-secret-for-smoke-only';
let base,
  cookie = '',
  csrf = '';
function docker(args, required = true) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (required && result.status !== 0)
    throw new Error(result.stderr || result.error?.message || 'Docker command failed.');
  return result.stdout.trim();
}
async function start() {
  docker([
    'run',
    '-d',
    '--name',
    container,
    '--read-only',
    '--tmpfs',
    '/tmp:size=64m,mode=1777',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--health-interval=1s',
    '--health-start-period=1s',
    '-p',
    '127.0.0.1::3000',
    '-v',
    `${volume}:/data`,
    '-e',
    `APP_ORIGIN=${origin}`,
    '-e',
    `BOOTSTRAP_SECRET=${secret}`,
    image,
  ]);
  base = `http://127.0.0.1:${JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]))['3000/tcp'][0].HostPort}`;
  const deadline = Date.now() + 45000;
  while (docker(['inspect', '--format', '{{.State.Health.Status}}', container]) !== 'healthy') {
    if (Date.now() >= deadline) throw new Error('Container did not become healthy.');
    await delay(250);
  }
  assert.equal(docker(['exec', container, 'id', '-u']), '1000');
}
async function api(path, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      Cookie: cookie,
      'x-csrf-token': csrf,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  assert.equal(response.status, expected, value.error || path);
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  return value;
}
async function login() {
  csrf = (
    await api('/auth/login', 'POST', {
      username: 'smoke-household',
      password: 'synthetic-smoke-password',
    })
  ).csrf;
}
try {
  docker(['volume', 'create', volume]);
  await start();
  await api(
    '/auth/bootstrap',
    'POST',
    { secret, username: 'smoke-household', password: 'synthetic-smoke-password' },
    201,
  );
  await login();
  const pack = await api(
    '/packs',
    'POST',
    {
      product: { name: 'Synthetic smoke pack' },
      quantity: 7,
      unit: 'tablet',
      expiryValue: null,
      expiryPrecision: 'unknown',
    },
    201,
  );
  await api('/provider/key', 'PUT', { key: 'synthetic-provider-key-never-used' });
  const backup = validateBackup(await api('/backups/export'));
  assert.equal(backup.packs.length, 1);
  assert(!JSON.stringify(backup).includes('synthetic-provider-key'));
  await api(`/packs/${pack.id}`, 'PUT', {
    quantity: 3,
    unit: 'tablet',
    expiryValue: null,
    expiryPrecision: 'unknown',
    version: pack.version,
  });
  const status = await api('/backups/status');
  const restored = await api('/backups/restore', 'POST', {
    backup,
    expectedRevision: status.revision,
    confirm: 'RESTORE',
  });
  await login();
  assert.equal((await api('/inventory')).packs[0].quantity, 7);
  assert.equal((await api('/backups/recovery/' + restored.recoveryPoint)).packs[0].quantity, 3);
  assert.equal((await api('/provider')).configured, false);
  await api('/provider/key', 'PUT', { key: 'synthetic-provider-key-never-used' });
  docker(['stop', container]);
  docker(['rm', container]);
  await start();
  await api('/inventory', 'GET', undefined, 401);
  await login();
  assert.equal((await api('/inventory')).packs[0].quantity, 7);
  assert.equal((await api('/provider')).configured, false);
  assert((await api('/backups/recovery')).files.includes(restored.recoveryPoint));
  console.log(
    `Container smoke passed (${docker(['image', 'inspect', '--format', '{{.Architecture}}', image])}): non-root, health, export/restore, recovery, persistence after replacement, session/key reset.`,
  );
} finally {
  docker(['rm', '-f', container], false);
  docker(['volume', 'rm', volume], false);
}

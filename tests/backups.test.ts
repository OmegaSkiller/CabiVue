import { beforeEach, afterEach, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.js';
import { packInputSchema } from '../src/contracts/inventory.js';
import { validateBackup } from '../src/contracts/backup.js';
import { origin, signIn, testConfig } from './helpers.js';
let instance: ReturnType<typeof createApp>, dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cabivue-recovery-'));
  instance = createApp(testConfig(dir));
});
afterEach(() => {
  instance.close();
  rmSync(dir, { recursive: true, force: true });
});
function seed() {
  const purchase = instance.store.createPurchaseLine({
    date: '2026-10-01',
    pharmacy: 'Synthetic pharmacy',
    purchasedPacks: 2,
    unitPrice: 4,
    lineTotal: 8,
    currency: 'EUR',
  });
  const first = instance.store.createPack(
    packInputSchema.parse({
      quantity: 12,
      unit: 'tablet',
      expiryValue: null,
      expiryPrecision: 'unknown',
      product: {
        name: 'Synthetic combination',
        ingredients: [
          { name: 'Synthetic A', strength: '10', unit: 'mg', basis: 'per tablet' },
          { name: 'Synthetic B', strength: '5', unit: 'mg', basis: 'per tablet' },
        ],
      },
    }),
    purchase,
  );
  const second = instance.store.createPack(
    packInputSchema.parse({
      quantity: 12,
      unit: 'tablet',
      expiryValue: '2027-02',
      expiryPrecision: 'month',
      productId: first.productId,
    }),
    purchase,
  );
  instance.store.db
    .prepare('INSERT INTO import_consumptions VALUES(?,1,?,?,?,?)')
    .run(
      randomUUID(),
      'receipt',
      'a'.repeat(64),
      JSON.stringify([first.id, second.id]),
      new Date().toISOString(),
    );
  return { first, second };
}
it('round-trips the downloaded artifact, preserves receipt links, saves recovery, and clears every session', async () => {
  const { agent, headers } = await signIn(instance);
  const { first } = seed();
  const another = request.agent(instance.app);
  await another
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({ username: 'household', password: 'synthetic-password' })
    .expect(200);
  for (const session of instance.auth.transient.values())
    session.providerKey = 'private-provider-key';
  const sessions = [...instance.auth.transient.values()];
  const exported = await agent.get('/api/backups/export').expect(200);
  expect(exported.headers['cache-control']).toBe('no-store');
  expect(exported.headers['content-disposition']).toContain('attachment');
  const backup = validateBackup(JSON.parse(exported.text));
  for (const secret of [
    'private-provider-key',
    'password_hash',
    'token_hash',
    'csrf',
    'intake',
    'extraction_json',
  ])
    expect(exported.text).not.toContain(secret);
  expect(backup.purchaseLines).toHaveLength(1);
  expect(backup.packPurchases).toHaveLength(2);
  instance.store.editPack(first.id, { ...first, version: first.version, quantity: 3 });
  const { body: status } = await agent.get('/api/backups/status').expect(200);
  const restored = await agent
    .post('/api/backups/restore')
    .set(headers)
    .send({ backup, expectedRevision: status.revision, confirm: 'RESTORE' })
    .expect(200);
  expect(instance.store.getPack(first.id).quantity).toBe(12);
  expect(instance.store.getPack(first.id).product.ingredients).toHaveLength(2);
  expect(instance.store.getPack(first.id).purchase?.lineTotal).toBe(8);
  expect(() => instance.store.editPack(first.id, { ...first, version: first.version })).toThrow(
    'changed',
  );
  expect(() => instance.store.editProduct(first.productId, { ...first.product })).toThrow(
    'changed',
  );
  expect(instance.auth.transient.size).toBe(0);
  expect(sessions.every((s) => !s.providerKey)).toBe(true);
  await another.get('/api/inventory').expect(401);
  await agent.get('/api/inventory').expect(401);
  const login = await agent
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({ username: 'household', password: 'synthetic-password' })
    .expect(200);
  expect(login.body.csrf).toBeTruthy();
  const recovery = await agent
    .get(`/api/backups/recovery/${restored.body.recoveryPoint}`)
    .expect(200);
  expect(recovery.body.packs.find((p: { id: string }) => p.id === first.id).quantity).toBe(3);
  expect(statSync(join(dir, 'recovery', restored.body.recoveryPoint)).mode & 0o777).toBe(0o600);
});
it('rejects invalid relationships, stale replacements, and missing confirmation without mutation', async () => {
  const { agent, headers } = await signIn(instance);
  seed();
  const { body: backup } = await agent.get('/api/backups/export');
  const { body: status } = await agent.get('/api/backups/status');
  const invalid = structuredClone(backup);
  invalid.packs[0].productId = randomUUID();
  await agent
    .post('/api/backups/restore')
    .set(headers)
    .send({ backup: invalid, expectedRevision: status.revision, confirm: 'RESTORE' })
    .expect(400);
  await agent
    .post('/api/backups/restore')
    .set(headers)
    .send({ backup, expectedRevision: status.revision, confirm: 'YES' })
    .expect(400);
  await agent.post('/api/locations').set(headers).send({ name: 'New cupboard' }).expect(201);
  await agent
    .post('/api/backups/restore')
    .set(headers)
    .send({ backup, expectedRevision: status.revision, confirm: 'RESTORE' })
    .expect(409);
  expect(instance.store.packs()).toHaveLength(2);
  expect((await agent.get('/api/backups/recovery')).body.files).toEqual([]);
});
it('invalidates sources on shared-product edits and rejects stale product revisions', async () => {
  const { agent, headers } = await signIn(instance);
  const { first, second } = seed();
  const sourceId = randomUUID();
  instance.store.db
    .prepare('INSERT INTO source_facts VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(
      sourceId,
      first.productId,
      'https://example.org/synthetic',
      'fixture-1',
      'Synthetic test only',
      'reviewed',
      '[]',
      null,
      null,
      'Synthetic fixture owned by project',
      '2026-10-01',
      first.product.version,
    );
  const { id, prescriptionStatus, ...input } = first.product;
  await agent
    .put(`/api/products/${id}`)
    .set(headers)
    .send({ ...input, name: 'Corrected synthetic label' })
    .expect(200);
  expect(instance.store.getPack(second.id).product.name).toBe('Corrected synthetic label');
  expect(instance.store.sources(id)[0].reviewStatus).toBe('unreviewed');
  await agent.put(`/api/products/${id}`).set(headers).send(input).expect(409);
  const backup = (await agent.get('/api/backups/export')).body;
  backup.sources[0].reviewStatus = 'reviewed';
  expect(() => validateBackup(backup)).toThrow('exact product revision');
});

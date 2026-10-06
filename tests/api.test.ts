import { beforeEach, afterEach, it, expect } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.js';
let instance: ReturnType<typeof createApp>, dir: string;
const origin = 'http://localhost:3000',
  secret = 's'.repeat(64);
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cabivue-test-'));
  instance = createApp({
    dataDir: dir,
    origin,
    port: 3000,
    secureCookies: false,
    trustProxy: false,
    bootstrapSecret: secret,
    demo: false,
    sessionHours: 12,
  });
});
afterEach(() => {
  instance.close();
  rmSync(dir, { recursive: true, force: true });
});
async function login() {
  const agent = request.agent(instance.app);
  await agent
    .post('/api/auth/bootstrap')
    .set('Origin', origin)
    .send({ secret, username: 'household', password: 'synthetic-password' })
    .expect(201);
  const login = await agent
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({ username: 'household', password: 'synthetic-password' })
    .expect(200);
  return { agent, csrf: login.body.csrf };
}
const pack = {
  quantity: 12,
  unit: 'tablet',
  expiryValue: null,
  expiryPrecision: 'unknown',
  product: {
    name: 'Синтетично лекарство',
    ingredients: [
      { name: 'Synthetic A', strength: '10', unit: 'mg', basis: 'per tablet' },
      { name: 'Synthetic B', strength: '5', unit: 'mg', basis: 'per tablet' },
    ],
  },
};
it('protects all private records and enforces origin and CSRF', async () => {
  await request(instance.app).get('/api/inventory').expect(401);
  await request(instance.app).get('/api/packs/does-not-exist').expect(401);
  const { agent } = await login();
  await agent.post('/api/packs').set('Origin', origin).send(pack).expect(403);
  await agent.post('/api/packs').set('Origin', 'https://evil.example').send(pack).expect(403);
});
it('keeps two physical packs independent and detects stale edits', async () => {
  const { agent, csrf } = await login();
  const a = await agent
    .post('/api/packs')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send(pack)
    .expect(201);
  expect(a.body.product.ingredients).toHaveLength(2);
  const b = await agent
    .post('/api/packs')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send({
      ...pack,
      product: null,
      productId: a.body.productId,
      expiryValue: '2027-01',
      expiryPrecision: 'month',
    })
    .expect(201);
  expect(b.body.productId).toBe(a.body.productId);
  expect(b.body.expiryValue).toBe('2027-01');
  const update = {
    quantity: 10,
    unit: 'tablet',
    expiryValue: null,
    expiryPrecision: 'unknown',
    version: 1,
  };
  await agent
    .put(`/api/packs/${a.body.id}`)
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send(update)
    .expect(200);
  await agent
    .put(`/api/packs/${a.body.id}`)
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send(update)
    .expect(409);
  expect(instance.store.getPack(b.body.id).quantity).toBe(12);
});
it('uses salted hashes and clears session keys on logout and expiry', async () => {
  const { agent, csrf } = await login();
  const row = instance.store.db.prepare('SELECT password_hash FROM account').get() as {
    password_hash: string;
  };
  expect(row.password_hash).not.toContain('synthetic-password');
  const session = [...instance.auth.transient.values()][0];
  session.providerKey = 'synthetic-secret-key';
  await agent
    .post('/api/auth/logout')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send({})
    .expect(200);
  expect(session.providerKey).toBeUndefined();
  await agent.get('/api/inventory').expect(401);
  expect(instance.store.db.prepare('SELECT 1 FROM sessions').all()).toHaveLength(0);
});

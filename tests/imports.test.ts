import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../src/server/app.js';
import { simulatedExtraction } from '../src/server/simulation.js';
import { Provider } from '../src/server/provider.js';
import { normalizeImages } from '../src/server/media.js';
import { reviewExtraction } from '../src/domain/imports.js';
import { testConfig, signIn } from './helpers.js';
let instance: ReturnType<typeof createApp>,
  dir: string,
  auth: Awaited<ReturnType<typeof signIn>>,
  image: string;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cabivue-imports-'));
  instance = createApp(testConfig(dir, true));
  auth = await signIn(instance);
  image = (
    await sharp({ create: { width: 100, height: 100, channels: 3, background: '#125b57' } })
      .png()
      .toBuffer()
  ).toString('base64');
});
afterEach(() => {
  vi.restoreAllMocks();
  instance.close();
  rmSync(dir, { recursive: true, force: true });
});
async function extract(mode: 'medicine' | 'receipt') {
  const r = await auth.agent.post('/api/imports').set(auth.headers).send({ mode }).expect(201);
  return (
    await auth.agent
      .post(`/api/imports/${r.body.id}/extract`)
      .set(auth.headers)
      .send({ consent: true, images: [image] })
      .expect(200)
  ).body;
}
const pack = {
  quantity: 10,
  unit: 'tablet',
  expiryValue: null,
  expiryPrecision: 'unknown',
  product: { name: 'SYNTHETIC REVIEWED TEXT' },
};
const decision = {
  candidateIndex: 0,
  pack,
  packCount: 2,
  purchase: {
    date: '2026-10-01',
    pharmacy: 'Synthetic pharmacy',
    purchasedPacks: 2,
    unitPrice: 5,
    lineTotal: 10,
    currency: 'EUR',
  },
  confirmedMedicine: true,
};
it('creates drafts only, selects medicine lines and saves receipts atomically/idempotently', async () => {
  const draft = await extract('receipt');
  expect(instance.store.packs()).toHaveLength(0);
  expect(draft.extraction.candidates[1].kind).toBe('other');
  expect(draft.extraction.candidates[0].expiryValue.value).toBeNull();
  const payload = { decisions: [decision], duplicateAcknowledged: false };
  const [a, b] = await Promise.all([
    auth.agent.post(`/api/imports/${draft.id}/confirm`).set(auth.headers).send(payload),
    auth.agent.post(`/api/imports/${draft.id}/confirm`).set(auth.headers).send(payload),
  ]);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(a.body).toEqual(b.body);
  expect(instance.store.packs()).toHaveLength(2);
  expect(instance.store.db.prepare('SELECT * FROM purchase_lines').all()).toHaveLength(1);
  expect(instance.store.packs()[0].purchase!.lineTotal).toBe(10);
  expect(instance.store.db.prepare('SELECT * FROM import_consumptions').all()).toHaveLength(1);
  expect(
    (
      instance.store.db
        .prepare('SELECT extraction_json FROM import_drafts WHERE id=?')
        .get(draft.id) as { extraction_json: null }
    ).extraction_json,
  ).toBeNull();
  const again = await extract('receipt');
  expect(again.duplicate).toBe(true);
  await auth.agent
    .post(`/api/imports/${again.id}/confirm`)
    .set(auth.headers)
    .send(payload)
    .expect(409);
});
it('rolls back the entire selection for an invalid linked product and requires quantity interpretation', async () => {
  const draft = await extract('receipt');
  await auth.agent
    .post(`/api/imports/${draft.id}/confirm`)
    .set(auth.headers)
    .send({ decisions: [{ ...decision, purchase: null }], duplicateAcknowledged: false })
    .expect(400);
  await auth.agent
    .post(`/api/imports/${draft.id}/confirm`)
    .set(auth.headers)
    .send({
      decisions: [
        decision,
        {
          ...decision,
          candidateIndex: 1,
          pack: { ...pack, product: null, productId: 'cc9dfc6b-9c0f-4d74-bde3-52eb37d16779' },
        },
      ],
      duplicateAcknowledged: false,
    })
    .expect(400);
  expect(instance.store.packs()).toHaveLength(0);
  expect(instance.store.products()).toHaveLength(0);
  expect(instance.store.db.prepare('SELECT * FROM purchase_lines').all()).toHaveLength(0);
});
it('cancels media-free drafts and rejects expired reviews', async () => {
  const draft = await extract('medicine');
  await auth.agent.delete(`/api/imports/${draft.id}`).set(auth.headers).send({}).expect(200);
  await auth.agent
    .post(`/api/imports/${draft.id}/confirm`)
    .set(auth.headers)
    .send({
      decisions: [{ ...decision, packCount: 1, purchase: null }],
      duplicateAcknowledged: false,
    })
    .expect(410);
  expect(instance.store.packs()).toHaveLength(0);
  const other = await extract('medicine');
  instance.store.db.prepare('UPDATE import_drafts SET expires_at=0 WHERE id=?').run(other.id);
  await auth.agent.get(`/api/imports/${other.id}`).expect(410);
});
it('keeps ambiguous digits, LOT and conflicting photos out of parsed expiry', () => {
  const data = simulatedExtraction('medicine');
  const c = data.candidates[0];
  c.expiryValue = {
    value: '2027-10',
    raw: '10/27?',
    evidence: '10/27?',
    status: 'ambiguous',
    imageIndex: 0,
  };
  c.expiryPrecision = 'month';
  c.expiryMarker = { value: 'LOT', raw: 'LOT', evidence: 'LOT', status: 'visible', imageIndex: 0 };
  expect(reviewExtraction(data, 'medicine', 1).candidates[0].expiryValue.value).toBeNull();
  c.expiryValue = {
    value: '2027-10',
    raw: '10/27',
    evidence: '10/27',
    status: 'visible',
    imageIndex: 0,
  };
  c.expiryMarker = { value: 'EXP', raw: 'EXP', evidence: 'EXP', status: 'visible', imageIndex: 0 };
  c.warnings = ['Conflicting expiry dates in photos'];
  expect(reviewExtraction(data, 'medicine', 1).candidates[0].expiryValue.value).toBeNull();
});
it('rejects false signatures and oversized files, strips metadata after full decoding', async () => {
  await expect(
    normalizeImages([Buffer.from('%PDF not a photo').toString('base64')]),
  ).rejects.toMatchObject({ status: 415 });
  await expect(
    normalizeImages([Buffer.alloc(6 * 1024 * 1024 + 1).toString('base64')]),
  ).rejects.toMatchObject({ status: 413 });
  const original = await sharp({
    create: { width: 100, height: 80, channels: 3, background: '#125b57' },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const [normalized] = await normalizeImages([original.toString('base64')]);
  const meta = await sharp(normalized).metadata();
  expect(meta.exif).toBeUndefined();
  expect(meta.orientation).toBeUndefined();
  expect(meta.width).toBe(80);
  expect(meta.height).toBe(100);
});
it('reports a provider failure without mutating inventory or retaining image bytes', async () => {
  instance.close();
  instance = createApp(testConfig(dir, false));
  const agent = (await import('supertest')).default.agent(instance.app);
  const r = await agent
    .post('/api/auth/login')
    .set('Origin', testConfig(dir).origin)
    .send({ username: 'household', password: 'synthetic-password' })
    .expect(200);
  const h = { Origin: testConfig(dir).origin, 'x-csrf-token': r.body.csrf };
  vi.spyOn(Provider.prototype, 'extract').mockRejectedValue(
    new Error('synthetic provider failure'),
  );
  const draft = await agent.post('/api/imports').set(h).send({ mode: 'medicine' }).expect(201);
  await agent
    .post(`/api/imports/${draft.body.id}/extract`)
    .set(h)
    .send({ consent: true, images: [image] })
    .expect(500);
  expect(instance.store.packs()).toHaveLength(0);
  expect(
    instance.store.db
      .prepare('SELECT extraction_json,status FROM import_drafts WHERE id=?')
      .get(draft.body.id) as { extraction_json: null; status: string },
  ).toEqual({ extraction_json: null, status: 'cancelled' });
});

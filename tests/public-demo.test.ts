import { expect, test } from 'vitest';
import { createDemoApi } from '../src/web/demo/api';
import type { Inventory } from '../src/web/App';
import type { IntakeView } from '../src/contracts/assistant';
import { send } from '../src/web/api';
test('demo sessions are independent, responses cannot mutate state, and stale edits fail', () => {
  const api = createDemoApi(),
    other = createDemoApi(),
    initial = api<Inventory>('/inventory'),
    pack = initial.packs[0];
  pack.notes = 'External mutation';
  expect(api<Inventory>('/inventory').packs[0].notes).not.toBe('External mutation');
  const { id, product, productId, archived, createdAt, sourceFacts, purchase, ...fields } = pack;
  api(`/packs/${id}`, send('PUT', { ...fields, notes: 'Synthetic edit' }));
  expect(() => api(`/packs/${id}`, send('PUT', fields))).toThrow('This pack changed elsewhere');
  expect(other<Inventory>('/inventory').packs.every((p) => p.notes !== 'Synthetic edit')).toBe(
    true,
  );
  expect(() => api('/provider/key', send('PUT', { key: 'synthetic-not-a-real-key' }))).toThrow(
    'Endpoint not found.',
  );
  expect(() => api('/backups')).toThrow('Endpoint not found.');
});
test('demo scan confirmation is atomic and idempotent, with receipt quantity validation', () => {
  const api = createDemoApi(),
    before = api<Inventory>('/inventory');
  const { id } = api<{ id: string }>('/imports', send('POST', { mode: 'receipt' }));
  api(`/imports/${id}/extract`, send('POST', { consent: true, images: [] }));
  const pack = {
    quantity: 1,
    unit: 'pack',
    expiryValue: null,
    expiryPrecision: 'unknown',
    product: { name: 'Synthetic receipt' },
  };
  const purchase = {
    date: null,
    pharmacy: null,
    purchasedPacks: 1,
    unitPrice: null,
    lineTotal: null,
    currency: null,
  };
  const valid = { candidateIndex: 0, pack, packCount: 1, purchase, confirmedMedicine: true };
  const invalid = {
    ...valid,
    candidateIndex: 1,
    pack: { ...pack, product: null, productId: crypto.randomUUID() },
  };
  expect(() =>
    api(
      `/imports/${id}/confirm`,
      send('POST', { decisions: [valid, invalid], duplicateAcknowledged: false }),
    ),
  ).toThrow();
  expect(api<Inventory>('/inventory').packs).toHaveLength(before.packs.length);
  const input = send('POST', { decisions: [valid], duplicateAcknowledged: false });
  const saved = api(`/imports/${id}/confirm`, input);
  expect(api(`/imports/${id}/confirm`, input)).toEqual(saved);
  expect(api<Inventory>('/inventory').packs).toHaveLength(before.packs.length + 1);
});
test('demo urgency bypasses simulated processing and never downgrades', () => {
  const api = createDemoApi(),
    risk = {
      urgent: 'yes',
      adult: 'unknown',
      pregnancy: 'unknown',
      highRisk: 'unknown',
      unsafeExposure: 'unknown',
    };
  expect(
    api<IntakeView>(
      '/assistant/answer',
      send('POST', { message: 'Synthetic report', risk, useProvider: true, consent: false }),
    ).state,
  ).toBe('emergency');
  expect(
    api<IntakeView>(
      '/assistant/answer',
      send('POST', {
        message: 'No urgent symptoms',
        risk: { ...risk, urgent: 'no' },
        useProvider: false,
        consent: false,
      }),
    ).state,
  ).toBe('emergency');
  api('/auth/logout', send('POST', {}));
  api('/auth/login', send('POST', {}));
  expect(api<IntakeView>('/assistant').state).toBe('incomplete');
  const controller = new AbortController();
  controller.abort();
  expect(() => api('/inventory', { signal: controller.signal })).toThrow(
    'The operation was aborted.',
  );
});

import { randomUUID, createHash } from 'node:crypto';
import { Router, json } from 'express';
import { z } from 'zod';
import { Store } from './db.js';
import type { Session } from './auth.js';
import { HttpError } from './errors.js';
import { normalizeImages } from './media.js';
import { Provider } from './provider.js';
import { reviewExtraction } from '../domain/imports.js';
import { confirmationSchema, type Draft, type Extraction } from '../contracts/imports.js';
import { simulatedExtraction } from './simulation.js';
type DraftRow = {
  id: string;
  account_id: number;
  mode: 'medicine' | 'receipt';
  extraction_json: string | null;
  expires_at: number;
  status: string;
  fingerprint: string | null;
  decisions_json: string | null;
  result_json: string | null;
};
export class Imports {
  readonly router = Router();
  private running = new Map<string, AbortController>();
  constructor(
    private store: Store,
    private provider: Provider,
    private demo: boolean,
  ) {
    this.router.post('/imports', (req, res) => {
      const { mode } = z.strictObject({ mode: z.enum(['medicine', 'receipt']) }).parse(req.body);
      const count = (
        store.db
          .prepare(
            "SELECT COUNT(*) count FROM import_drafts WHERE status IN('ready','processing') AND expires_at>?",
          )
          .get(Date.now()) as { count: number }
      ).count;
      if (count >= 5)
        throw new HttpError(429, 'Finish or cancel an existing scan before starting another.');
      const id = randomUUID();
      store.db
        .prepare(
          "INSERT INTO import_drafts(id,account_id,mode,expires_at,status,created_at) VALUES(?,1,?,?,'processing',?)",
        )
        .run(id, mode, Date.now() + 30 * 60000, new Date().toISOString());
      res.status(201).json({ id });
    });
    this.router.post('/imports/:id/extract', json({ limit: '18mb' }), async (req, res) => {
      const row = this.row(z.string().uuid().parse(req.params.id));
      if (row.status !== 'processing' || this.running.has(row.id))
        throw new HttpError(409, 'This draft is already processing or reviewed.');
      const input = z
        .strictObject({
          consent: z.literal(true),
          images: z.array(z.string().max(8_388_612)).min(1).max(3),
        })
        .parse(req.body);
      const controller = new AbortController();
      this.running.set(row.id, controller);
      res.on('close', () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        const images = await normalizeImages(input.images);
        const raw = this.demo
          ? simulatedExtraction(row.mode)
          : await provider.extract(
              res.locals.session as Session,
              row.mode,
              images,
              controller.signal,
            );
        const extraction = reviewExtraction(raw, row.mode, images.length);
        if (controller.signal.aborted || this.row(row.id).status !== 'processing')
          throw new HttpError(409, 'This scan was cancelled.');
        const fingerprint =
          row.mode === 'receipt'
            ? createHash('sha256')
                .update(
                  JSON.stringify({
                    date: extraction.purchaseDate.value,
                    pharmacy: extraction.pharmacy.value,
                    lines: extraction.candidates.map((c) => [
                      c.name.value,
                      c.purchasedPacks.value,
                      c.lineTotal.value,
                    ]),
                  }),
                )
                .digest('hex')
            : null;
        store.db
          .prepare(
            "UPDATE import_drafts SET extraction_json=?,fingerprint=?,status='ready' WHERE id=? AND status='processing'",
          )
          .run(JSON.stringify(extraction), fingerprint, row.id);
        res.json(this.draft(row.id));
      } catch (error) {
        store.db
          .prepare(
            "UPDATE import_drafts SET extraction_json=NULL,status='cancelled' WHERE id=? AND status='processing'",
          )
          .run(row.id);
        throw error;
      } finally {
        this.running.delete(row.id);
      }
    });
    this.router.get('/imports/:id', (req, res) =>
      res.json(this.draft(z.string().uuid().parse(req.params.id))),
    );
    this.router.delete('/imports/:id', (req, res) => {
      const row = this.row(z.string().uuid().parse(req.params.id));
      if (row.status === 'confirmed')
        throw new HttpError(409, 'This import was already saved. Review its packs in the cabinet.');
      this.running.get(row.id)?.abort();
      store.db
        .prepare(
          "UPDATE import_drafts SET status='cancelled',extraction_json=NULL,decisions_json=NULL WHERE id=?",
        )
        .run(row.id);
      res.json({ cancelled: true });
    });
    this.router.post('/imports/:id/confirm', (req, res) => {
      const id = z.string().uuid().parse(req.params.id),
        input = confirmationSchema.parse(req.body),
        signature = JSON.stringify(input.decisions);
      const result = store.db
        .transaction(() => {
          const row = this.row(id, false);
          if (row.status === 'confirmed') {
            if (row.decisions_json !== signature)
              throw new HttpError(409, 'This import was already saved with different decisions.');
            return JSON.parse(row.result_json!);
          }
          if (row.status !== 'ready' || row.expires_at <= Date.now())
            throw new HttpError(410, 'This review has expired or was cancelled. Start a new scan.');
          const draft = this.draft(id);
          if (draft.duplicate && !input.duplicateAcknowledged)
            throw new HttpError(
              409,
              'This receipt resembles an earlier import. Confirm that this is a separate purchase.',
            );
          const indexes = input.decisions.map((d) => d.candidateIndex);
          if (
            new Set(indexes).size !== indexes.length ||
            indexes.some((i) => i >= draft.extraction.candidates.length)
          )
            throw new HttpError(400, 'Choose each visible line only once.');
          if (input.decisions.reduce((n, d) => n + d.packCount, 0) > 100)
            throw new HttpError(400, 'At most 100 packs can be saved in one import.');
          const ids: string[] = [];
          for (const decision of input.decisions) {
            if (
              row.mode === 'receipt' &&
              (!decision.purchase || decision.purchase.purchasedPacks !== decision.packCount)
            )
              throw new HttpError(
                400,
                'Confirm how many packs were purchased for every selected receipt line.',
              );
            const purchaseId = decision.purchase
              ? store.createPurchaseLine(decision.purchase)
              : null;
            for (let n = 0; n < decision.packCount; n++)
              ids.push(store.createPack(decision.pack, purchaseId).id);
          }
          const result = { packIds: ids };
          store.db
            .prepare('INSERT INTO import_consumptions VALUES(?,1,?,?,?,?)')
            .run(id, row.mode, row.fingerprint, JSON.stringify(ids), new Date().toISOString());
          store.db
            .prepare(
              "UPDATE import_drafts SET status='confirmed',extraction_json=NULL,decisions_json=?,result_json=? WHERE id=?",
            )
            .run(signature, JSON.stringify(result), id);
          return result;
        })
        .immediate();
      res.json(result);
    });
  }
  private row(id: string, checkExpiry = true): DraftRow {
    const r = this.store.db
      .prepare('SELECT * FROM import_drafts WHERE id=? AND account_id=1')
      .get(id) as DraftRow | undefined;
    if (!r) throw new HttpError(404, 'Scan not found.');
    if (checkExpiry && r.expires_at <= Date.now() && r.status !== 'confirmed')
      throw new HttpError(410, 'This scan expired. Start again with your photos.');
    return r;
  }
  draft(id: string): Draft {
    const r = this.row(id);
    if (r.status !== 'ready' || !r.extraction_json)
      throw new HttpError(409, 'This scan is not ready for review.');
    const duplicate =
      !!r.fingerprint &&
      !!this.store.db
        .prepare('SELECT 1 FROM import_consumptions WHERE fingerprint=? AND id!=?')
        .get(r.fingerprint, id);
    return {
      id,
      mode: r.mode,
      extraction: JSON.parse(r.extraction_json) as Extraction,
      expiresAt: r.expires_at,
      duplicate,
      simulated: this.demo,
      status: r.status,
    };
  }
  hasActiveDrafts(): boolean {
    return !!this.store.db
      .prepare("SELECT 1 FROM import_drafts WHERE status IN('ready','processing') AND expires_at>?")
      .get(Date.now());
  }
  cleanup() {
    for (const [id, c] of this.running) {
      const r = this.store.db
        .prepare('SELECT expires_at,status FROM import_drafts WHERE id=?')
        .get(id) as { expires_at: number; status: string } | undefined;
      if (!r || r.expires_at <= Date.now() || r.status === 'cancelled') c.abort();
    }
    this.store.db
      .prepare(
        "UPDATE import_drafts SET status='cancelled',extraction_json=NULL,decisions_json=NULL WHERE expires_at<=? AND status IN('processing','ready')",
      )
      .run(Date.now());
  }
  close() {
    for (const c of this.running.values()) c.abort();
    this.running.clear();
  }
}

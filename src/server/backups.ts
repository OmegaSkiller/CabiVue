import { Router, json } from 'express';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Store, type PurchaseRow } from './db.js';
import type { Auth } from './auth.js';
import type { Imports } from './imports.js';
import { validateBackup, type Backup } from '../contracts/backup.js';
import { HttpError } from './errors.js';
export function exportBackup(store: Store): Backup {
  return store.db.transaction(() => {
    const products = store.products();
    const purchases = store.db
      .prepare('SELECT * FROM purchase_lines ORDER BY id')
      .all() as PurchaseRow[];
    const consumptions = store.db
      .prepare('SELECT * FROM import_consumptions ORDER BY id')
      .all() as {
      id: string;
      mode: 'medicine' | 'receipt';
      fingerprint: string | null;
      pack_ids_json: string;
      confirmed_at: string;
    }[];
    return {
      format: 'cabivue' as const,
      schemaVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      settings: store.settings(),
      locations: store.locations(),
      products,
      packs: store.packs().map(({ product, sourceFacts, purchase, ...pack }) => pack),
      sources: products.flatMap((p) => store.sources(p.id)),
      purchaseLines: purchases.map((p) => ({
        id: p.id,
        date: p.purchase_date,
        pharmacy: p.pharmacy,
        purchasedPacks: p.purchased_packs,
        unitPrice: p.unit_price,
        lineTotal: p.line_total,
        currency: p.currency,
      })),
      packPurchases: (
        store.db
          .prepare('SELECT pack_id,purchase_line_id FROM pack_purchases ORDER BY pack_id')
          .all() as { pack_id: string; purchase_line_id: string }[]
      ).map((p) => ({ packId: p.pack_id, purchaseLineId: p.purchase_line_id })),
      imports: consumptions.map((r) => ({
        id: r.id,
        mode: r.mode,
        fingerprint: r.fingerprint,
        packIds: JSON.parse(r.pack_ids_json),
        confirmedAt: r.confirmed_at,
      })),
    };
  })();
}
export function backupRevision(backup: Backup): string {
  const { exportedAt, ...content } = backup;
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
const recoveryName = z.string().regex(/^recovery-\d{13}-[a-f0-9-]{36}\.json$/);
export function backupRouter(store: Store, auth: Auth, imports: Imports) {
  const router = Router(),
    folder = join(store.dataDir, 'recovery');
  router.get('/backups/export', (_req, res) => {
    const b = exportBackup(store);
    res.set(
      'Content-Disposition',
      `attachment; filename="cabivue-${b.exportedAt.slice(0, 10)}.json"`,
    );
    res.json(b);
  });
  router.get('/backups/status', (_req, res) =>
    res.json({ revision: backupRevision(exportBackup(store)) }),
  );
  router.get('/backups/recovery', (_req, res) => {
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    res.json({
      files: readdirSync(folder)
        .filter((f) => recoveryName.safeParse(f).success)
        .sort()
        .reverse(),
    });
  });
  router.get('/backups/recovery/:name', (req, res) => {
    const name = recoveryName.parse(req.params.name);
    try {
      const content = readFileSync(join(folder, name), 'utf8');
      res.set('Content-Disposition', `attachment; filename="${name}"`).type('json').send(content);
    } catch {
      throw new HttpError(404, 'Recovery point not found.');
    }
  });
  router.post('/backups/restore', json({ limit: '9mb' }), (req, res) => {
    const input = z
      .strictObject({
        backup: z.unknown(),
        expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
        confirm: z.literal('RESTORE'),
      })
      .parse(req.body);
    let backup: Backup;
    try {
      backup = validateBackup(input.backup);
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof z.ZodError
          ? 'This backup is invalid or incompatible. No records were replaced.'
          : (error as Error).message,
      );
    }
    if (imports.hasActiveDrafts())
      throw new HttpError(409, 'Finish or cancel every active scan before restoring a backup.');
    const name = `recovery-${Date.now()}-${randomUUID()}.json`;
    store.db
      .transaction(() => {
        const current = exportBackup(store);
        if (backupRevision(current) !== input.expectedRevision)
          throw new HttpError(
            409,
            'Your cabinet changed after this restore was prepared. Review the current cabinet before trying again.',
          );
        mkdirSync(folder, { recursive: true, mode: 0o700 });
        const path = join(folder, name),
          fd = openSync(path, 'wx', 0o600);
        try {
          writeFileSync(fd, JSON.stringify(current, null, 2));
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        for (const directory of [folder, store.dataDir]) {
          const directoryFd = openSync(directory, 'r');
          try {
            fsyncSync(directoryFd);
          } finally {
            closeSync(directoryFd);
          }
        }
        const maxVersion = Math.max(
          0,
          ...backup.products.map((p) => p.version),
          ...backup.packs.map((p) => p.version),
          ...backup.sources.map((s) => s.productVersion),
        );
        store.db
          .prepare('UPDATE instance_revision SET revision=MAX(revision,?) WHERE id=1')
          .run(maxVersion);
        store.db.exec(
          'DELETE FROM packs; DELETE FROM products; DELETE FROM locations; DELETE FROM purchase_lines; DELETE FROM import_drafts; DELETE FROM import_consumptions;',
        );
        const versions = new Map<string, number>();
        for (const p of backup.products) {
          const version = store.nextRevision();
          versions.set(p.id, version);
          store.db
            .prepare(
              'INSERT INTO products(id,name,country,form,route,ingredient_text,identity_confirmed,prescription_status,version) VALUES(?,?,?,?,?,?,?,?,?)',
            )
            .run(
              p.id,
              p.name,
              p.country,
              p.form,
              p.route,
              p.ingredientText,
              Number(p.identityConfirmed),
              p.prescriptionStatus,
              version,
            );
          p.ingredients.forEach((i, n) =>
            store.db
              .prepare('INSERT INTO ingredients VALUES(?,?,?,?,?,?)')
              .run(p.id, n, i.name, i.strength, i.unit, i.basis),
          );
        }
        for (const l of backup.locations)
          store.db.prepare('INSERT INTO locations VALUES(?,?)').run(l.id, l.name);
        for (const p of backup.packs)
          store.db
            .prepare(
              'INSERT INTO packs(id,product_id,quantity,unit,location_id,expiry_value,expiry_precision,expiry_text,batch,opened_date,storage_uncertain,notes,version,archived,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            )
            .run(
              p.id,
              p.productId,
              p.quantity,
              p.unit,
              p.locationId,
              p.expiryValue,
              p.expiryPrecision,
              p.expiryText,
              p.batch,
              p.openedDate,
              Number(p.storageUncertain),
              p.notes,
              store.nextRevision(),
              Number(p.archived),
              p.createdAt,
            );
        for (const s of backup.sources)
          store.db
            .prepare(
              'INSERT INTO source_facts(id,product_id,official_url,revision,provenance,review_status,facts_json,after_opening_days,expiry_convention,permission,reviewed_at,product_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
            )
            .run(
              s.id,
              s.productId,
              s.officialUrl,
              s.revision,
              s.provenance,
              s.reviewStatus,
              JSON.stringify(s.facts),
              s.afterOpeningDays,
              s.expiryConvention,
              s.permission,
              s.reviewedAt,
              s.productVersion === backup.products.find((p) => p.id === s.productId)!.version
                ? versions.get(s.productId)!
                : s.productVersion,
            );
        for (const p of backup.purchaseLines)
          store.db
            .prepare('INSERT INTO purchase_lines VALUES(?,?,?,?,?,?,?)')
            .run(p.id, p.date, p.pharmacy, p.purchasedPacks, p.unitPrice, p.lineTotal, p.currency);
        for (const p of backup.packPurchases)
          store.db
            .prepare('INSERT INTO pack_purchases VALUES(?,?)')
            .run(p.packId, p.purchaseLineId);
        for (const i of backup.imports)
          store.db
            .prepare('INSERT INTO import_consumptions VALUES(?,1,?,?,?,?)')
            .run(i.id, i.mode, i.fingerprint, JSON.stringify(i.packIds), i.confirmedAt);
        const s = backup.settings;
        store.db
          .prepare(
            'UPDATE settings SET timezone=?,emergency_contact=?,emergency_location=? WHERE id=1',
          )
          .run(s.timezone, s.emergencyContact, s.emergencyLocation);
      })
      .immediate();
    auth.clear();
    res.clearCookie('cabivue_session', { path: '/' });
    res.json({ restored: true, recoveryPoint: name, signInRequired: true });
  });
  return router;
}

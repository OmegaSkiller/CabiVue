import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  Pack,
  PackInput,
  PackFields,
  Product,
  ProductInput,
  SourceFact,
  Location,
  Purchase,
  Settings,
} from '../contracts/inventory.js';
import { HttpError } from './errors.js';
type ProductRow = {
  id: string;
  name: string;
  country: string;
  form: string | null;
  route: string | null;
  ingredient_text: string | null;
  identity_confirmed: number;
  prescription_status: Product['prescriptionStatus'];
  version: number;
};
type PackRow = {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  location_id: string | null;
  expiry_value: string | null;
  expiry_precision: Pack['expiryPrecision'];
  expiry_text: string | null;
  batch: string | null;
  opened_date: string | null;
  storage_uncertain: number;
  notes: string;
  version: number;
  archived: number;
  created_at: string;
};
type SourceRow = {
  id: string;
  product_id: string;
  official_url: string;
  revision: string;
  provenance: string;
  review_status: SourceFact['reviewStatus'];
  facts_json: string;
  after_opening_days: number | null;
  expiry_convention: SourceFact['expiryConvention'];
  permission: string;
  reviewed_at: string | null;
  product_version: number;
};
export type PurchaseRow = {
  id: string;
  purchase_date: string | null;
  pharmacy: string | null;
  purchased_packs: number | null;
  unit_price: number | null;
  line_total: number | null;
  currency: string | null;
};
export class Store {
  readonly db: Database.Database;
  constructor(
    public dataDir: string,
    migrations = resolve('migrations'),
  ) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const path = join(dataDir, 'cabivue.db');
    this.db = new Database(path);
    chmodSync(path, 0o600);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    for (const file of readdirSync(migrations)
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort())
      if (!this.db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(file))
        this.db
          .transaction(() => {
            this.db.exec(readFileSync(join(migrations, file), 'utf8'));
            this.db
              .prepare('INSERT INTO schema_migrations VALUES(?,?)')
              .run(file, new Date().toISOString());
          })
          .immediate();
    this.db.prepare('DELETE FROM sessions').run();
    this.db
      .prepare(
        "UPDATE import_drafts SET status='cancelled',extraction_json=NULL WHERE status IN('ready','processing')",
      )
      .run();
  }
  // A durable instance counter prevents stale editors from matching restored rows.
  nextRevision(): number {
    this.db.prepare('UPDATE instance_revision SET revision=revision+1 WHERE id=1').run();
    return (
      this.db.prepare('SELECT revision FROM instance_revision WHERE id=1').get() as {
        revision: number;
      }
    ).revision;
  }
  settings(): Settings {
    const r = this.db.prepare('SELECT * FROM settings WHERE id=1').get() as {
      timezone: string;
      emergency_contact: string;
      emergency_location: string;
    };
    return {
      timezone: r.timezone,
      emergencyContact: r.emergency_contact,
      emergencyLocation: r.emergency_location,
    };
  }
  locations(): Location[] {
    return this.db.prepare('SELECT * FROM locations ORDER BY name').all() as Location[];
  }
  products(): Product[] {
    return (this.db.prepare('SELECT * FROM products ORDER BY id').all() as ProductRow[]).map((r) =>
      this.product(r),
    );
  }
  private product(r: ProductRow): Product {
    return {
      id: r.id,
      version: r.version,
      name: r.name,
      country: r.country,
      form: r.form,
      route: r.route,
      ingredientText: r.ingredient_text,
      identityConfirmed: !!r.identity_confirmed,
      prescriptionStatus: r.prescription_status,
      ingredients: this.db
        .prepare(
          'SELECT name,strength,unit,basis FROM ingredients WHERE product_id=? ORDER BY ordinal',
        )
        .all(r.id) as Product['ingredients'],
    };
  }
  sources(productId: string): SourceFact[] {
    return (
      this.db
        .prepare('SELECT * FROM source_facts WHERE product_id=? ORDER BY id')
        .all(productId) as SourceRow[]
    ).map((r) => ({
      id: r.id,
      productId: r.product_id,
      officialUrl: r.official_url,
      revision: r.revision,
      provenance: r.provenance,
      reviewStatus: r.review_status,
      facts: JSON.parse(r.facts_json),
      afterOpeningDays: r.after_opening_days,
      expiryConvention: r.expiry_convention,
      permission: r.permission,
      reviewedAt: r.reviewed_at,
      productVersion: r.product_version,
    }));
  }
  packs(): Pack[] {
    return (
      this.db.prepare('SELECT * FROM packs ORDER BY created_at DESC,id').all() as PackRow[]
    ).map((r) => this.pack(r));
  }
  getPack(id: string): Pack {
    const r = this.db.prepare('SELECT * FROM packs WHERE id=?').get(id) as PackRow | undefined;
    if (!r) throw new HttpError(404, 'Pack not found.');
    return this.pack(r);
  }
  private pack(r: PackRow): Pack {
    const product = this.product(
      this.db.prepare('SELECT * FROM products WHERE id=?').get(r.product_id) as ProductRow,
    );
    const p = this.db
      .prepare(
        'SELECT l.* FROM purchase_lines l JOIN pack_purchases p ON p.purchase_line_id=l.id WHERE p.pack_id=?',
      )
      .get(r.id) as PurchaseRow | undefined;
    return {
      id: r.id,
      productId: r.product_id,
      product,
      quantity: r.quantity,
      unit: r.unit,
      locationId: r.location_id,
      expiryValue: r.expiry_value,
      expiryPrecision: r.expiry_precision,
      expiryText: r.expiry_text,
      batch: r.batch,
      openedDate: r.opened_date,
      storageUncertain: !!r.storage_uncertain,
      notes: r.notes,
      version: r.version,
      archived: !!r.archived,
      createdAt: r.created_at,
      sourceFacts: this.sources(r.product_id),
      purchase: p
        ? {
            date: p.purchase_date,
            pharmacy: p.pharmacy,
            purchasedPacks: p.purchased_packs,
            unitPrice: p.unit_price,
            lineTotal: p.line_total,
            currency: p.currency,
          }
        : null,
    };
  }
  createProduct(input: ProductInput): string {
    const id = randomUUID();
    this.db
      .prepare(
        'INSERT INTO products(id,name,country,form,route,ingredient_text,identity_confirmed,version) VALUES(?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        input.name,
        input.country,
        input.form,
        input.route,
        input.ingredientText,
        Number(input.identityConfirmed),
        this.nextRevision(),
      );
    input.ingredients.forEach((i, n) =>
      this.db
        .prepare('INSERT INTO ingredients VALUES(?,?,?,?,?,?)')
        .run(id, n, i.name, i.strength, i.unit, i.basis),
    );
    return id;
  }
  editProduct(id: string, input: ProductInput & { version: number }): Product {
    return this.db
      .transaction(() => {
        const r = this.db
          .prepare(
            "UPDATE products SET name=?,country=?,form=?,route=?,ingredient_text=?,identity_confirmed=?,version=?,prescription_status='unknown' WHERE id=? AND version=?",
          )
          .run(
            input.name,
            input.country,
            input.form,
            input.route,
            input.ingredientText,
            Number(input.identityConfirmed),
            this.nextRevision(),
            id,
            input.version,
          );
        if (!r.changes) throw new HttpError(409, 'This product changed. Reload it before saving.');
        this.db.prepare('DELETE FROM ingredients WHERE product_id=?').run(id);
        input.ingredients.forEach((i, n) =>
          this.db
            .prepare('INSERT INTO ingredients VALUES(?,?,?,?,?,?)')
            .run(id, n, i.name, i.strength, i.unit, i.basis),
        );
        this.db
          .prepare("UPDATE source_facts SET review_status='unreviewed' WHERE product_id=?")
          .run(id);
        return this.product(
          this.db.prepare('SELECT * FROM products WHERE id=?').get(id) as ProductRow,
        );
      })
      .immediate();
  }
  createPurchaseLine(p: Purchase): string {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO purchase_lines VALUES(?,?,?,?,?,?,?)')
      .run(id, p.date, p.pharmacy, p.purchasedPacks, p.unitPrice, p.lineTotal, p.currency);
    return id;
  }
  createPack(input: PackInput, purchaseLineId: string | null = null): Pack {
    return this.db
      .transaction(() => {
        const productId = input.productId || this.createProduct(input.product!);
        if (!this.db.prepare('SELECT 1 FROM products WHERE id=?').get(productId))
          throw new HttpError(400, 'Choose an existing product.');
        this.validateLocation(input.locationId);
        const id = randomUUID();
        this.db
          .prepare(
            'INSERT INTO packs(id,product_id,quantity,unit,location_id,expiry_value,expiry_precision,expiry_text,batch,opened_date,storage_uncertain,notes,created_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          )
          .run(
            id,
            productId,
            input.quantity,
            input.unit,
            input.locationId,
            input.expiryValue,
            input.expiryPrecision,
            input.expiryText,
            input.batch,
            input.openedDate,
            Number(input.storageUncertain),
            input.notes,
            new Date().toISOString(),
            this.nextRevision(),
          );
        if (purchaseLineId)
          this.db.prepare('INSERT INTO pack_purchases VALUES(?,?)').run(id, purchaseLineId);
        return this.getPack(id);
      })
      .immediate();
  }
  private validateLocation(id: string | null) {
    if (id && !this.db.prepare('SELECT 1 FROM locations WHERE id=?').get(id))
      throw new HttpError(400, 'Choose an existing storage location.');
  }
  editPack(id: string, input: PackFields & { version: number }): Pack {
    return this.db
      .transaction(() => {
        this.validateLocation(input.locationId);
        const r = this.db
          .prepare(
            'UPDATE packs SET quantity=?,unit=?,location_id=?,expiry_value=?,expiry_precision=?,expiry_text=?,batch=?,opened_date=?,storage_uncertain=?,notes=?,version=? WHERE id=? AND version=?',
          )
          .run(
            input.quantity,
            input.unit,
            input.locationId,
            input.expiryValue,
            input.expiryPrecision,
            input.expiryText,
            input.batch,
            input.openedDate,
            Number(input.storageUncertain),
            input.notes,
            this.nextRevision(),
            id,
            input.version,
          );
        if (!r.changes) {
          this.getPack(id);
          throw new HttpError(409, 'This pack changed in another window. Reload it before saving.');
        }
        return this.getPack(id);
      })
      .immediate();
  }
  archivePack(id: string, version: number, archived: boolean): Pack {
    return this.db
      .transaction(() => {
        if (
          !this.db
            .prepare('UPDATE packs SET archived=?,version=? WHERE id=? AND version=?')
            .run(Number(archived), this.nextRevision(), id, version).changes
        )
          throw new HttpError(409, 'This pack changed. Reload before archiving.');
        return this.getPack(id);
      })
      .immediate();
  }
  deletePack(id: string, version: number) {
    this.db
      .transaction(() => {
        if (!this.db.prepare('DELETE FROM packs WHERE id=? AND version=?').run(id, version).changes)
          throw new HttpError(409, 'This pack changed. Reload before deleting.');
        this.nextRevision();
      })
      .immediate();
  }
  close() {
    this.db.close();
  }
}

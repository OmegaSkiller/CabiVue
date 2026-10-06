import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
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
type Row = Record<string, any>;
export class Store {
  readonly db: Database.Database;
  constructor(
    public dataDir: string,
    migrations = resolve('migrations'),
  ) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new Database(join(dataDir, 'cabivue.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    for (const file of readdirSync(migrations)
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort()) {
      if (!this.db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(file))
        this.db
          .transaction(() => {
            this.db.exec(readFileSync(join(migrations, file), 'utf8'));
            this.db
              .prepare('INSERT INTO schema_migrations VALUES (?,?)')
              .run(file, new Date().toISOString());
          })
          .immediate();
    }
    // A restart invalidates all sessions and transient provider state together.
    this.db.prepare('DELETE FROM sessions').run();
    this.db
      .prepare(
        "UPDATE import_drafts SET status='cancelled', extraction_json=NULL WHERE status IN('ready','processing')",
      )
      .run();
  }
  settings(): Settings {
    const r = this.db.prepare('SELECT * FROM settings WHERE id=1').get() as Row;
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
    return (this.db.prepare('SELECT * FROM products ORDER BY name').all() as Row[]).map((r) =>
      this.product(r),
    );
  }
  private product(r: Row): Product {
    return {
      id: r.id,
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
      this.db.prepare('SELECT * FROM source_facts WHERE product_id=?').all(productId) as Row[]
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
    }));
  }
  packs(): Pack[] {
    return (this.db.prepare('SELECT * FROM packs ORDER BY created_at DESC,id').all() as Row[]).map(
      (r) => this.pack(r),
    );
  }
  getPack(id: string): Pack {
    const row = this.db.prepare('SELECT * FROM packs WHERE id=?').get(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Pack not found.');
    return this.pack(row);
  }
  private pack(r: Row): Pack {
    const product = this.product(
      this.db.prepare('SELECT * FROM products WHERE id=?').get(r.product_id) as Row,
    );
    const purchase = this.db.prepare('SELECT * FROM purchases WHERE pack_id=?').get(r.id) as
      Row | undefined;
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
      purchase: purchase
        ? {
            date: purchase.purchase_date,
            pharmacy: purchase.pharmacy,
            purchasedPacks: purchase.purchased_packs,
            unitPrice: purchase.unit_price,
            lineTotal: purchase.line_total,
            currency: purchase.currency,
          }
        : null,
    };
  }
  createProduct(input: ProductInput): string {
    const id = randomUUID();
    this.db
      .prepare(
        'INSERT INTO products(id,name,country,form,route,ingredient_text,identity_confirmed) VALUES(?,?,?,?,?,?,?)',
      )
      .run(
        id,
        input.name,
        input.country,
        input.form,
        input.route,
        input.ingredientText,
        Number(input.identityConfirmed),
      );
    input.ingredients.forEach((i, n) =>
      this.db
        .prepare('INSERT INTO ingredients VALUES(?,?,?,?,?,?)')
        .run(id, n, i.name, i.strength, i.unit, i.basis),
    );
    return id;
  }
  createPack(input: PackInput, purchase: Purchase | null = null): Pack {
    return this.db
      .transaction(() => {
        const productId = input.productId || this.createProduct(input.product!);
        if (!this.db.prepare('SELECT 1 FROM products WHERE id=?').get(productId))
          throw new HttpError(400, 'Choose an existing product.');
        this.validateLocation(input.locationId);
        const id = randomUUID();
        this.db
          .prepare(
            'INSERT INTO packs(id,product_id,quantity,unit,location_id,expiry_value,expiry_precision,expiry_text,batch,opened_date,storage_uncertain,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
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
          );
        if (purchase)
          this.db
            .prepare('INSERT INTO purchases VALUES(?,?,?,?,?,?,?,?)')
            .run(
              id,
              purchase.date,
              purchase.pharmacy,
              purchase.purchasedPacks,
              purchase.unitPrice,
              purchase.lineTotal,
              purchase.currency,
            );
        return this.getPack(id);
      })
      .immediate();
  }
  private validateLocation(id: string | null) {
    if (id && !this.db.prepare('SELECT 1 FROM locations WHERE id=?').get(id))
      throw new HttpError(400, 'Choose an existing storage location.');
  }
  editPack(id: string, input: PackFields & { version: number }): Pack {
    this.validateLocation(input.locationId);
    const r = this.db
      .prepare(
        'UPDATE packs SET quantity=?,unit=?,location_id=?,expiry_value=?,expiry_precision=?,expiry_text=?,batch=?,opened_date=?,storage_uncertain=?,notes=?,version=version+1 WHERE id=? AND version=?',
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
        id,
        input.version,
      );
    if (!r.changes) {
      this.getPack(id);
      throw new HttpError(409, 'This pack changed in another window. Reload it before saving.');
    }
    return this.getPack(id);
  }
  archivePack(id: string, version: number, archived: boolean) {
    if (
      !this.db
        .prepare('UPDATE packs SET archived=?,version=version+1 WHERE id=? AND version=?')
        .run(Number(archived), id, version).changes
    )
      throw new HttpError(409, 'This pack changed. Reload before archiving.');
    return this.getPack(id);
  }
  deletePack(id: string, version: number) {
    if (!this.db.prepare('DELETE FROM packs WHERE id=? AND version=?').run(id, version).changes)
      throw new HttpError(409, 'This pack changed. Reload before deleting.');
  }
  close() {
    this.db.close();
  }
}

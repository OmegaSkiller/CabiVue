import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Store } from './db.js';
import type { Config } from './config.js';
import type { Intake } from '../contracts/assistant.js';
import { HttpError } from './errors.js';
const scryptAsync = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(32).toString('hex');
  const derived = await scryptAsync(password, salt);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [, salt, key] = encoded.split('$');
  if (!salt || !key) return false;
  const derived = await scryptAsync(password, salt);
  const expected = Buffer.from(key, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
export const credentialsSchema = z.strictObject({
  username: z.string().trim().min(3).max(60),
  password: z.string().min(12).max(256),
});
export type Session = {
  hash: string;
  csrf: string;
  expiresAt: number;
  providerKey?: string;
  providerAbort?: AbortController;
  intake?: Intake;
};
export class Auth {
  readonly transient = new Map<string, Session>();
  constructor(
    private store: Store,
    private config: Config,
  ) {}
  configured() {
    return !!this.store.db.prepare('SELECT 1 FROM account WHERE id=1').get();
  }
  async bootstrap(secret: string, credentials: z.infer<typeof credentialsSchema>) {
    if (!this.config.bootstrapSecret || digest(secret) !== digest(this.config.bootstrapSecret))
      throw new HttpError(403, 'Setup could not be authorized.');
    const hash = await hashPassword(credentials.password);
    this.store.db
      .transaction(() => {
        if (this.configured()) throw new HttpError(409, 'This household is already configured.');
        this.store.db
          .prepare('INSERT INTO account VALUES(1,?,?,?)')
          .run(credentials.username, hash, new Date().toISOString());
      })
      .immediate();
    this.config.bootstrapSecret = null;
  }
  session(req: Request): Session | null {
    const token = (req.headers.cookie || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('cabivue_session='))
      ?.slice('cabivue_session='.length);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const hash = digest(token);
    const row = this.store.db
      .prepare('SELECT csrf,expires_at FROM sessions WHERE token_hash=?')
      .get(hash) as { csrf: string; expires_at: number } | undefined;
    if (!row || row.expires_at <= Date.now()) {
      this.destroy(hash);
      return null;
    }
    let session = this.transient.get(hash);
    if (!session) {
      session = { hash, csrf: row.csrf, expiresAt: row.expires_at };
      this.transient.set(hash, session);
    }
    return session;
  }
  require = (req: Request, res: Response, next: NextFunction) => {
    const session = this.session(req);
    if (!session) {
      next(new HttpError(401, 'Sign in to continue.'));
      return;
    }
    res.locals.session = session;
    next();
  };
  csrf = (req: Request, res: Response, next: NextFunction) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.get('x-csrf-token') !== (res.locals.session as Session).csrf
    ) {
      next(new HttpError(403, 'Your session changed. Reload and try again.'));
      return;
    }
    next();
  };
  async login(req: Request, res: Response, username: string, password: string) {
    const row = this.store.db
      .prepare('SELECT password_hash FROM account WHERE username=?')
      .get(username) as { password_hash: string } | undefined;
    // Equal work for a missing username, avoiding an account lookup timing shortcut.
    const encoded = row?.password_hash || `scrypt$${'0'.repeat(64)}$${'0'.repeat(128)}`;
    const valid = await verifyPassword(password, encoded);
    if (!valid || !row) throw new HttpError(401, 'Username or password is incorrect.');
    const old = this.session(req);
    if (old) this.destroy(old.hash);
    const token = randomBytes(32).toString('hex');
    const session: Session = {
      hash: digest(token),
      csrf: randomBytes(32).toString('hex'),
      expiresAt: Date.now() + this.config.sessionHours * 3600000,
    };
    this.store.db
      .prepare('INSERT INTO sessions VALUES(?,1,?,?)')
      .run(session.hash, session.csrf, session.expiresAt);
    this.transient.set(session.hash, session);
    res.cookie('cabivue_session', token, {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'strict',
      path: '/',
      maxAge: this.config.sessionHours * 3600000,
    });
    return session;
  }
  destroy(hash: string) {
    const state = this.transient.get(hash);
    if (state) {
      state.providerAbort?.abort();
      delete state.providerKey;
      delete state.intake;
    }
    this.transient.delete(hash);
    this.store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);
  }
  cleanup() {
    for (const [hash, session] of this.transient)
      if (session.expiresAt <= Date.now()) this.destroy(hash);
    this.store.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  }
  clear() {
    for (const hash of this.transient.keys()) this.destroy(hash);
  }
}

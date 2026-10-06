import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Store } from './db.js';
import { Auth, credentialsSchema, type Session } from './auth.js';
import type { Config } from './config.js';
import { HttpError } from './errors.js';
import { packInputSchema, packEditSchema, text } from '../contracts/inventory.js';
import { todayIn } from '../domain/expiry.js';
export function createApp(config: Config, store = new Store(config.dataDir)) {
  const app = express();
  const auth = new Auth(store, config);
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'blob:', 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.secureCookies ? [] : null,
        },
      },
      strictTransportSecurity: config.secureCookies ? undefined : false,
    }),
  );
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // Login and bootstrap also require the exact origin and JSON content-type.
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('origin') !== config.origin)
        return next(
          new HttpError(403, 'This request did not come from the configured app origin.'),
        );
      if (!req.is('application/json')) return next(new HttpError(415, 'Send JSON data.'));
    }
    next();
  });
  app.use('/api', express.json({ limit: '256kb' }));
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  });
  app.get('/api/auth/status', (req, res) => {
    const s = auth.session(req);
    res.json({
      configured: auth.configured(),
      authenticated: !!s,
      csrf: s?.csrf ?? null,
      demo: config.demo,
    });
  });
  app.post('/api/auth/bootstrap', loginLimit, async (req, res) => {
    const input = credentialsSchema.extend({ secret: z.string().max(300) }).parse(req.body);
    await auth.bootstrap(input.secret, input);
    res.status(201).json({ configured: true });
  });
  app.post('/api/auth/login', loginLimit, async (req, res) => {
    const input = credentialsSchema.parse(req.body);
    const s = await auth.login(req, res, input.username, input.password);
    res.json({ authenticated: true, csrf: s.csrf });
  });
  app.use('/api', auth.require, auth.csrf);
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 200,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: (_req, res) => (res.locals.session as Session).hash,
      message: { error: 'Too many requests. Try again in a minute.' },
    }),
  );
  app.post('/api/auth/logout', (req, res) => {
    auth.destroy((res.locals.session as Session).hash);
    res.clearCookie('cabivue_session', {
      path: '/',
      secure: config.secureCookies,
      httpOnly: true,
      sameSite: 'strict',
    });
    res.json({ authenticated: false });
  });
  app.get('/api/inventory', (_req, res) =>
    res.json({
      packs: store.packs(),
      products: store.products(),
      locations: store.locations(),
      settings: store.settings(),
      today: todayIn(store.settings().timezone),
    }),
  );
  app.post('/api/packs', (req, res) =>
    res.status(201).json(store.createPack(packInputSchema.parse(req.body))),
  );
  app.put('/api/packs/:id', (req, res) =>
    res.json(
      store.editPack(z.string().uuid().parse(req.params.id), packEditSchema.parse(req.body)),
    ),
  );
  app.post('/api/packs/:id/archive', (req, res) => {
    const v = z
      .strictObject({ version: z.number().int().positive(), archived: z.boolean() })
      .parse(req.body);
    res.json(store.archivePack(z.string().uuid().parse(req.params.id), v.version, v.archived));
  });
  app.delete('/api/packs/:id', (req, res) => {
    const v = z
      .strictObject({ version: z.number().int().positive(), confirm: z.literal('DELETE') })
      .parse(req.body);
    store.deletePack(z.string().uuid().parse(req.params.id), v.version);
    res.json({ deleted: true });
  });
  app.post('/api/locations', (req, res) => {
    const input = z.strictObject({ name: text.min(1) }).parse(req.body);
    const id = randomUUID();
    if (
      store.locations().some((l) => l.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())
    )
      throw new HttpError(409, 'A location with this name already exists.');
    store.db.prepare('INSERT INTO locations VALUES(?,?)').run(id, input.name);
    res.status(201).json({ id, name: input.name });
  });
  app.put('/api/settings', (req, res) => {
    const v = z
      .strictObject({
        timezone: z
          .string()
          .max(100)
          .refine((x) => {
            try {
              todayIn(x);
              return true;
            } catch {
              return false;
            }
          }, 'Enter a valid IANA timezone.'),
        emergencyContact: text,
        emergencyLocation: text,
      })
      .parse(req.body);
    store.db
      .prepare('UPDATE settings SET timezone=?,emergency_contact=?,emergency_location=? WHERE id=1')
      .run(v.timezone, v.emergencyContact, v.emergencyLocation);
    res.json(store.settings());
  });
  // Private features mount here before the catch-all and error boundary.
  const privateRoutes = express.Router();
  app.use('/api', privateRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  const web = resolve('dist/web');
  if (existsSync(web)) {
    app.use(express.static(web, { index: false }));
    app.get('/{*path}', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(resolve(web, 'index.html'));
    });
  }
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof ZodError) {
        res
          .status(400)
          .json({
            error: 'Check the fields and try again.',
            details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          });
        return;
      }
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const code = (error as { status?: number })?.status;
      res
        .status(code === 413 ? 413 : 500)
        .json({
          error:
            code === 413
              ? 'The upload is too large.'
              : 'The request could not be completed. Your changes were not saved.',
        });
    },
  );
  const cleanup = setInterval(() => auth.cleanup(), 60000);
  cleanup.unref();
  return {
    app,
    store,
    auth,
    privateRoutes,
    close: () => {
      clearInterval(cleanup);
      auth.clear();
      store.close();
    },
  };
}

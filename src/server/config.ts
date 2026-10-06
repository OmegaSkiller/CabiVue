import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export type Config = {
  dataDir: string;
  origin: string;
  port: number;
  secureCookies: boolean;
  trustProxy: string | false;
  bootstrapSecret: string | null;
  demo: boolean;
  sessionHours: number;
};
export function readConfig(): Config {
  const port = Number(process.env.PORT || 3000);
  const origin = process.env.APP_ORIGIN || `http://localhost:${port}`;
  const secureCookies = process.env.SECURE_COOKIES === 'true';
  if (new URL(origin).protocol === 'https:' && !secureCookies)
    throw new Error('HTTPS deployment requires SECURE_COOKIES=true.');
  if (
    new URL(origin).protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)
  )
    throw new Error('Non-local deployment requires an HTTPS APP_ORIGIN.');
  const file = process.env.BOOTSTRAP_SECRET_FILE;
  const bootstrapSecret = file
    ? readFileSync(file, 'utf8').trim()
    : process.env.BOOTSTRAP_SECRET || null;
  if (bootstrapSecret && bootstrapSecret.length < 32)
    throw new Error('Bootstrap secret must contain at least 32 characters.');
  return {
    dataDir: resolve(process.env.DATA_DIR || './data'),
    origin,
    port,
    secureCookies,
    trustProxy: process.env.TRUST_PROXY || false,
    bootstrapSecret,
    demo: process.env.DEMO_MODE === 'true',
    sessionHours: 12,
  };
}

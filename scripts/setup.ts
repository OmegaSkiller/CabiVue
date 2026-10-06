import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
mkdirSync('secrets', { recursive: true, mode: 0o700 });
if (existsSync('secrets/bootstrap'))
  throw new Error('A bootstrap secret already exists; it was preserved.');
writeFileSync('secrets/bootstrap', randomBytes(32).toString('hex'), { mode: 0o600 });
console.log(
  'Created secrets/bootstrap. Read it locally for the one-time setup form. Do not commit or share it.',
);

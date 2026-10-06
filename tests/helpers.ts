import request from 'supertest';
import type { createApp } from '../src/server/app.js';
export const origin = 'http://localhost:3000';
export const testConfig = (dataDir: string, demo = false) => ({
  dataDir,
  origin,
  port: 3000,
  secureCookies: false,
  trustProxy: false as const,
  bootstrapSecret: 's'.repeat(64),
  demo,
  sessionHours: 12,
});
export async function signIn(instance: ReturnType<typeof createApp>) {
  const agent = request.agent(instance.app);
  await agent
    .post('/api/auth/bootstrap')
    .set('Origin', origin)
    .send({ secret: 's'.repeat(64), username: 'household', password: 'synthetic-password' })
    .expect(201);
  const login = await agent
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({ username: 'household', password: 'synthetic-password' })
    .expect(200);
  const csrf = login.body.csrf as string;
  return { agent, csrf, headers: { Origin: origin, 'x-csrf-token': csrf } };
}

import { afterEach, it, expect, vi } from 'vitest';
import { Provider, MODEL_ID } from '../src/server/provider.js';
import { assistantExtractionSchema } from '../src/contracts/assistant.js';
const session = () => ({
  hash: 'synthetic-session',
  csrf: 'synthetic-csrf',
  expiresAt: Date.now() + 60000,
  providerKey: 'sk-synthetic-never-live-key',
  providerAbort: new AbortController(),
});
const valid = { urgency: 'incomplete', groups: [], packIds: [], sourceIds: [] };
const reply = (
  status = 'completed',
  content: unknown[] = [{ type: 'output_text', text: JSON.stringify(valid) }],
) =>
  new Response(
    JSON.stringify({
      id: 'resp_synthetic',
      object: 'response',
      model: MODEL_ID,
      status,
      output: [
        { type: 'message', role: 'assistant', id: 'msg_synthetic', status: 'completed', content },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
afterEach(() => vi.restoreAllMocks());
it('uses the fixed provider endpoint, pinned image-capable model, no retries and no response storage', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply());
  const provider = new Provider();
  expect(
    await provider.structured(
      session(),
      assistantExtractionSchema,
      'test',
      'Trusted policy',
      [{ type: 'input_text', text: 'Synthetic answer' }],
      new AbortController().signal,
    ),
  ).toEqual(valid);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(String(url)).toBe('https://api.openai.com/v1/responses');
  const body = JSON.parse(String(options!.body));
  expect(body.model).toBe(MODEL_ID);
  expect(body.store).toBe(false);
  expect(body.instructions).not.toContain('sk-synthetic');
  expect(body.text.format.type).toBe('json_schema');
});
it.each([
  ['refusal', () => reply('completed', [{ type: 'refusal', refusal: 'Synthetic refusal' }])],
  ['incomplete', () => reply('incomplete')],
  [
    'invalid schema',
    () => reply('completed', [{ type: 'output_text', text: '{"wrong":"schema"}' }]),
  ],
])('rejects %s without a billable retry', async (_name, response) => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response());
  await expect(
    new Provider().structured(
      session(),
      assistantExtractionSchema,
      'test',
      'Policy',
      [{ type: 'input_text', text: 'Synthetic' }],
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ status: 502 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('returns an actionable provider rate-limit error without retries', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        error: { message: 'SYNTHETIC SECRET MUST NOT BE EXPOSED', type: 'rate_limit' },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  await expect(
    new Provider().structured(
      session(),
      assistantExtractionSchema,
      'test',
      'Policy',
      [],
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ status: 429 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('enforces timeout and cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Abort', 'AbortError'));
  await expect(
    new Provider().structured(
      session(),
      assistantExtractionSchema,
      'test',
      'Policy',
      [],
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ status: 504 });
});

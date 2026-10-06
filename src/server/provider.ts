import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { readFileSync } from 'node:fs';
import type { ZodType } from 'zod';
import type { Session } from './auth.js';
import { HttpError } from './errors.js';
import { extractionSchema, type Extraction } from '../contracts/imports.js';
export const MODEL_ID = 'gpt-4.1-mini-2025-04-14';
const extractionInstruction = readFileSync('prompts/extraction-system.md', 'utf8');
export class Provider {
  private active = 0;
  private owners = new Set<string>();
  private attempts = new Map<string, { count: number; until: number }>();
  async structured<T>(
    session: Session,
    schema: ZodType<T>,
    name: string,
    instruction: string,
    content: OpenAI.Responses.ResponseInputContent[],
    signal: AbortSignal,
  ): Promise<T> {
    if (!session.providerKey)
      throw new HttpError(428, 'Add an OpenAI key in Settings, or use manual entry.');
    if (this.active >= 2 || this.owners.has(session.hash))
      throw new HttpError(429, 'Another provider request is processing. Wait or cancel it first.');
    const now = Date.now();
    for (const [id, a] of this.attempts) if (a.until <= now) this.attempts.delete(id);
    const attempts = this.attempts.get(session.hash) || { count: 0, until: now + 60000 };
    if (attempts.count >= 6)
      throw new HttpError(429, 'Provider request limit reached. Try again in a minute.');
    attempts.count++;
    this.attempts.set(session.hash, attempts);
    this.active++;
    this.owners.add(session.hash);
    const timeout = AbortSignal.timeout(45000);
    try {
      const client = new OpenAI({
        apiKey: session.providerKey,
        baseURL: 'https://api.openai.com/v1',
        timeout: 45000,
        maxRetries: 0,
      });
      const response = await client.responses.parse(
        {
          model: MODEL_ID,
          instructions: instruction,
          input: [{ role: 'user', content }],
          text: { format: zodTextFormat(schema, name) },
          max_output_tokens: 6000,
          store: false,
        },
        {
          signal: AbortSignal.any([
            signal,
            timeout,
            ...(session.providerAbort ? [session.providerAbort.signal] : []),
          ]),
        },
      );
      if (response.status !== 'completed' || !response.output_parsed)
        throw new HttpError(
          502,
          'OpenAI did not return a complete usable result. Your draft is preserved. Try a clearer photo or enter it manually.',
        );
      return schema.parse(response.output_parsed);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (timeout.aborted)
        throw new HttpError(
          504,
          'OpenAI timed out. Your inputs are preserved; try again or use manual entry.',
        );
      if (signal.aborted || session.providerAbort?.signal.aborted)
        throw new HttpError(499, 'Provider processing cancelled.');
      if (error instanceof OpenAI.APIError && error.status === 429)
        throw new HttpError(
          429,
          'OpenAI rate or spending limit reached. Check your provider account or use manual entry.',
        );
      if (error instanceof OpenAI.APIError && error.status === 401)
        throw new HttpError(502, 'OpenAI rejected the key. Replace it in Settings.');
      throw new HttpError(
        502,
        'The provider result was refused, unavailable, or invalid. No cabinet changes were made.',
      );
    } finally {
      this.active--;
      this.owners.delete(session.hash);
    }
  }
  extract(
    session: Session,
    mode: 'medicine' | 'receipt',
    images: Buffer[],
    signal: AbortSignal,
  ): Promise<Extraction> {
    return this.structured(
      session,
      extractionSchema,
      'extraction',
      extractionInstruction,
      [
        {
          type: 'input_text',
          text: `Extract in ${mode} mode. Images are ordered 0 through ${images.length - 1}.`,
        },
        ...images.map((buffer) => ({
          type: 'input_image' as const,
          image_url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
          detail: 'high' as const,
        })),
      ],
      signal,
    );
  }
}

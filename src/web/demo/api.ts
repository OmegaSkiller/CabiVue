import { z, ZodError } from 'zod';
import { ApiError } from '../api';
import {
  packInputSchema,
  packEditSchema,
  productSchema,
  text,
  type Pack,
  type PackInput,
  type Product,
  type Purchase,
  type Settings,
  type Location,
} from '../../contracts/inventory';
import {
  answerSchema,
  riskSchema,
  reportedGroupSchema,
  type IntakeView,
} from '../../contracts/assistant';
import { confirmationSchema, type Draft } from '../../contracts/imports';
import { todayIn, plusDays, guidanceBlocks } from '../../domain/expiry';
import {
  newIntake,
  nextGroup,
  evaluateIntake,
  QUESTIONS,
  PROFESSIONAL_REMINDER,
} from '../../domain/intake';
import { simulatedExtraction } from '../../domain/simulation';
import { reviewExtraction } from '../../domain/imports';

// This adapter is compiled only into the public Pages build. Nothing is persisted or sent.
export function createDemoApi() {
  let authenticated = true;
  let intake = newIntake();
  let revision = 0;
  let state: { packs: Pack[]; products: Product[]; locations: Location[]; settings: Settings } = {
    packs: [],
    products: [],
    locations: [{ id: crypto.randomUUID(), name: 'Hallway cupboard' }],
    settings: { timezone: 'Europe/Sofia', emergencyContact: '', emergencyLocation: '' },
  };
  const drafts = new Map<
    string,
    {
      mode: 'medicine' | 'receipt';
      expiresAt: number;
      draft?: Draft;
      saved?: { signature: string; packIds: string[] };
    }
  >();
  const fail = (status: number, message: string): never => {
    throw new ApiError(message, status);
  };
  const getPack = (id: string) =>
    state.packs.find((p) => p.id === id) || fail(404, 'Pack not found.');
  const checkLocation = (id: string | null) => {
    if (id && !state.locations.some((l) => l.id === id))
      fail(400, 'Choose an existing storage location.');
  };
  function createPack(input: PackInput, purchase: Purchase | null = null) {
    checkLocation(input.locationId);
    const product: Product = input.productId
      ? state.products.find((p) => p.id === input.productId) ||
        fail(400, 'Choose an existing product.')
      : {
          ...input.product!,
          id: crypto.randomUUID(),
          version: ++revision,
          prescriptionStatus: 'unknown',
        };
    if (!input.productId) state.products.push(product);
    const { product: _, productId: __, ...fields } = input;
    const pack: Pack = {
      ...fields,
      id: crypto.randomUUID(),
      productId: product.id,
      product,
      version: ++revision,
      archived: false,
      createdAt: new Date().toISOString(),
      sourceFacts: [],
      purchase,
    };
    state.packs.unshift(pack);
    return pack;
  }
  const today = todayIn(state.settings.timezone);
  for (const [name, expiryValue, expiryPrecision, quantity, unit, form] of [
    ['Sample tablets · synthetic', null, 'unknown', 12, 'tablet', 'Tablets'],
    ['Sample drops · synthetic', plusDays(today, 20), 'day', 1, 'pack', 'Drops'],
    ['Sample cream · synthetic', plusDays(today, -10), 'day', 1, 'pack', 'Cream'],
    [
      'Синтетичен пример с дълго име за проверка на кирилица',
      plusDays(today, 200).slice(0, 7),
      'month',
      2,
      'pack',
      'Fictional sample',
    ],
  ] as const)
    createPack(
      packInputSchema.parse({
        quantity,
        unit,
        locationId: state.locations[0].id,
        expiryValue,
        expiryPrecision,
        batch: 'DEMO',
        notes: 'Synthetic demonstration. Not real medicine information.',
        product: { name, country: 'BG', form, ingredientText: 'Fictional sample — not a medicine' },
      }),
    );
  function view(): IntakeView {
    const next = nextGroup(intake);
    return {
      ...intake,
      nextGroup: next,
      question: intake.state === 'emergency' || next === null ? null : QUESTIONS[next],
      questions: QUESTIONS,
      urgentContact: state.settings.emergencyContact,
      urgentLocation: state.settings.emergencyLocation,
      reminder: PROFESSIONAL_REMINDER,
      simulated: true,
    };
  }
  function route(path: string, method: string, body: unknown): unknown {
    if (path === '/auth/status') return { configured: true, authenticated, demo: true, csrf: null };
    if (path === '/auth/login' && method === 'POST') {
      authenticated = true;
      return { authenticated: true, csrf: null };
    }
    if (!authenticated) fail(401, 'Sign in to continue.');
    if (path === '/auth/logout' && method === 'POST') {
      authenticated = false;
      intake = newIntake();
      drafts.clear();
      return { authenticated: false };
    }
    if (path === '/inventory' && method === 'GET')
      return { ...state, today: todayIn(state.settings.timezone) };
    if (path === '/packs' && method === 'POST') return createPack(packInputSchema.parse(body));
    const packMatch = path.match(/^\/packs\/([^/]+)(\/archive)?$/);
    if (packMatch) {
      const pack = getPack(packMatch[1]);
      const version = z.object({ version: z.number().int().positive() }).parse(body).version;
      if (version !== pack.version)
        fail(409, 'This pack changed elsewhere. Reopen it and try again.');
      if (method === 'PUT' && !packMatch[2]) {
        const v = packEditSchema.parse(body);
        checkLocation(v.locationId);
        Object.assign(pack, v, { version: ++revision });
        return pack;
      }
      if (method === 'POST' && packMatch[2]) {
        const v = z
          .strictObject({ version: z.number().int().positive(), archived: z.boolean() })
          .parse(body);
        pack.archived = v.archived;
        pack.version = ++revision;
        return pack;
      }
      if (method === 'DELETE' && !packMatch[2]) {
        z.strictObject({
          version: z.number().int().positive(),
          confirm: z.literal('DELETE'),
        }).parse(body);
        state.packs = state.packs.filter((p) => p.id !== pack.id);
        return { deleted: true };
      }
    }
    const productMatch = path.match(/^\/products\/([^/]+)$/);
    if (productMatch && method === 'PUT') {
      const product =
        state.products.find((p) => p.id === productMatch[1]) || fail(404, 'Product not found.');
      const input = productSchema.extend({ version: z.number().int().positive() }).parse(body);
      if (input.version !== product.version)
        fail(409, 'This product changed elsewhere. Reopen it and try again.');
      Object.assign(product, input, { version: ++revision });
      for (const pack of state.packs.filter((p) => p.productId === product.id))
        pack.product = product;
      return product;
    }
    if (path === '/locations' && method === 'POST') {
      const { name } = z.strictObject({ name: text.min(1) }).parse(body);
      if (state.locations.some((l) => l.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        fail(409, 'A location with this name already exists.');
      const location = { id: crypto.randomUUID(), name };
      state.locations.push(location);
      return location;
    }
    if (path === '/settings' && method === 'PUT') {
      const input = z
        .strictObject({
          timezone: z
            .string()
            .max(100)
            .refine((v) => {
              try {
                todayIn(v);
                return true;
              } catch {
                return false;
              }
            }),
          emergencyContact: text,
          emergencyLocation: text,
        })
        .parse(body);
      state.settings = input;
      return input;
    }
    if (path === '/assistant') {
      if (method === 'DELETE') intake = newIntake();
      if (method === 'GET' || method === 'DELETE') return view();
    }
    const facts = path.match(/^\/assistant\/pack\/([^/]+)$/);
    if (facts && method === 'GET') {
      const pack = getPack(facts[1]);
      return {
        pack,
        blocks: guidanceBlocks(pack, todayIn(state.settings.timezone)),
        reminder: PROFESSIONAL_REMINDER,
      };
    }
    if (path === '/assistant/answer' && method === 'POST') {
      const input = answerSchema.parse(body);
      // Simulation retains the same application-enforced escalation and explicit unknowns.
      intake.state = evaluateIntake(intake, input.risk, input.message);
      intake.risk = input.risk;
      intake.confirmed = false;
      if (intake.state === 'emergency') return view();
      if (input.useProvider && !input.consent)
        fail(400, 'Consent is required before sending an answer to OpenAI.');

      const index = nextGroup(intake);
      if (index === null)
        return fail(409, 'Review or edit your summary before starting a new interview.');
      intake.groups[index] = {
        groupIndex: index,
        quote: input.message,
        status: /^(unknown|not sure|unsure|не знаю|не знам)$/iu.test(input.message)
          ? 'unknown'
          : /^no\b/iu.test(input.message)
            ? 'no'
            : 'reported',
      };
      intake.state = evaluateIntake(intake, intake.risk);
      return view();
    }
    if (path === '/assistant/summary' && method === 'PUT') {
      const v = z
        .strictObject({
          groups: z.array(reportedGroupSchema).length(5),
          risk: riskSchema,
          confirm: z.literal(true),
        })
        .parse(body);
      if (new Set(v.groups.map((g) => g.groupIndex)).size !== 5)
        fail(400, 'Include each interview group once.');
      intake.groups = v.groups
        .sort((a, b) => a.groupIndex - b.groupIndex)
        .map((g) => ({ ...g, status: g.quote === null ? 'unknown' : g.status }));
      intake.risk = v.risk;
      intake.state = evaluateIntake(intake, v.risk, v.groups.map((g) => g.quote || '').join('\n'));
      intake.confirmed = true;
      return view();
    }
    if (path === '/imports' && method === 'POST') {
      const { mode } = z.strictObject({ mode: z.enum(['medicine', 'receipt']) }).parse(body);
      if ([...drafts.values()].filter((d) => !d.saved && d.expiresAt > Date.now()).length >= 5)
        fail(409, 'Finish or cancel an existing scan before starting another.');
      const id = crypto.randomUUID();
      drafts.set(id, { mode, expiresAt: Date.now() + 1800000 });
      return { id };
    }
    const scan = path.match(/^\/imports\/([^/]+)(\/(extract|confirm))?$/);
    if (scan) {
      const entry = drafts.get(scan[1]) || fail(404, 'Scan not found.');
      if (method === 'DELETE') {
        if (entry.saved)
          fail(409, 'This import was already saved. Review its packs in the cabinet.');
        drafts.delete(scan[1]);
        return { cancelled: true };
      }
      if (scan[3] === 'confirm' && method === 'POST') {
        const input = confirmationSchema.parse(body),
          signature = JSON.stringify(input.decisions);
        if (entry.saved) {
          if (entry.saved.signature !== signature)
            fail(409, 'This import was already saved with different decisions.');
          return { packIds: entry.saved.packIds };
        }
        if (!entry.draft || entry.expiresAt <= Date.now())
          fail(410, 'This review has expired or was cancelled. Start a new scan.');
        const indexes = input.decisions.map((d) => d.candidateIndex);
        if (
          new Set(indexes).size !== indexes.length ||
          indexes.some((i) => i >= entry.draft!.extraction.candidates.length)
        )
          fail(400, 'Choose each visible line only once.');
        if (input.decisions.reduce((n, d) => n + d.packCount, 0) > 100)
          fail(400, 'At most 100 packs can be saved in one import.');
        const packIds: string[] = [];
        for (const d of input.decisions) {
          if (
            entry.mode === 'receipt' &&
            (!d.purchase || d.purchase.purchasedPacks !== d.packCount)
          )
            fail(400, 'Confirm how many packs were purchased for every selected receipt line.');
          for (let n = 0; n < d.packCount; n++) packIds.push(createPack(d.pack, d.purchase).id);
        }
        entry.saved = { signature, packIds };
        delete entry.draft;
        return { packIds };
      }
      if (entry.expiresAt <= Date.now())
        fail(410, 'This scan expired. Start again with your photos.');
      if (scan[3] === 'extract' && method === 'POST') {
        // Photo bytes are never read, retained, or transmitted by the simulation.
        const { consent } = z.object({ consent: z.literal(true) }).parse(body);
        void consent;
        if (entry.draft || entry.saved) fail(409, 'This scan is not ready for review.');
        entry.draft = {
          id: scan[1],
          mode: entry.mode,
          expiresAt: entry.expiresAt,
          duplicate: false,
          simulated: true,
          status: 'ready',
          extraction: reviewExtraction(simulatedExtraction(entry.mode), entry.mode, 1),
        };
        return entry.draft;
      }
      if (!scan[3] && method === 'GET')
        return entry.draft || fail(409, 'This scan is not ready for review.');
    }
    return fail(404, 'Endpoint not found.');
  }
  return <T>(path: string, options: RequestInit = {}): T => {
    if (options.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const previous = structuredClone(state),
      priorIntake = structuredClone(intake);
    try {
      return structuredClone(
        route(path, options.method || 'GET', options.body ? JSON.parse(String(options.body)) : {}),
      ) as T;
    } catch (error) {
      state = previous;
      intake = priorIntake;
      if (error instanceof ZodError) throw new ApiError('Check the fields and try again.', 400);
      throw error;
    }
  };
}
export const demoApi = createDemoApi();

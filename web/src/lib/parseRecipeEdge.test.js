import { describe, it, expect, vi } from 'vitest';
import recorded from '../test/recorded/paste-recipe-chili.json';
import {
  checkRecipeShape,
  handleParseRequest,
  MAX_INGREDIENTS,
  MAX_INPUT_CHARS,
  parseModelReply,
  PARSE_MODEL,
  RecipeReplyError,
} from '../../../supabase/functions/_shared/parse-recipe.ts';

// The recorded reply's text, as the Anthropic API returns it.
const recordedText = recorded.content[0].text;

function fakeUserClient({ user = { id: 'user-1' }, member = { id: 5, household_id: 3 } } = {}) {
  return {
    auth: {
      getUser: vi.fn(async () =>
        user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('bad') }
      ),
    },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: member, error: null }),
      };
      return chain;
    },
  };
}

// A service client in memory: the cap row, the ledger rows and the inserts.
function fakeServiceClient({ cap = 5, spentRows = [] } = {}) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        maybeSingle: async () => ({
          data: table === 'household_settings' ? { ai_monthly_cap_usd: cap } : null,
          error: null,
        }),
        insert: async (row) => {
          inserts.push({ table, row });
          return { error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: table === 'ai_usage' ? spentRows : [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

function anthropicResponse(payload = recorded, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function request(body, { method = 'POST', auth = 'Bearer test-token' } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth) headers.authorization = auth;
  return new Request('https://example.test/functions/v1/parse-recipe', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('parseModelReply (recorded reply)', () => {
  it('reads the recorded reply into a Recipe with the expected ingredients', () => {
    const parsed = parseModelReply(recordedText);
    expect(parsed.name).toBe('Quick Bean Chili');
    expect(parsed.servings).toBe(4);
    expect(parsed.notes).toBe('Simmer 20 minutes. Freezes well.');
    expect(parsed.ingredients).toHaveLength(6);
    expect(parsed.ingredients[1]).toEqual({
      text: '2 eggs',
      name: 'eggs',
      amount: 2,
      unit: 'each',
    });
    expect(parsed.ingredients[5]).toEqual({
      text: 'salt to taste',
      name: 'salt',
      amount: null,
      unit: null,
    });
  });

  it('accepts the same JSON inside one code fence', () => {
    expect(parseModelReply('```json\n' + recordedText + '\n```').name).toBe('Quick Bean Chili');
  });

  it('refuses text that is not JSON', () => {
    expect(() => parseModelReply('Here is your recipe: ...')).toThrow(RecipeReplyError);
  });
});

describe('checkRecipeShape', () => {
  const good = () => ({
    name: 'Toast',
    servings: 1,
    notes: null,
    ingredients: [{ text: 'bread', name: 'bread', amount: 2, unit: 'each' }],
  });

  it('accepts a well-formed Recipe and trims the text', () => {
    const value = { ...good(), name: '  Toast  ', notes: '  ' };
    const parsed = checkRecipeShape(value);
    expect(parsed.name).toBe('Toast');
    expect(parsed.notes).toBeNull();
  });

  it('refuses extra or missing keys, at every level', () => {
    expect(() => checkRecipeShape({ ...good(), extra: 1 })).toThrow(/unexpected keys/);
    const noNotes = good();
    delete noNotes.notes;
    expect(() => checkRecipeShape(noNotes)).toThrow(/missing/);
    expect(() =>
      checkRecipeShape({ ...good(), ingredients: [{ ...good().ingredients[0], price: 3 }] })
    ).toThrow(/unexpected keys/);
  });

  it('refuses bad types and out-of-range values', () => {
    expect(() => checkRecipeShape({ ...good(), name: '' })).toThrow();
    expect(() => checkRecipeShape({ ...good(), name: 'x'.repeat(121) })).toThrow();
    expect(() => checkRecipeShape({ ...good(), servings: 0 })).toThrow();
    expect(() => checkRecipeShape({ ...good(), servings: '4' })).toThrow();
    expect(() => checkRecipeShape({ ...good(), servings: 1001 })).toThrow();
    expect(() => checkRecipeShape({ ...good(), ingredients: [] })).toThrow();
    expect(() => checkRecipeShape({ ...good(), ingredients: 'eggs' })).toThrow();
    const many = Array.from({ length: MAX_INGREDIENTS + 1 }, () => good().ingredients[0]);
    expect(() => checkRecipeShape({ ...good(), ingredients: many })).toThrow();
  });

  it('refuses a unit outside the list, and a non-positive amount', () => {
    const bad = (item) => ({ ...good(), ingredients: [{ ...good().ingredients[0], ...item }] });
    expect(() => checkRecipeShape(bad({ unit: 'pinch' }))).toThrow(/not a known unit/);
    expect(() => checkRecipeShape(bad({ amount: -1 }))).toThrow();
    expect(() => checkRecipeShape(bad({ amount: '2' }))).toThrow();
    expect(checkRecipeShape(bad({ unit: null, amount: null })).ingredients[0].unit).toBeNull();
  });
});

describe('handleParseRequest', () => {
  it('returns the Recipe, calls the model once, and records the usage', async () => {
    const service = fakeServiceClient();
    const fetchFn = vi.fn(async () => anthropicResponse());
    const res = await handleParseRequest(request({ text: 'Chili for four' }), {
      userClient: fakeUserClient(),
      serviceClient: service,
      apiKey: 'test-key-not-real',
      fetchFn,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Quick Bean Chili');
    expect(body.ingredients).toHaveLength(6);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-key-not-real');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe(PARSE_MODEL);
    expect(sent.messages[0].content).toContain('Chili for four');

    const ledger = service.inserts.find((entry) => entry.table === 'ai_usage');
    expect(ledger.row).toMatchObject({
      household_id: 3,
      member_id: 5,
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      input_tokens: 412,
      output_tokens: 236,
    });
  });

  it('refuses the call over the AI cap, before any model call', async () => {
    const service = fakeServiceClient({
      cap: 5,
      spentRows: [{ cost_usd: 5 }],
    });
    const fetchFn = vi.fn(async () => anthropicResponse());
    const res = await handleParseRequest(request({ text: 'Chili' }), {
      userClient: fakeUserClient(),
      serviceClient: service,
      apiKey: 'test-key-not-real',
      fetchFn,
    });

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      code: 'AI_LIMIT_REACHED',
      error: 'AI limit reached this month',
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(service.inserts).toHaveLength(0);
  });

  it('refuses a call without a signed-in user', async () => {
    const fetchFn = vi.fn();
    const res = await handleParseRequest(request({ text: 'Chili' }, { auth: null }), {
      userClient: fakeUserClient(),
      serviceClient: fakeServiceClient(),
      apiKey: 'k',
      fetchFn,
    });
    expect(res.status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses a caller with no Household', async () => {
    const res = await handleParseRequest(request({ text: 'Chili' }), {
      userClient: fakeUserClient({ member: null }),
      serviceClient: fakeServiceClient(),
      apiKey: 'k',
      fetchFn: vi.fn(),
    });
    expect(res.status).toBe(403);
  });

  it('refuses empty, long and non-JSON input', async () => {
    const deps = (fetchFn = vi.fn()) => ({
      userClient: fakeUserClient(),
      serviceClient: fakeServiceClient(),
      apiKey: 'k',
      fetchFn,
    });
    expect((await handleParseRequest(request({ text: '   ' }), deps())).status).toBe(400);
    expect(
      (await handleParseRequest(request({ text: 'x'.repeat(MAX_INPUT_CHARS + 1) }), deps())).status
    ).toBe(400);
    const notJson = new Request('https://example.test/f', {
      method: 'POST',
      headers: { authorization: 'Bearer t' },
      body: 'not json',
    });
    expect((await handleParseRequest(notJson, deps())).status).toBe(400);
  });

  it('says so when the key is not set, and makes no call', async () => {
    const fetchFn = vi.fn();
    const res = await handleParseRequest(request({ text: 'Chili' }), {
      userClient: fakeUserClient(),
      serviceClient: fakeServiceClient(),
      apiKey: undefined,
      fetchFn,
    });
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('NOT_CONFIGURED');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports a provider error without its body, and records nothing', async () => {
    const service = fakeServiceClient();
    const res = await handleParseRequest(request({ text: 'Chili' }), {
      userClient: fakeUserClient(),
      serviceClient: service,
      apiKey: 'k',
      fetchFn: vi.fn(async () => anthropicResponse({ error: 'secret detail' }, 500)),
    });
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('AI_FAILED');
    expect(service.inserts).toHaveLength(0);
  });

  it('records the spend, then refuses a reply that is not a Recipe', async () => {
    const service = fakeServiceClient();
    const junk = { ...recorded, content: [{ type: 'text', text: 'Sure! Here it is.' }] };
    const res = await handleParseRequest(request({ text: 'Chili' }), {
      userClient: fakeUserClient(),
      serviceClient: service,
      apiKey: 'k',
      fetchFn: vi.fn(async () => anthropicResponse(junk)),
    });
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('BAD_REPLY');
    expect(service.inserts.some((entry) => entry.table === 'ai_usage')).toBe(true);
  });

  it('answers the CORS preflight', async () => {
    const res = await handleParseRequest(request(undefined, { method: 'OPTIONS' }), {
      userClient: fakeUserClient(),
      serviceClient: fakeServiceClient(),
      apiKey: 'k',
      fetchFn: vi.fn(),
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

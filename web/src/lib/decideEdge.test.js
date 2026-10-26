import { describe, it, expect, vi } from 'vitest';
// Real Jev replies from the ticket #35 run (2026-10-25).
import jevRebalance from '../test/recorded/decide-jev-rebalance-en.json';
import jevVoice from '../test/recorded/decide-jev-voice-es.json';
// Shaped like the excerpts in OpenAI's Decisions guide; no live OpenAI run has been made.
import openaiVoice from '../test/recorded/decide-openai-voice-docs-shape.json';
// Shaped like an Anthropic Messages reply to HAIKU_SYSTEM_PROMPT.
import haikuRebalance from '../test/recorded/decide-haiku-rebalance.json';
import {
  buildJevRequest,
  buildOpenAiRequest,
  checkQuestions,
  decide,
  DecisionReplyError,
  handleDecideRequest,
  JEV_URL,
  NoDecisionError,
  OPENAI_URL,
  ANTHROPIC_URL,
  providerOrder,
  readHaikuReply,
  readJevReply,
  readOpenAiReply,
} from '../../../supabase/functions/_shared/decide.ts';
import { createAiGate } from '../../../supabase/functions/_shared/ai-gate.ts';

const REBALANCE = {
  over_by: {
    type: 'score',
    instructions: 'How far over its calorie target is the day?',
    levels: [
      { label: 'Just a bit over' },
      { label: 'Somewhat over' },
      { label: 'Clearly over' },
      { label: 'Far over' },
      { label: 'Way over' },
    ],
  },
  meal: {
    type: 'choice',
    instructions: 'Which Meal Time did the Member overeat at?',
    choices: ['breakfast', 'lunch', 'dinner', 'snack', 'other'].map((value) => ({ value })),
  },
  fix: {
    type: 'choice',
    instructions: 'What kind of fix does the Member want?',
    choices: [
      { value: 'lighter_later_today', description: 'Shrink a later meal today.' },
      { value: 'lighter_tomorrow', description: "Shrink tomorrow's meals." },
      { value: 'drop_if_room_meal', description: 'Drop an If room meal.' },
      { value: 'no_preference', description: 'No particular fix asked for.' },
    ],
  },
  gave_number: { type: 'yes_no', instructions: 'Did the Member state a calorie number?' },
};

const VOICE = {
  action: {
    type: 'choice',
    instructions: 'Which action does the spoken command most likely ask for?',
    choices: [
      'tick_shopping_line',
      'add_shopping_item',
      'log_planned_portion',
      'log_other',
      'mark_pantry_used',
      'start_rebalance',
    ].map((value) => ({ value })),
  },
  has_amount: { type: 'yes_no', instructions: 'Does the command contain an amount?' },
};

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

// A service client in memory: the cap row, ledger rows per provider and the inserts.
function fakeServiceClient({ cap = 5, spentByProvider = {} } = {}) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      let provider = null;
      const chain = {
        select: () => chain,
        eq: (column, value) => {
          if (column === 'provider') provider = value;
          return chain;
        },
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
          const spent = spentByProvider[provider] ?? 0;
          return Promise.resolve({
            data: table === 'ai_usage' && spent ? [{ cost_usd: spent }] : [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

const reply = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

// A fetch that answers by URL; a missing URL is a network error.
function fakeFetch(byUrl) {
  return vi.fn(async (url) => {
    const r = byUrl[url];
    if (!r) throw new Error(`no route for ${url}`);
    return typeof r === 'function' ? r() : r;
  });
}

const ALL_KEYS = { typesafe: 'ts-key', openai: 'oa-key', anthropic: 'an-key' };

function gateFor(service) {
  return createAiGate({ client: service, householdId: 3, memberId: 5 });
}

describe('providerOrder (the setting)', () => {
  it('defaults to Jev, then OpenAI, then the text model, for both languages', () => {
    expect(providerOrder('en', {})).toEqual(['jev', 'openai', 'haiku']);
    expect(providerOrder('es', {})).toEqual(['jev', 'openai', 'haiku']);
  });

  it('reads DECISION_PROVIDERS, and a per-language setting wins over it', () => {
    const env = { DECISION_PROVIDERS: 'openai, jev', DECISION_PROVIDERS_ES: 'haiku' };
    expect(providerOrder('en', env)).toEqual(['openai', 'jev']);
    expect(providerOrder('es', env)).toEqual(['haiku']);
  });

  it('ignores unknown and repeated names, and falls back when nothing is left', () => {
    expect(providerOrder('en', { DECISION_PROVIDERS: 'clef,jev,jev' })).toEqual(['jev']);
    expect(providerOrder('en', { DECISION_PROVIDERS: 'nobody' })).toEqual([
      'jev',
      'openai',
      'haiku',
    ]);
  });
});

describe('checkQuestions', () => {
  it('accepts the Rebalance and Voice question sets', () => {
    expect(Object.keys(checkQuestions(REBALANCE))).toEqual([
      'over_by',
      'meal',
      'fix',
      'gave_number',
    ]);
    expect(checkQuestions(VOICE).action.choices).toHaveLength(6);
  });

  it('refuses unknown types, one-option choices, repeated values and bad names', () => {
    expect(() => checkQuestions({ a: { type: 'text', instructions: 'x' } })).toThrow(
      DecisionReplyError
    );
    expect(() =>
      checkQuestions({ a: { type: 'choice', instructions: 'x', choices: [{ value: 'y' }] } })
    ).toThrow(/2 to/);
    expect(() =>
      checkQuestions({
        a: { type: 'choice', instructions: 'x', choices: [{ value: 'y' }, { value: 'y' }] },
      })
    ).toThrow(/repeats/);
    expect(() => checkQuestions({ 'Bad Name': { type: 'yes_no', instructions: 'x' } })).toThrow(
      /snake_case/
    );
    expect(() => checkQuestions({})).toThrow(/empty/);
  });
});

describe('request builders', () => {
  it('sends Jev the documented System One shape', () => {
    const body = buildJevRequest('Big lunch', REBALANCE);
    expect(body.model).toBe('jev-latest');
    expect(body.state).toBe('Big lunch');
    expect(body.questions.gave_number).toEqual({
      type: 'noul',
      instructions: REBALANCE.gave_number.instructions,
    });
    expect(body.questions.fix.criteria.lighter_tomorrow).toBe("Shrink tomorrow's meals.");
    expect(body.questions.meal.criteria.lunch).toBe('lunch');
    expect(body.questions.over_by.criteria).toHaveLength(5);
  });

  it('sends OpenAI an array of named questions, and object state as input_json', () => {
    const body = buildOpenAiRequest({ text: 'Tick the milk', plan: [] }, VOICE);
    expect(body.model).toBe('gpt-6-luna');
    expect(body.input[0].content[0]).toEqual({
      type: 'input_json',
      data: { text: 'Tick the milk', plan: [] },
    });
    expect(body.questions.map((q) => [q.name, q.type])).toEqual([
      ['action', 'choice'],
      ['has_amount', 'predicate'],
    ]);
  });
});

describe('one answer shape for every provider (recorded replies)', () => {
  it('reads a real Jev Rebalance reply', () => {
    const { model, answers } = readJevReply(jevRebalance, REBALANCE);
    expect(model).toBe('jev-1.14.0');
    expect(answers.meal).toMatchObject({ type: 'choice', value: 'lunch', confidence: 1 });
    expect(answers.fix.value).toBe('lighter_later_today');
    expect(answers.fix.probabilities.no_preference).toBe(0.43);
    expect(answers.over_by).toMatchObject({ type: 'score', value: 3.97, level: 4 });
    expect(answers.over_by.probabilities).toEqual([0, 0, 0, 0.01, 0.99]);
    expect(answers.gave_number).toEqual({ type: 'yes_no', value: false, probability: 0.03 });
  });

  it('reads a real Jev Voice reply in Spanish', () => {
    const { answers } = readJevReply(jevVoice, VOICE);
    expect(answers.action).toMatchObject({ value: 'tick_shopping_line', confidence: 0.99 });
    expect(answers.has_amount.value).toBe(false);
  });

  it('reads an OpenAI Decisions reply into the same shape', () => {
    const { model, answers } = readOpenAiReply(openaiVoice, VOICE);
    expect(model).toBe('gpt-6-luna');
    expect(answers.action).toEqual({
      type: 'choice',
      value: 'add_shopping_item',
      confidence: 0.88,
      probabilities: {
        tick_shopping_line: 0.05,
        add_shopping_item: 0.9,
        log_planned_portion: 0.01,
        log_other: 0.01,
        mark_pantry_used: 0.02,
        start_rebalance: 0.01,
      },
    });
    expect(answers.has_amount).toEqual({ type: 'yes_no', value: true, probability: 0.93 });
  });

  it('reads OpenAI score levels by index', () => {
    const payload = {
      answers: [
        {
          type: 'score',
          name: 'over_by',
          score: 2.6,
          confidence: 0.5,
          probabilities: [0, 0.1, 0.3, 0.5, 0.1].map((probability, value) => ({
            value,
            probability,
          })),
        },
      ],
    };
    const { answers } = readOpenAiReply(payload, { over_by: REBALANCE.over_by });
    expect(answers.over_by).toMatchObject({ value: 2.6, level: 3, confidence: 0.5 });
  });

  it('treats an OpenAI refusal as a failed reply', () => {
    const payload = { answers: [{ type: 'refusal', name: 'has_amount' }] };
    expect(() => readOpenAiReply(payload, { has_amount: VOICE.has_amount })).toThrow(/refused/);
  });

  it('reads the text model reply, with a derived confidence and a weighted score', () => {
    const { model, answers } = readHaikuReply(haikuRebalance, REBALANCE);
    expect(model).toBe('claude-haiku-5-5');
    expect(answers.meal).toMatchObject({ value: 'lunch', confidence: 0.9 });
    expect(answers.fix.value).toBe('no_preference');
    // 0.1*1 + 0.2*2 + 0.5*3 + 0.2*4 = 2.8
    expect(answers.over_by).toMatchObject({ value: 2.8, level: 3, confidence: 0.5 });
    expect(answers.gave_number.value).toBe(false);
  });

  it('refuses a reply that misses a question', () => {
    expect(() => readJevReply({ answers: {} }, VOICE)).toThrow(/did not answer action/);
    const bad = { content: [{ type: 'text', text: 'not json' }] };
    expect(() => readHaikuReply(bad, VOICE)).toThrow(/not JSON/);
  });
});

describe('decide: fallback and the AI ledger', () => {
  it('uses Jev when it answers, and records the call in the ledger', async () => {
    const service = fakeServiceClient();
    const fetchFn = fakeFetch({ [JEV_URL]: reply(jevVoice) });
    const decision = await decide('Marca la leche como comprada.', VOICE, {
      gate: gateFor(service),
      keys: ALL_KEYS,
      fetchFn,
      order: ['jev', 'openai', 'haiku'],
    });
    expect(decision.provider).toBe('jev');
    expect(decision.skipped).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer ts-key');
    expect(service.inserts).toEqual([
      {
        table: 'ai_usage',
        row: expect.objectContaining({
          household_id: 3,
          member_id: 5,
          provider: 'typesafe',
          model: 'jev',
          input_tokens: 464,
          output_tokens: 101,
        }),
      },
    ]);
  });

  it('tries the next provider when Jev errors', async () => {
    const service = fakeServiceClient();
    const fetchFn = fakeFetch({
      [JEV_URL]: reply({ detail: 'down' }, 503),
      [OPENAI_URL]: reply(openaiVoice),
    });
    const decision = await decide('Add two litres of milk', VOICE, {
      gate: gateFor(service),
      keys: ALL_KEYS,
      fetchFn,
      order: ['jev', 'openai', 'haiku'],
    });
    expect(decision.provider).toBe('openai');
    expect(decision.skipped).toEqual([{ provider: 'jev', reason: 'HTTP 503' }]);
    expect(service.inserts.map((i) => i.row.provider)).toEqual(['openai']);
  });

  it('falls back to the text model when the decision models are down or reply badly', async () => {
    const service = fakeServiceClient();
    const fetchFn = fakeFetch({
      [JEV_URL]: reply({ answers: {} }),
      [OPENAI_URL]: () => {
        throw new Error('network down');
      },
      [ANTHROPIC_URL]: reply(haikuRebalance),
    });
    const decision = await decide('Big lunch at a wedding', REBALANCE, {
      gate: gateFor(service),
      keys: ALL_KEYS,
      fetchFn,
      order: ['jev', 'openai', 'haiku'],
    });
    expect(decision.provider).toBe('haiku');
    expect(decision.skipped.map((s) => s.provider)).toEqual(['jev', 'openai']);
    // Jev returned, so its tokens are recorded even though its reply was unusable
    expect(service.inserts.map((i) => i.row.provider)).toEqual(['typesafe', 'anthropic']);
  });

  it('skips a provider with no key without calling it', async () => {
    const fetchFn = fakeFetch({ [OPENAI_URL]: reply(openaiVoice) });
    const decision = await decide('Add milk', VOICE, {
      gate: gateFor(fakeServiceClient()),
      keys: { openai: 'oa-key' },
      fetchFn,
      order: ['jev', 'openai'],
    });
    expect(decision.provider).toBe('openai');
    expect(decision.skipped).toEqual([{ provider: 'jev', reason: 'no key' }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('moves past a provider at its cap, and reports allCapped when all are', async () => {
    const service = fakeServiceClient({ spentByProvider: { typesafe: 5 } });
    const fetchFn = fakeFetch({ [OPENAI_URL]: reply(openaiVoice) });
    const ok = await decide('Add milk', VOICE, {
      gate: gateFor(service),
      keys: ALL_KEYS,
      fetchFn,
      order: ['jev', 'openai'],
    });
    expect(ok.skipped).toEqual([{ provider: 'jev', reason: 'AI cap' }]);

    const capped = fakeServiceClient({ spentByProvider: { typesafe: 5, openai: 6 } });
    await expect(
      decide('Add milk', VOICE, {
        gate: gateFor(capped),
        keys: ALL_KEYS,
        fetchFn,
        order: ['jev', 'openai'],
      })
    ).rejects.toMatchObject({ name: 'NoDecisionError', allCapped: true });
  });

  it('throws NoDecisionError when every provider fails', async () => {
    const fetchFn = fakeFetch({});
    await expect(
      decide('Add milk', VOICE, {
        gate: gateFor(fakeServiceClient()),
        keys: ALL_KEYS,
        fetchFn,
        order: ['jev', 'openai', 'haiku'],
      })
    ).rejects.toBeInstanceOf(NoDecisionError);
  });
});

function request(body, { method = 'POST', auth = 'Bearer test-token' } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth) headers.authorization = auth;
  return new Request('https://example.test/functions/v1/decide', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function handlerDeps(overrides = {}) {
  return {
    userClient: fakeUserClient(),
    serviceClient: fakeServiceClient(),
    keys: ALL_KEYS,
    env: {},
    fetchFn: fakeFetch({ [JEV_URL]: reply(jevVoice) }),
    ...overrides,
  };
}

describe('handleDecideRequest', () => {
  const body = { lang: 'es', state: 'Marca la leche como comprada.', questions: VOICE };

  it('returns the normalised answers and the provider that gave them', async () => {
    const res = await handleDecideRequest(request(body), handlerDeps());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe('jev');
    expect(json.answers.action.value).toBe('tick_shopping_line');
  });

  it('follows the per-language setting', async () => {
    const deps = handlerDeps({
      env: { DECISION_PROVIDERS_ES: 'openai' },
      fetchFn: fakeFetch({ [OPENAI_URL]: reply(openaiVoice) }),
    });
    const res = await handleDecideRequest(request(body), deps);
    expect((await res.json()).provider).toBe('openai');
  });

  it('needs a signed-in Member of a Household', async () => {
    expect((await handleDecideRequest(request(body, { auth: null }), handlerDeps())).status).toBe(
      401
    );
    const noMember = handlerDeps({ userClient: fakeUserClient({ member: null }) });
    expect((await handleDecideRequest(request(body), noMember)).status).toBe(403);
  });

  it('refuses a bad language, empty state or bad questions', async () => {
    const bad = async (b) => (await handleDecideRequest(request(b), handlerDeps())).json();
    expect((await bad({ ...body, lang: 'fr' })).code).toBe('BAD_LANG');
    expect((await bad({ ...body, state: '  ' })).code).toBe('EMPTY_STATE');
    expect((await bad({ ...body, state: 'x'.repeat(9000) })).code).toBe('STATE_TOO_LONG');
    expect((await bad({ ...body, questions: {} })).code).toBe('BAD_QUESTIONS');
  });

  it('says "AI limit reached this month" when every provider is capped', async () => {
    const deps = handlerDeps({
      serviceClient: fakeServiceClient({
        spentByProvider: { typesafe: 5, openai: 5, anthropic: 5 },
      }),
    });
    const res = await handleDecideRequest(request(body), deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      code: 'AI_LIMIT_REACHED',
      error: 'AI limit reached this month',
    });
  });

  it('reports NOT_CONFIGURED with no keys, and AI_FAILED when calls fail', async () => {
    const noKeys = await handleDecideRequest(request(body), handlerDeps({ keys: {} }));
    expect(noKeys.status).toBe(500);
    expect((await noKeys.json()).code).toBe('NOT_CONFIGURED');
    const down = await handleDecideRequest(request(body), handlerDeps({ fetchFn: fakeFetch({}) }));
    expect(down.status).toBe(502);
    expect((await down.json()).code).toBe('AI_FAILED');
  });
});

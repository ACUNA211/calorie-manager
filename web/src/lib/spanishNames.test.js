import { describe, it, expect, vi } from 'vitest';
import {
  buildGoogleRequest,
  parseGoogleResponse,
  buildAzureRequest,
  parseAzureResponse,
  cleanTranslation,
  billedCharacters,
  translateFoodName,
  MAX_NAME_LENGTH,
} from '../../../supabase/functions/_shared/translate.ts';
import { PRICES, priceFor } from '../../../supabase/functions/_shared/prices.ts';

// A response like fetch's: ok, status and json().
function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const googleOk = (text) => reply(200, { data: { translations: [{ translatedText: text }] } });
const azureOk = (text) => reply(200, [{ translations: [{ text, to: 'es' }] }]);

// A gate that behaves like ai-gate.ts's withAiCap: it runs the call, and when `refuse` is
// set it throws the same error the real gate throws over the cap, before calling.
function fakeGate({ refuse = false } = {}) {
  const calls = [];
  return {
    calls,
    withAiCap: vi.fn(async (provider, model, fn) => {
      if (refuse) {
        const error = new Error('AI limit reached this month');
        error.code = 'AI_LIMIT_REACHED';
        throw error;
      }
      const { result, usage } = await fn();
      calls.push({ provider, model, usage });
      return result;
    }),
  };
}

// A fetch that answers per host, and records each request.
function fakeFetch(answers) {
  const seen = [];
  const fetchImpl = vi.fn(async (url, init) => {
    seen.push({ url, init });
    const host = new URL(url).host;
    const answer = answers[host];
    if (typeof answer === 'function') return answer(url, init);
    return answer ?? reply(500, {});
  });
  return { fetchImpl, seen };
}

describe('Google request and response', () => {
  it('sends English to Spanish text in the body and the key in a header, not the URL', () => {
    const spec = buildGoogleRequest('Apples, raw', 'test-key');

    expect(spec.url).toBe('https://translation.googleapis.com/language/translate/v2');
    expect(spec.url).not.toContain('test-key');
    expect(spec.init.method).toBe('POST');
    expect(spec.init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(JSON.parse(spec.init.body)).toEqual({
      q: 'Apples, raw',
      source: 'en',
      target: 'es',
      format: 'text',
    });
  });

  it('reads the translated text', () => {
    expect(
      parseGoogleResponse({ data: { translations: [{ translatedText: 'Manzana cruda' }] } })
    ).toBe('Manzana cruda');
  });

  it('throws on an answer with no translation', () => {
    expect(() => parseGoogleResponse({ error: { message: 'bad key' } })).toThrow(
      'Unexpected Google'
    );
    expect(() => parseGoogleResponse(null)).toThrow('Unexpected Google');
  });
});

describe('Azure request and response', () => {
  it('posts the text as an array with the language pair in the query', () => {
    const spec = buildAzureRequest('Olive oil', 'az-key', 'westus');

    expect(spec.url).toBe(
      'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=es'
    );
    expect(spec.init.headers['Ocp-Apim-Subscription-Key']).toBe('az-key');
    expect(spec.init.headers['Ocp-Apim-Subscription-Region']).toBe('westus');
    expect(JSON.parse(spec.init.body)).toEqual([{ Text: 'Olive oil' }]);
  });

  it('leaves out the region header when no region is set', () => {
    expect(buildAzureRequest('Olive oil', 'az-key').init.headers).not.toHaveProperty(
      'Ocp-Apim-Subscription-Region'
    );
  });

  it('reads the translated text', () => {
    expect(parseAzureResponse([{ translations: [{ text: 'Aceite de oliva', to: 'es' }] }])).toBe(
      'Aceite de oliva'
    );
  });

  it('throws on an answer with no translation', () => {
    expect(() => parseAzureResponse([])).toThrow('Unexpected Azure');
    expect(() => parseAzureResponse({ error: {} })).toThrow('Unexpected Azure');
  });
});

describe('cleanTranslation', () => {
  it('collapses spaces and trims the ends', () => {
    expect(cleanTranslation('  Manzana   cruda \n')).toBe('Manzana cruda');
  });

  it('removes quotes that wrap the whole name', () => {
    expect(cleanTranslation('"Manzana cruda"')).toBe('Manzana cruda');
    expect(cleanTranslation('“Aceite de oliva”')).toBe('Aceite de oliva');
  });

  it('keeps quotes that are part of the name', () => {
    expect(cleanTranslation('Pan "integral" casero')).toBe('Pan "integral" casero');
  });

  it('refuses blank, non-text and over-long answers', () => {
    expect(cleanTranslation('   ')).toBeNull();
    expect(cleanTranslation('""')).toBeNull();
    expect(cleanTranslation(42)).toBeNull();
    expect(cleanTranslation(null)).toBeNull();
    expect(cleanTranslation('x'.repeat(MAX_NAME_LENGTH + 1))).toBeNull();
    expect(cleanTranslation('x'.repeat(MAX_NAME_LENGTH))).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe('billedCharacters', () => {
  it('counts characters, not UTF-16 units', () => {
    expect(billedCharacters('Manzana')).toBe(7);
    expect(billedCharacters('🍎🍎')).toBe(2);
  });
});

describe('translateFoodName', () => {
  it('uses Google when its key is set and charges the characters', async () => {
    const gate = fakeGate();
    const { fetchImpl } = fakeFetch({
      'translation.googleapis.com': googleOk('Manzana cruda'),
    });

    const outcome = await translateFoodName({
      text: 'Apples, raw',
      keys: { googleKey: 'g-key', azureKey: 'a-key' },
      gate,
      fetchImpl,
    });

    expect(outcome).toEqual({ status: 'translated', text: 'Manzana cruda', provider: 'google' });
    expect(gate.withAiCap).toHaveBeenCalledWith(
      'google',
      'cloud-translation-basic',
      expect.any(Function)
    );
    expect(gate.calls[0].usage).toEqual({ inputTokens: 'Apples, raw'.length, outputTokens: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to Azure when Google fails', async () => {
    const gate = fakeGate();
    const { fetchImpl } = fakeFetch({
      'translation.googleapis.com': reply(403, { error: { message: 'quota' } }),
      'api.cognitive.microsofttranslator.com': azureOk('Aceite de oliva'),
    });

    const outcome = await translateFoodName({
      text: 'Olive oil',
      keys: { googleKey: 'g-key', azureKey: 'a-key', azureRegion: 'westus' },
      gate,
      fetchImpl,
    });

    expect(outcome).toEqual({ status: 'translated', text: 'Aceite de oliva', provider: 'azure' });
    expect(gate.calls.map((c) => c.provider)).toEqual(['azure']);
  });

  it('uses Azure alone when no Google key is set', async () => {
    const gate = fakeGate();
    const { fetchImpl } = fakeFetch({
      'api.cognitive.microsofttranslator.com': azureOk('Lentejas cocidas'),
    });

    const outcome = await translateFoodName({
      text: 'Lentils, cooked',
      keys: { azureKey: 'a-key' },
      gate,
      fetchImpl,
    });

    expect(outcome.status).toBe('translated');
    expect(outcome.provider).toBe('azure');
  });

  it('fails with a reason when no key is set, without any call', async () => {
    const gate = fakeGate();
    const { fetchImpl } = fakeFetch({});

    const outcome = await translateFoodName({ text: 'Olive oil', keys: {}, gate, fetchImpl });

    expect(outcome).toEqual({ status: 'failed', reason: 'No translation API key is set' });
    expect(gate.withAiCap).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails when every provider fails, so the food keeps no Spanish name', async () => {
    const gate = fakeGate();
    const { fetchImpl } = fakeFetch({
      'translation.googleapis.com': reply(500, {}),
      'api.cognitive.microsofttranslator.com': reply(500, {}),
    });

    const outcome = await translateFoodName({
      text: 'Olive oil',
      keys: { googleKey: 'g', azureKey: 'a' },
      gate,
      fetchImpl,
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toContain('azure answered HTTP 500');
    expect(gate.calls).toEqual([]);
  });

  it('stops at the cap and does not fall back to Azure around it', async () => {
    const gate = fakeGate({ refuse: true });
    const { fetchImpl } = fakeFetch({
      'translation.googleapis.com': googleOk('x'),
      'api.cognitive.microsofttranslator.com': azureOk('x'),
    });

    const outcome = await translateFoodName({
      text: 'Olive oil',
      keys: { googleKey: 'g', azureKey: 'a' },
      gate,
      fetchImpl,
    });

    expect(outcome).toEqual({ status: 'limit_reached' });
    expect(gate.withAiCap).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats an empty English name as a failure without calling anything', async () => {
    const gate = fakeGate();
    const { fetchImpl } = fakeFetch({});

    const outcome = await translateFoodName({
      text: '   ',
      keys: { googleKey: 'g' },
      gate,
      fetchImpl,
    });

    expect(outcome.status).toBe('failed');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails when the provider returns a blank name', async () => {
    const gate = fakeGate();
    const { fetchImpl } = fakeFetch({ 'translation.googleapis.com': googleOk('  ') });

    const outcome = await translateFoodName({
      text: 'Olive oil',
      keys: { googleKey: 'g' },
      gate,
      fetchImpl,
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toContain('no usable name');
  });
});

describe('prices for translation', () => {
  it('prices Google and Azure per character, with no output charge', () => {
    expect(priceFor('google', 'cloud-translation-basic')).toMatchObject({
      inputPerMTok: 20,
      outputPerMTok: 0,
    });
    expect(priceFor('azure', 'translator-s1')).toMatchObject({
      inputPerMTok: 10,
      outputPerMTok: 0,
    });
  });

  it('keeps the existing Gemini price beside the translation price', () => {
    expect(PRICES.google['gemini-3.1-flash-lite'].inputPerMTok).toBe(0.25);
  });
});

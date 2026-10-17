// Food-name translation, English to Spanish (ticket #16, ticket #15's pick: Google Cloud
// Translation Basic, Azure F0 as fallback). Pure: no Deno APIs and no database. The Edge
// Function (translate-food-name/index.ts) supplies the AI gate (ai-gate.ts), the fetch
// function and the keys; the web app's tests supply fakes for all three.
//
// Every provider call goes through gate.withAiCap, so the monthly cap applies (ADR 0002).
// An AI_LIMIT_REACHED error stops the chain: the fallback is not tried around the cap.

export const NAME_SOURCE_LANGUAGE = 'en';
export const NAME_TARGET_LANGUAGE = 'es';
export const MAX_NAME_LENGTH = 200;

export const GOOGLE = {
  provider: 'google',
  model: 'cloud-translation-basic',
} as const;
export const AZURE = { provider: 'azure', model: 'translator-s1' } as const;

export const GOOGLE_URL = 'https://translation.googleapis.com/language/translate/v2';
export const AZURE_URL = 'https://api.cognitive.microsofttranslator.com/translate';

export interface TranslatorKeys {
  googleKey?: string;
  azureKey?: string;
  azureRegion?: string;
}

export interface RequestSpec {
  url: string;
  init: { method: 'POST'; headers: Record<string, string>; body: string };
}

export type FetchLike = (
  url: string,
  init: RequestSpec['init']
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

// The part of ai-gate.ts's AiGate that this module uses.
export interface GateLike {
  withAiCap<T>(
    provider: string,
    model: string,
    fn: () => Promise<{
      result: T;
      usage: { inputTokens: number; outputTokens: number };
    }>
  ): Promise<T>;
}

export type TranslationOutcome =
  | { status: 'translated'; text: string; provider: string }
  | { status: 'failed'; reason: string }
  | { status: 'limit_reached' };

// Google's key goes in a header, not the URL, so it stays out of logs that record URLs.
export function buildGoogleRequest(text: string, key: string): RequestSpec {
  return {
    url: GOOGLE_URL,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({
        q: text,
        source: NAME_SOURCE_LANGUAGE,
        target: NAME_TARGET_LANGUAGE,
        format: 'text',
      }),
    },
  };
}

export function parseGoogleResponse(json: unknown): string {
  const first = (json as { data?: { translations?: Array<{ translatedText?: unknown }> } })?.data
    ?.translations?.[0]?.translatedText;
  if (typeof first !== 'string') throw new Error('Unexpected Google Translate response');
  return first;
}

export function buildAzureRequest(text: string, key: string, region?: string): RequestSpec {
  const params = new URLSearchParams({
    'api-version': '3.0',
    from: NAME_SOURCE_LANGUAGE,
    to: NAME_TARGET_LANGUAGE,
  });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': key,
  };
  if (region) headers['Ocp-Apim-Subscription-Region'] = region;
  return {
    url: `${AZURE_URL}?${params.toString()}`,
    init: { method: 'POST', headers, body: JSON.stringify([{ Text: text }]) },
  };
}

export function parseAzureResponse(json: unknown): string {
  const first = Array.isArray(json)
    ? (json[0] as { translations?: Array<{ text?: unknown }> } | undefined)?.translations?.[0]?.text
    : undefined;
  if (typeof first !== 'string') throw new Error('Unexpected Azure Translator response');
  return first;
}

// Tidies what the provider returned: one line, no wrapping quotes, not blank, not absurdly
// long. Returns null when nothing usable is left, so the caller records a failure.
export function cleanTranslation(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let text = raw.replace(/\s+/g, ' ').trim();
  const quotes: Array<[string, string]> = [
    ['"', '"'],
    ['“', '”'],
    ['«', '»'],
    ["'", "'"],
  ];
  for (const [open, close] of quotes) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close)) {
      text = text.slice(open.length, text.length - close.length).trim();
    }
  }
  if (text === '' || text.length > MAX_NAME_LENGTH) return null;
  return text;
}

// Characters billed by the provider (code points, not UTF-16 units).
export function billedCharacters(text: string): number {
  return [...text].length;
}

export function isLimitReached(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'AI_LIMIT_REACHED';
}

export interface TranslateNameArgs {
  text: string;
  keys: TranslatorKeys;
  gate: GateLike;
  fetchImpl: FetchLike;
}

// Translates one food name: Google first when its key is set, Azure when Google is not
// configured or fails. The first answer that cleans to a usable name wins.
export async function translateFoodName({
  text,
  keys,
  gate,
  fetchImpl,
}: TranslateNameArgs): Promise<TranslationOutcome> {
  const source = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (source === '') return { status: 'failed', reason: 'The food has no English name' };

  const candidates: Array<{
    provider: string;
    model: string;
    request: () => RequestSpec;
    parse: (json: unknown) => string;
  }> = [];
  if (keys.googleKey) {
    const key = keys.googleKey;
    candidates.push({
      ...GOOGLE,
      request: () => buildGoogleRequest(source, key),
      parse: parseGoogleResponse,
    });
  }
  if (keys.azureKey) {
    const key = keys.azureKey;
    const region = keys.azureRegion;
    candidates.push({
      ...AZURE,
      request: () => buildAzureRequest(source, key, region),
      parse: parseAzureResponse,
    });
  }
  if (candidates.length === 0) {
    return { status: 'failed', reason: 'No translation API key is set' };
  }

  let lastReason = 'Translation failed';
  for (const candidate of candidates) {
    try {
      const text = await gate.withAiCap(candidate.provider, candidate.model, async () => {
        const spec = candidate.request();
        const response = await fetchImpl(spec.url, spec.init);
        if (!response.ok) throw new Error(`${candidate.provider} answered HTTP ${response.status}`);
        const cleaned = cleanTranslation(candidate.parse(await response.json()));
        if (cleaned === null) throw new Error(`${candidate.provider} returned no usable name`);
        return {
          result: cleaned,
          usage: { inputTokens: billedCharacters(source), outputTokens: 0 },
        };
      });
      return { status: 'translated', text, provider: candidate.provider };
    } catch (error) {
      if (isLimitReached(error)) return { status: 'limit_reached' };
      lastReason = error instanceof Error ? error.message : String(error);
    }
  }
  return { status: 'failed', reason: lastReason };
}

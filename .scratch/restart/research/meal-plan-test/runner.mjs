// Runs the Meal Plan model test. Keys come only from environment variables.
//
//   node runner.mjs --dry-run                 estimate prompt size and cost for every model and week; no calls, no keys needed
//   node runner.mjs --model claude-haiku-5-5  live run for one model, all four weeks (needs its key)
//   node runner.mjs --all                     live run for every model whose key is set; others are reported PENDING
//   add --week 2026-10-18 to run one week only
//
// Each live call writes results/<model>/<week>.json (raw text, token counts from the API, cost, scorer result)
// and regenerates results/summary.csv. A model with no key is skipped and listed as PENDING: nothing is guessed.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInputs } from './lib/slots.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { scoreDraft } from './scorer.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(ROOT, 'results');

// Prices are USD per million tokens, as recorded in .scratch/restart/research/costs.md.
// apiModel ids marked verify must be checked on the vendor's model page before a live run.
export const MODELS = {
  'claude-haiku-5-5': {
    provider: 'anthropic', apiModel: 'claude-haiku-5-5', keyEnv: 'ANTHROPIC_API_KEY',
    inPrice: 0.10, outPrice: 0.50, priceStatus: 'primary (platform.claude.com)', tokenizerFactor: 1.3, verify: false,
  },
  'gemini-3.1-flash-lite': {
    provider: 'google', apiModel: 'gemini-3.1-flash-lite', keyEnv: 'GOOGLE_API_KEY',
    inPrice: 0.25, outPrice: 1.50, priceStatus: 'primary (cloud.google.com)', tokenizerFactor: 1, verify: true,
  },
  'gpt-6-luna': {
    provider: 'openai', apiModel: 'gpt-6-luna', keyEnv: 'OPENAI_API_KEY',
    inPrice: 0.10, outPrice: 0.50, priceStatus: 'secondary (LiteLLM price file)', tokenizerFactor: 1, verify: true,
  },
};

// Dry-run output estimate: about 29 slot entries of ~25 tokens each, plus wrapper. Replaced by real counts on a live run.
export const ESTIMATED_OUTPUT_TOKENS = 1000;

export function estimateInputTokens(prompt, model) {
  return Math.ceil((prompt.length / 4) * model.tokenizerFactor);
}

export function costUsd(model, inTok, outTok) {
  return (inTok * model.inPrice + outTok * model.outPrice) / 1e6;
}

async function callAnthropic(model, prompt, key) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model.apiModel, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`anthropic HTTP ${res.status}: ${body?.error?.type ?? 'error'}`);
  return {
    text: body.content.filter((b) => b.type === 'text').map((b) => b.text).join(''),
    inputTokens: body.usage.input_tokens,
    outputTokens: body.usage.output_tokens,
    thoughtTokens: 0,
  };
}

async function callGoogle(model, prompt, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.apiModel}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`google HTTP ${res.status}: ${body?.error?.status ?? 'error'}`);
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return {
    text: parts.map((p) => p.text ?? '').join(''),
    inputTokens: body.usageMetadata.promptTokenCount,
    // Thinking tokens are billed as output, so they are added to the output count.
    outputTokens: (body.usageMetadata.candidatesTokenCount ?? 0) + (body.usageMetadata.thoughtsTokenCount ?? 0),
    thoughtTokens: body.usageMetadata.thoughtsTokenCount ?? 0,
  };
}

async function callOpenAI(model, prompt, key) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model.apiModel,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`openai HTTP ${res.status}: ${body?.error?.type ?? 'error'}`);
  return {
    text: body.choices[0].message.content ?? '',
    inputTokens: body.usage.prompt_tokens,
    outputTokens: body.usage.completion_tokens, // includes any reasoning tokens
    thoughtTokens: body.usage.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}

const CALLERS = { anthropic: callAnthropic, google: callGoogle, openai: callOpenAI };

function parseDraft(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function writeSummary() {
  mkdirSync(RESULTS, { recursive: true });
  const rows =['model,week,status,ruleBreaks,slotBreaks,dayBreaks,bandDistanceKcal,daysInBand,inputTokens,outputTokens,costUsd'];
  for (const m of existsSync(RESULTS) ? readdirSync(RESULTS) : []) {
    const dir = join(RESULTS, m);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const s = r.score ?? {};
      rows.push([m, r.week, r.parseError ? 'parse_error' : 'scored', s.ruleBreaks ?? '', s.slotBreaks ?? '', s.dayBreaks ?? '',
        s.bandDistanceKcal ?? '', s.daysInBand ?? '', r.usage.inputTokens, r.usage.outputTokens, r.costUsd.toFixed(6)].join(','));
    }
  }
  writeFileSync(join(RESULTS, 'summary.csv'), rows.join('\n') + '\n');
}

function args() {
  const a = process.argv.slice(2);
  const get = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined);
  return { dryRun: a.includes('--dry-run'), all: a.includes('--all'), model: get('--model'), week: get('--week') };
}

async function main() {
  const opts = args();
  const inputs = loadInputs();
  const weeks = opts.week ? [opts.week] : inputs.weeks;
  const modelNames = opts.all || opts.dryRun ? Object.keys(MODELS) : [opts.model];
  if (!opts.dryRun && !opts.all && !opts.model) {
    console.error('usage: node runner.mjs --dry-run | --model <name> | --all   [--week YYYY-MM-DD]');
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log('DRY RUN: estimates only. Input = prompt chars / 4 (x1.3 for Claude); output assumed ' + ESTIMATED_OUTPUT_TOKENS + ' tokens.');
    for (const name of modelNames) {
      const model = MODELS[name];
      let totalIn = 0;
      let totalCost = 0;
      for (const w of weeks) {
        const prompt = buildPrompt(inputs, w);
        const inTok = estimateInputTokens(prompt, model);
        totalIn += inTok;
        totalCost += costUsd(model, inTok, ESTIMATED_OUTPUT_TOKENS);
        console.log(`${name} ${w}: prompt ${prompt.length} chars, est. input ${inTok} tokens, est. cost $${costUsd(model, inTok, ESTIMATED_OUTPUT_TOKENS).toFixed(6)}`);
      }
      console.log(`${name}: average per plan est. $${(totalCost / weeks.length).toFixed(6)} (price: ${model.priceStatus}${model.verify ? '; model id to verify' : ''})`);
    }
    return;
  }

  for (const name of modelNames) {
    const model = MODELS[name];
    if (!model) {
      console.error(`unknown model ${name}`);
      process.exit(1);
    }
    const key = process.env[model.keyEnv];
    if (!key) {
      console.log(`PENDING ${name}: set ${model.keyEnv} to run. No scores written.`);
      continue;
    }
    if (model.verify) console.log(`NOTE ${name}: api model id "${model.apiModel}" must be checked on the vendor page before this run.`);
    for (const w of weeks) {
      const prompt = buildPrompt(inputs, w);
      const started = new Date().toISOString();
      const res = await CALLERS[model.provider](model, prompt, key);
      const cost = costUsd(model, res.inputTokens, res.outputTokens);
      const record = {
        model: name, apiModel: model.apiModel, week: w, startedAt: started,
        promptChars: prompt.length, usage: { inputTokens: res.inputTokens, outputTokens: res.outputTokens, thoughtTokens: res.thoughtTokens },
        costUsd: cost, priceStatus: model.priceStatus, rawText: res.text, parseError: null, score: null,
      };
      try {
        const draft = parseDraft(res.text);
        if (draft.weekStart !== w) record.weekStartMismatch = draft.weekStart ?? null;
        draft.weekStart = w;
        record.score = scoreDraft(draft, inputs);
      } catch (e) {
        record.parseError = String(e.message ?? e);
      }
      mkdirSync(join(RESULTS, name), { recursive: true });
      writeFileSync(join(RESULTS, name, `${w}.json`), JSON.stringify(record, null, 2));
      console.log(`${name} ${w}: in ${res.inputTokens} out ${res.outputTokens} cost $${cost.toFixed(6)} ` +
        (record.score ? `breaks ${record.score.ruleBreaks}, band distance ${record.score.bandDistanceKcal} kcal` : `PARSE ERROR ${record.parseError}`));
    }
  }
  writeSummary();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

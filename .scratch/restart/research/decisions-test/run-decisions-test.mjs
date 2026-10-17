#!/usr/bin/env node
// Ticket 35: runs the 50 labelled messages through Jev, OpenAI Decisions and Cloudflare Clef.
//
// Usage:
//   node run-decisions-test.mjs --dry-run                 check messages.json, no network, no spend (default)
//   node run-decisions-test.mjs --provider openai         live run, needs OPENAI_API_KEY
//   node run-decisions-test.mjs --provider jev            live run, needs TYPESAFE_API_KEY and JEV_URL
//   node run-decisions-test.mjs --provider clef           live run, needs CLOUDFLARE_API_TOKEN, CLEF_URL
//   add --limit 2 to run only the first 2 messages (a cheap smoke test before the full run)
//
// Keys come only from environment variables. Nothing here prints a key.
// Status (2026-10-17): no keys have been supplied, so no live run has happened.
// Jev and Clef endpoints are NOT confirmed on the vendor pages (see jev-vs-openai.md);
// those adapters refuse to run until JEV_URL / CLEF_URL are set by hand.
// The OpenAI adapter follows the public-beta page at developers.openai.com; confirm the
// response envelope on a --limit 1 run before trusting the full run.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "messages.json"), "utf8"));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const provider = opt("--provider");
const limit = opt("--limit") ? Number(opt("--limit")) : Infinity;

// ---------- validation (always runs) ----------
function validate() {
  const errors = [];
  const ids = new Set();
  for (const m of data.messages) {
    if (ids.has(m.id)) errors.push(`duplicate id ${m.id}`);
    ids.add(m.id);
    if (!["en", "es"].includes(m.lang)) errors.push(`${m.id}: bad lang`);
    if (!["rebalance", "voice"].includes(m.kind)) errors.push(`${m.id}: bad kind`);
    const qs = data.question_sets[m.kind];
    for (const q of qs) {
      if (!(q.name in m.expected)) errors.push(`${m.id}: missing expected ${q.name}`);
      if (q.type === "choice" && !q.choices.some((c) => c.value === m.expected[q.name]))
        errors.push(`${m.id}: expected ${q.name} not in choices`);
      if (q.type === "score" && !(m.expected[q.name] >= 0 && m.expected[q.name] < q.levels.length))
        errors.push(`${m.id}: score out of range`);
      if (q.type === "yes_no" && typeof m.expected[q.name] !== "boolean")
        errors.push(`${m.id}: yes_no not boolean`);
    }
  }
  const count = (f) => data.messages.filter(f).length;
  const summary = {
    total: data.messages.length,
    en: count((m) => m.lang === "en"),
    es: count((m) => m.lang === "es"),
    rebalance: count((m) => m.kind === "rebalance"),
    voice: count((m) => m.kind === "voice"),
    en_rebalance: count((m) => m.lang === "en" && m.kind === "rebalance"),
    en_voice: count((m) => m.lang === "en" && m.kind === "voice"),
    es_rebalance: count((m) => m.lang === "es" && m.kind === "rebalance"),
    es_voice: count((m) => m.lang === "es" && m.kind === "voice"),
  };
  return { errors, summary };
}

// ---------- request builders ----------
// OpenAI Decisions: POST https://api.openai.com/v1/decisions, questions as an array.
function openaiQuestion(q) {
  const base = { type: q.type === "yes_no" ? "predicate" : q.type, name: q.name, instructions: q.instructions };
  if (q.type === "choice") base.choices = q.choices;
  if (q.type === "score") base.levels = q.levels;
  return base;
}

// Jev (and Clef, which is described as Jev-compatible): questions as an object keyed by name.
// Shape taken from docs.typesafe.ai/models ("noul" type seen; choice/score shapes unconfirmed).
function jevQuestions(qs) {
  const out = {};
  for (const q of qs) {
    const type = q.type === "yes_no" ? "noul" : q.type;
    const entry = { type, instructions: q.instructions };
    if (q.type === "choice") entry.choices = q.choices.map((c) => c.value);
    if (q.type === "score") entry.levels = q.levels.map((l) => l.label);
    out[q.name] = entry;
  }
  return out;
}

// ---------- answer readers (return { name: { value, confidence, correct } }) ----------
function findAnswers(obj) {
  // Finds the first "answers" array anywhere in a parsed response (envelope shape not confirmed).
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj.answers)) return obj.answers;
  for (const v of Object.values(obj)) {
    const r = findAnswers(typeof v === "string" ? safeParse(v) : v);
    if (r) return r;
  }
  return null;
}
function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function scoreAnswer(q, expected, ans) {
  if (!ans) return { value: null, confidence: null, correct: false };
  if (q.type === "choice") {
    const probs = ans.probabilities ?? [];
    let best = 0;
    probs.forEach((p, i) => { if (p > probs[best]) best = i; });
    const value = q.choices[best]?.value ?? null;
    return { value, confidence: ans.confidence ?? null, correct: value === expected };
  }
  if (q.type === "score") {
    const s = ans.score ?? ans.noul;
    const value = s == null ? null : Math.round(s);
    return { value, raw: s, confidence: ans.confidence ?? null, correct: value === expected };
  }
  // yes_no: predicate (OpenAI) returns probability; Jev/Clef noul returns 0-1
  const p = ans.probability ?? ans.noul ?? null;
  const value = p == null ? null : p > 0.5;
  return { value, raw: p, confidence: ans.confidence ?? null, correct: value === expected };
}

// ---------- providers ----------
async function callOpenAI(m) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const qs = data.question_sets[m.kind];
  const body = { model: "gpt-6-luna", input: m.text, questions: qs.map(openaiQuestion) };
  const res = await fetch("https://api.openai.com/v1/decisions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return { json, usage: json.usage ?? json.metadata?.usage ?? null };
}

async function callJevLike(m, url, key, label) {
  if (!url) throw new Error(`${label} endpoint not set (unconfirmed on vendor page; set env var)`);
  if (!key) throw new Error(`${label} key not set`);
  const qs = data.question_sets[m.kind];
  const body = { input: m.text, questions: jevQuestions(qs) };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return { json, usage: json.usage ?? null };
}

const adapters = {
  openai: { key: "OPENAI_API_KEY", call: callOpenAI },
  jev: {
    key: "TYPESAFE_API_KEY",
    call: (m) => callJevLike(m, process.env.JEV_URL, process.env.TYPESAFE_API_KEY, "Jev"),
  },
  clef: {
    key: "CLOUDFLARE_API_TOKEN",
    call: (m) => callJevLike(m, process.env.CLEF_URL, process.env.CLOUDFLARE_API_TOKEN, "Clef"),
  },
};

// ---------- main ----------
const { errors, summary } = validate();
if (errors.length) {
  console.error("messages.json has errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("messages.json OK:", JSON.stringify(summary));

if (!provider || flag("--dry-run")) {
  console.log("Dry run only. No network calls, no spend. Pass --provider <openai|jev|clef> for a live run.");
  process.exit(0);
}

const adapter = adapters[provider];
if (!adapter) { console.error(`unknown provider ${provider}`); process.exit(1); }
if (!process.env[adapter.key]) {
  console.error(`Pending keys: ${adapter.key} is not set. Nothing was run and nothing was spent.`);
  process.exit(2);
}

const outDir = join(here, "results");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const rows = [];
const messages = data.messages.slice(0, limit);

for (const m of messages) {
  const qs = data.question_sets[m.kind];
  const t0 = Date.now();
  try {
    const { json, usage } = await adapter.call(m);
    const ms = Date.now() - t0;
    const answers = findAnswers(json) ?? [];
    const scored = {};
    qs.forEach((q, i) => { scored[q.name] = scoreAnswer(q, m.expected[q.name], answers[i]); });
    rows.push({ id: m.id, lang: m.lang, kind: m.kind, ms, usage, scored, raw: json });
    console.log(`${m.id} ${ms}ms ${qs.map((q) => `${q.name}=${scored[q.name].correct ? "ok" : "miss"}`).join(" ")}`);
  } catch (err) {
    rows.push({ id: m.id, lang: m.lang, kind: m.kind, error: String(err.message ?? err) });
    console.error(`${m.id} ERROR ${err.message}`);
  }
}

const file = join(outDir, `${provider}-${stamp}.json`);
writeFileSync(file, JSON.stringify({ provider, date: stamp, limit: messages.length, rows }, null, 2));
console.log(`Wrote ${file}. Accuracy is computed from this file; it is not written into the report by hand.`);

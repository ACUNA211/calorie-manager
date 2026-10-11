# Artifact + Claude chat instead of a built app with its own AI

Status: accepted (2026-10-10)

## Context

The MVP was planned as a PWA (Next.js + Supabase + Vercel) with a built-in Agent calling a paid AI API. That meant a model bake-off, a monthly AI cost estimate, a spending cap, and building every screen, before knowing whether the app would get used. The Member already pays for Claude, which can read and write the Supabase database through its connector and can be spoken to by voice.

## Decision

The MVP is one Claude artifact with tabs, reading and writing the Member's Supabase tables. The Agent is Claude in an ordinary chat (started by slash-command skills), not an AI inside the app. No Next.js, Vercel, PWA, AI API key, model choice or AI budget in the MVP. A built app (web, Android, iPhone) is only considered if the Member later decides to make it a product.

## Consequences

- No AI running cost beyond the existing Claude subscription; issue #10 (AI cost) and the model bake-off are dropped from the MVP.
- Planning and Rebalance conversations happen outside the app's screens, so the Plan page loses its chat drawer.
- The artifact only works inside Claude (web or app); offline use and push notifications stay out.
- If it becomes a product, the Agent's behaviour (now in skills) has to be rebuilt against a paid API.

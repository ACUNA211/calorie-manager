# Household PWA with cheap, bounded AI instead of the artifact

Status: accepted (2026-10-17). Supersedes [0001](0001-artifact-and-claude-chat-instead-of-built-app.md).

## Context

The restart turns the one-person artifact into a Household app: several Members with their own logins, one shared Pantry, a Meal Plan drafted on a schedule, voice commands and Rebalance through Jev. An artifact plus Claude chat can't run Schedules, call Jev, sign in several people or send reminders. The cost research (`.scratch/restart/research/costs.md`) found that once code does the filtering and arithmetic, AI costs well under $1 a month for a Household.

## Decision

- Build a PWA installed to the Home Screen, on Supabase (keeping the existing schema, USDA functions and barcode test where they fit). Native apps only if the PWA holds us back.
- Build for our own Household first, but use only commercially safe data (USDA FDC is CC0; Open Food Facts rows are stored unmodified in their own table with attribution). Sign-ups are by invitation.
- AI is used for three things only: drafting the weekly Meal Plan (a cheap model such as Haiku 5.5, every slot checked by code), Rebalance (Jev rates, fixed formulas decide) and Voice commands (Jev picks the likely meanings, the Member confirms). Logging, Pantry, Shopping list, scheduling and reminders are plain code. Parsing a pasted Recipe may use one cheap model call.
- Jev sits behind a small interface. If TypeSafe goes away, the same questions go to OpenAI's Decisions API (gpt-6-luna) or Cloudflare's Jev-compatible Clef, with a cheap text model as the last fallback.
- Start on Supabase Free with a nightly backup; move to Pro (~$25/month) once the Household uses the app daily. AI spend has a $5/month hard cap per provider plus an in-app counter that stops AI calls at the cap.

## Consequences

- AI running cost comes back (cents a month), along with API keys, a cap and a fallback path.
- The schema must change from one Member to Households with row-level security.
- The Claude-chat skills stop being the engine; their rules carry over into code and prompts.

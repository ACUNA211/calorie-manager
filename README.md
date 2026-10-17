# Calorie Manager

A Household calorie and macro tracker (React + Vite PWA on Cloudflare Pages, with Supabase). See [ADR 0002](docs/adr/0002-household-pwa-with-cheap-ai.md) and [ADR 0003](docs/adr/0003-react-vite-pwa-on-cloudflare-and-supabase.md) for the decisions and [CONTEXT.md](CONTEXT.md) for the vocabulary.

## Project layout

- `web/`: the React + Vite app (sign-in and the signed-in page so far).
- `web/src/lib/supabase.js`: the one Supabase client, built from environment settings.
- `supabase/migrations/`: the existing database schema.
- `app/`: the old single-file artifact and barcode test, kept for reference.

## Running the app

Requires Node 22.12 or later (Vite 8).

1. Copy `web/.env.example` to `web/.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Supabase (Project Settings > API). Only the publishable key goes in the app; never a secret or service-role key.
2. From `web/`:

```sh
npm install
npm run dev        # local dev server
npm run build      # production build into web/dist
npm run preview    # serve the production build locally
npm test           # Vitest, with Testing Library
npm run lint       # ESLint
npm run format     # Prettier (use format:check to only check)
```

## Deploying to Cloudflare Pages

1. In the Cloudflare dashboard, go to Workers & Pages > Create > Pages > Connect to Git, and pick this repository.
2. Set **Root directory** to `web`, **Build command** to `npm run build`, and **Build output directory** to `dist`.
3. Under Environment variables (Production, and Preview if wanted), add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with the same values as `.env.local`. Vite reads `VITE_` variables at build time, so redeploy after changing them.
4. In Supabase, under Authentication > URL Configuration, add the Pages URL to the allowed site URL and redirect URLs.
5. Deploy, then check that the sign-in form loads and that signing in shows "Hi, <email>".

Sign-in uses email and password. Until invite links exist (ticket 06), turn off public sign-ups in Supabase (Authentication > Sign In / Providers) and create the Household accounts by hand.

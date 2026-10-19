# 02: App skeleton and sign-in

**What to build:** Start the new app from ADR 0003: a React + Vite project that deploys to Cloudflare Pages and signs a person in with Supabase Auth (email and password). After signing in, the page says "Hi, <email>" and has a sign-out button. Supabase URL and publishable key come from environment settings, never hard-coded. Set up the test runner and a lint/format command so every later ticket can add tests.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 73 (Deploy the app to Cloudflare Pages)

**Status:** done except deploy (73)

- [x] `npm run dev`, `npm run build`, `npm test` and a lint command all work
- [ ] A deployed Cloudflare Pages URL shows a sign-in form; signing in shows "Hi, <email>"; sign-out returns to the form
- [x] No keys are committed; a `.env.example` lists the settings needed
- [x] One passing test covers the signed-in / signed-out switch
- [x] A README section explains how to run and deploy

## Comments

- 2026-10-17: Built in worktree `restart-t02` under `web/` (React 19 + Vite 8, Supabase Auth email/password, Vitest + Testing Library, ESLint + Prettier). `npm run dev`, `build`, `test`, `lint` and `format:check` pass locally. Deployed URL not ticked: it waits on the user, who must create the Cloudflare Pages project and set the VITE_ variables and Supabase redirect URLs (see README).

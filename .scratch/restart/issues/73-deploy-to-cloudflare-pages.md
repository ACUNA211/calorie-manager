# 73: Deploy the app to Cloudflare Pages

**Type:** your task (not for an agent)

**What to do:** Create the Cloudflare Pages project (root directory `web`, build command `npm run build`, output `dist`). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in its settings. Add the Pages URL to Supabase Auth's URL configuration. Once 69 passes, apply every migration from 005 up (now through 033, which replaces `save_meal_time`) to the live project yourself (`supabase link`, then `supabase db push`), after a backup. The README has the details.

**Blocked by:** 69 (Run the database tests locally)

**Status:** ready-for-human

**Unblocks:** 02

- [ ] The Pages URL shows the sign-in form
- [ ] Signing in shows "Hi, <email>" and sign-out returns to the form
- [ ] Live database has migrations 005–033 applied
- [ ] Tick the deploy box on ticket 02

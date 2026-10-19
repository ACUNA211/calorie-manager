# 73: Deploy the app to Cloudflare Pages

**Type:** your task (not for an agent)

**What to do:** Put the app on Cloudflare Pages (free, commercial use allowed; ADR 0003), point Supabase Auth at it, then bring the live database up to migration 033. Step by step:

### Part A: the site

1. **Sign in** at dash.cloudflare.com (free plan).
2. Go to **Workers & Pages → Create → Pages → Connect to Git**. Authorize GitHub and pick **ACUNA211/calorie-manager**.
3. **Build settings:**

   | Field | Value |
   |---|---|
   | Production branch | `claude/stoic-hypatia-1fwdiw` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory (under Advanced) | `web` |

4. **Environment variables** (under Advanced, before deploying):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://bmxpjzrlnqnecycxbmqh.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_aFA0EQrI60WT-FWJ49uVIQ_QAfTKc7P` |
   | `NODE_VERSION` | `24` |

   The publishable key is meant for the browser, so it's fine here. Vite reads these at build time: after changing one, redeploy.
5. Click **Save and Deploy**. Note the URL it gives (`https://<name>.pages.dev`).
6. In Supabase, **Authentication → URL Configuration**: set **Site URL** to that URL, and add `https://<name>.pages.dev/**` under **Redirect URLs**.
7. Open the URL: the sign-in form should show. Sign in with your real account: "Hi, <email>" should show. Sign out: back to the form. Screens past sign-in will show errors until Part B, because the live database is still at the old schema.

### Part B: the live database (do with Claude)

The live project's migration history doesn't use the repo's numbers: 001–004 went in through the Supabase connector under timestamp names (`calorie_core_schema`, `calorie_usda_functions`, ... and `gtin_lookup_variants` on 2026-10-17). The project also holds other apps' tables (`grocery_list` from before, `date_ideas`, `vehicle_maintenance`). So a plain `supabase db push` would try to run 000 onwards again. Do this part with Claude, in this order:

1. In a terminal at the repo root: `npx supabase login`, then `npx supabase link --project-ref bmxpjzrlnqnecycxbmqh` (it asks for the database password, from Supabase → Project Settings → Database).
2. **Back up first.** The free plan has no dashboard backups, so dump to files outside the repo:
   `npx supabase db dump --linked -f D:/backups/calorie-schema-2026-10-18.sql` and
   `npx supabase db dump --linked --data-only -f D:/backups/calorie-data-2026-10-18.sql`.
3. Claude checks that what's live matches 000–004 (and where `gtin_lookup_variants` fits), then marks those as applied with `npx supabase migration repair --status applied <versions>`.
4. `npx supabase db push --dry-run`: it should list 005–034 and nothing else.
5. `npx supabase db push`, then sign in on the Pages URL again and check Today, Week and Foods load.

**Blocked by:** 69 (Run the database tests locally), 79 (Review Release 1 work and push it)

**Status:** ready-for-human

**Unblocks:** 02, 71

- [ ] The Pages URL shows the sign-in form
- [ ] Signing in shows "Hi, <email>" and sign-out returns to the form
- [ ] Live database backed up, then has migrations 005–034 applied
- [ ] Tick the deploy box on ticket 02

## Comments

- 2026-10-18: Steps written out in full. Checked the live project's migration list: it has timestamp-named versions for the 001–004 work, not the repo's 000–033 numbers, hence Part B's repair step. 69 and 79 are done.
- 2026-10-18: Part B under way. Logged in and linked; backups in `D:/backups` (schema and data dumps). Compared live with a local build of 000–004: nothing missing on live; live has newer bodies for the USDA functions, three extra helpers (`usda_category`, `usda_portions`, `usda_refresh_servings`) and other apps' tables. Live's 10-17 barcode fix (retry 12/13/14-digit paddings) would have been lost when 006 replaced `usda_lookup_gtin`, so migration 034 carries it over (test `gtin_lookup_variants_test.sql`; 23 files, 391 tests pass).

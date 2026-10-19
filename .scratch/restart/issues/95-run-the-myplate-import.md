# 95: Run the MyPlate Kitchen import

**Type:** your task (not for an agent)

**What to do:** Ticket 67 wrote the import script (`scripts/myplate/`), but www.myplate.gov did not resolve from the agent's machine, so nothing was collected.

1. Open https://www.myplate.gov/myplate-kitchen in your browser. If it loads, the script can run from your machine.
2. Read the site's terms/policy pages and confirm the Kitchen recipes are public domain (some may be partner-contributed). Paste the source link into ticket 67's Comments.
3. Set your USDA key in your shell only (never in a file; get one via ticket 86): `export FDC_API_KEY=<your key>`.
4. From the repo root: `node scripts/myplate/import.mjs --household <your household id>`. It obeys robots.txt and waits 2 s between pages, so expect a long first run.
5. Open `scripts/myplate/out/review.json` and `skipped.json`. If fewer than 50 Recipes imported, put the counts in ticket 67's Comments so an agent can tune the matcher.
6. Apply migration 036 (`supabase db push`), then paste `scripts/myplate/out/import.sql` into the Supabase SQL editor (safe to rerun).
7. Decide whether the Recipe view should show a "Source: MyPlate Kitchen" credit line (not built yet) and note it in ticket 67.

**Blocked by:** 86 (Set a real USDA API key)

**Status:** ready-for-human

**Unblocks:** 67

- [ ] Public-domain status confirmed with a source link
- [ ] At least 50 Recipes imported, unmatched lines reviewed
- [ ] Credit-line decision noted

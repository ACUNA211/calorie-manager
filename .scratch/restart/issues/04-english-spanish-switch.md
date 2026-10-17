# 04: English/Spanish switch

**What to build:** Every string the app shows comes from translation files, one per language, starting with English and Spanish. Each Member can switch language; the choice is remembered on their account (a local default is fine until ticket 05 lands, then store it on the Member). Dates and numbers follow the chosen language. Adding a third language later must only need a new file.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 02 (App skeleton and sign-in), 79 (Review Release 1 work and push it)

**Status:** done (awaiting review)

- [x] No user-facing string is hard-coded in components (a lint rule or test checks this)
- [x] A language switch changes every visible string between English and Spanish without reloading
- [x] Dates and numbers format per language (e.g. "vie, 17 oct" vs "Fri, Oct 17")
- [x] A test fails if a key exists in one language file but not the other

## Comments

- 2026-10-17: Built in worktree `t04` (branch `restart-t04`). No new library: a small hand-rolled context (`web/src/i18n/I18nProvider.jsx`, `locale.js`, `format.js`), allowed by step 1, keeps the dependency list unchanged. Strings live in `web/src/locales/en.json` and `es.json` (nested, read as dot keys such as `home.signOut`, with `{{name}}` placeholders). `web/src/strings.js` is removed. The choice is kept in localStorage (`calorieManager.locale`, guarded with try/catch) and defaults to the first supported browser language, then English. A `TODO` in `I18nProvider.jsx` marks where to store it on the Member once the database allows it; no database or migration was touched. `LanguageSwitch` sits at the top of the App in every state and switches without a reload. `formatDate` and `formatNumber` use Intl per language (tests assert "Fri, Oct 17" / "vie, 17 oct" and "1,234.5" / "1234,5"). No current screen shows a date or number, so the helpers are ready but unused. Checks: a parity test fails on any key missing from one locale file; a local ESLint rule `local/no-hardcoded-text` (`web/eslint-rules/`, with its own tests) fails lint on hard-coded text in components. The sign-in error now shows a translated message instead of Supabase's English server text.


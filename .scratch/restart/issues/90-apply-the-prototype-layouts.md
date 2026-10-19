# 90: Apply the prototype layouts

**What to build:** Lay out the Release 1 screens the way the resolved design tickets decided. `research/built-vs-restart.md` says those layouts carry over to the restart, but the screens were built without them. The designs live on `main`; read them with `git show main:<path>` (they are background, not plans, and nothing on `main` is to be edited):

- **Today:** `.scratch/mvp-reset/issues/07-today-and-logging.md`, layout **B, next meal first**, in `.scratch/mvp-reset/prototypes/07-today-logging-PROTOTYPE.html?variant=B`. Date header with ‹ › arrows and "back to today"; the calories-left counter and bar; the card for the meal that's due; the rest of the day as a compact list; the log box at the bottom; tap an entry to edit (ticket 24's panel) with the Undo toast. Leave out what isn't built yet: planned meals and "Ate as planned" (Release 2), the ⚖ Rebalance button (Release 3), the AI estimate.
- **Meal Times:** `.scratch/mvp-reset/issues/03-meal-times-settings.md` and `prototypes/03-meal-times-PROTOTYPE.html`.
- **Recipes:** `.scratch/mvp-reset/issues/04-recipe-entry.md` and `prototypes/04-recipe-entry-PROTOTYPE.html`, including ticket 28's editor and ticket 30's paste flow.
- **Week:** `.scratch/mvp-reset/issues/09-week-view.md` (no prototype file; follow its resolution), with ticket 32's weight trend and ticket 33's Household days.
- **Foods and Pantry** have no resolved design. Give them the same list, search and scan patterns as Today and Recipes, and the Pantry grouped by store section (ticket 25).

The Plan page (05), Shopping list (06) and Rebalance (08) prototypes belong to Releases 2 and 3; leave them for tickets 39, 46 and 59.

Behaviour stays as built: this is layout and style on top of the existing components and `lib/` logic. If a prototype shows something the built screen can't do, leave it out and list it in a comment rather than building it here.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 89 (App shell and navigation)

**Status:** ready-for-agent

- [ ] Today follows layout B: header, counter and bar, due meal, rest of the day, log box
- [ ] Meal Times follows prototype 03
- [ ] Recipes (list, editor, paste) follows prototype 04
- [ ] Week follows the resolution of old ticket 09
- [ ] Foods and Pantry use the same patterns and read well at 375 px
- [ ] Spanish screens still fit (Spanish strings run longer)
- [ ] Existing Vitest suites pass; queries changed only where the markup had to change
- [ ] A comment lists anything in the prototypes left out because it isn't built

## Comments

- 2026-10-18: Written during the ticket 79 review, with 89 and 91. Belongs to Release 1.

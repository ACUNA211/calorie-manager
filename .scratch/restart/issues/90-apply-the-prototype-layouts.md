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

**Blocked by:** 89 (App shell and navigation), 97 (Phone check: app shell and screen layouts)

**Status:** done (awaiting review)

- [x] Today follows layout B: header, counter and bar, due meal, rest of the day, log box
- [x] Meal Times follows prototype 03
- [x] Recipes (list, editor, paste) follows prototype 04
- [x] Week follows the resolution of old ticket 09
- [x] Foods and Pantry use the same patterns and read well at 375 px
- [x] Spanish screens still fit (Spanish strings run longer)
- [x] Existing Vitest suites pass; queries changed only where the markup had to change
- [x] A comment lists anything in the prototypes left out because it isn't built

## Comments

- 2026-10-18: Written during the ticket 79 review, with 89 and 91. Belongs to Release 1.
- 2026-10-19: Done on branch restart-t90. Layout and style only, on the existing behaviour; new strings are under `layout`. Checked in a browser at 375 px against a stand-in data client (not the real database): Today, Week, Foods, Pantry, Recipes and More showed no sideways page scroll in English or Spanish; Meal Times (More) and Week were looked at in Spanish. Not looked at on screen: the Recipe editor, paste flow, log and edit panels, and the Foods and Pantry result lists with real data. Meal Times grid scrolls sideways inside itself with the Meal Time column pinned (seven 44 px day buttons do not fit at 375 px).
  Left out of the prototypes because it is not built: planned meals, "Ate as planned" and its 1/2, 3/4, 1 1/4 buttons (Release 2); the Rebalance button and "if the rest goes as planned" line (Release 3); one-tap "as set" and "Different amount" on Set meals; the search-as-you-type box with typed amounts, "and" splitting and AI estimate; the "Other time" picker on the confirm card beyond what Log food has; hatched "still planned" on the bar; past-day "not logged" catch-up; Meal Times: per-day bars under the grid, the grid previewing an unsaved edit, editing Calorie Target in a toolbar (read-only, ticket 91) and the 45-minute overlap wording is as built; Recipes: Recipe Facts per 100 g, per gram and batch lines, the stacked ingredient-share bar, % of total column and unit picker, "Weigh the pot", "I weigh / It makes N servings" choice, the Starred chip as a button (still a checkbox) and Meal Time tags as chips (still checkboxes styled as pills); Week: bars are per-day rows with the aim shaded, not a seven-column chart. Today's due card also adds a "Log food for <meal>" button that opens Log food on that Meal Time.

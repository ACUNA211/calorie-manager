# 91: Settings screen

**What to build:** The "More" tab from ticket 89, holding everything that's set once and rarely changed, so the daily screens only show daily things. Move these off the main screens into it, each as its own section or sub-page:

- **Targets** (`TargetsPage`, ticket 10) and **display units** (`UnitsSetting`, ticket 11)
- **Meal Times** (`MealTimesPage`, tickets 21 and 22): the old design ticket 03 called them "Meal Times settings"
- **Household:** name, Members, Invite (`HouseholdPage`, tickets 05 and 06), **Dependents** (ticket 07), **Sharing** (`SharingSetting`, ticket 33)
- **Weight** entry if it doesn't sit better on Week (`WeightPanel`, ticket 32); decide and note which
- **AI spend this month** (`AiSpendPanel`, ticket 12)
- **Language:** English / Español (`LanguageSwitch`, ticket 04)
- **Sign out**, and the signed-in email

With no Household yet, More opens on "Create a Household" and the other tabs point there.

Behaviour stays as built: this moves and groups existing components, it doesn't change what they save.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 89 (App shell and navigation)

**Status:** done (awaiting review)

- [x] Every item above is reachable from More and nowhere else on the daily screens
- [x] With no Household, the other tabs point to More's "Create a Household"
- [x] Language switch and Sign out work from More
- [ ] Reads well at 375 px, in English and Spanish
- [x] Existing Vitest suites pass

## Comments

- 2026-10-18: Written during the ticket 79 review, with 89 and 90. Belongs to Release 1.
- 2026-10-19: Built. More is now Settings: a list of sub-pages (Household incl. Members, Invite, Dependents, Sharing, AI spend; Calorie Targets and units; Meal Times), links to Plan, Preferences and Intake form, a marked Notifications spot for ticket 54, Language, and Account (email, Sign out). Decision: Weight entry stays on Week (`WeightPanel` is a repeated weigh-in tied to the week on screen), so it is the one listed item not under Settings. With no Household, `App.jsx` sends every other route to More, which opens on Create a Household (new `householdState` in the acting-Member context). `Home.jsx` removed. 375 px and Spanish layout not rendered, so those boxes are left open; Spanish switching is covered by tests only.

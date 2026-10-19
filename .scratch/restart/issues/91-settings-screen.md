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

**Status:** ready-for-agent

- [ ] Every item above is reachable from More and nowhere else on the daily screens
- [ ] With no Household, the other tabs point to More's "Create a Household"
- [ ] Language switch and Sign out work from More
- [ ] Reads well at 375 px, in English and Spanish
- [ ] Existing Vitest suites pass

## Comments

- 2026-10-18: Written during the ticket 79 review, with 89 and 90. Belongs to Release 1.

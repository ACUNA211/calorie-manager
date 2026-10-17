# 40: Plan grid editing

**What to build:** On the Plan grid, add a Cook (pick a Recipe and a cook day), place its Portions at Meal Times, move or remove them, and delete a Cook. At a shared Meal Time, code sizes each Member's Portion to what they have left in their band (in quarter servings), not the AI.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 39 (Plan grid (view))

**Status:** ready-for-agent

- [ ] Add, move and remove Cooks and Portions; changes save straight away
- [ ] Portions at shared Meal Times are sized by a tested function from each Member's remaining calories
- [ ] A Cook's servings made covers all its Portions (it grows when needed)
- [ ] Editing an approved plan is allowed and is marked as changed since approval

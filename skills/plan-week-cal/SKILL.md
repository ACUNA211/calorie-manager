---
name: plan-week-cal
description: Draft Sergio's weekly Meal Plan (Sunday to Saturday) from his Recipes and Meal Times and write it to the Calorie Manager, and handle swaps and moves afterwards. Use when he says /plan-week-cal or asks to plan, swap or move meals.
---

# /plan-week-cal

You are the **Agent** for Sergio's Calorie Manager (vocabulary: `CONTEXT.md` in `ACUNA211/calorie-manager`). Data is in Supabase project `bmxpjzrlnqnecycxbmqh` (connector tool `execute_sql`). You draft here in chat; he reviews on the app's **Plan** tab, resizes or removes meals there, and taps **Approve**, which fills the Shopping list. Aim to finish planning in under 15 minutes.

## Read first (one query)

- `member_settings` (id 1): `calorie_target`, `band_low_pct`, `band_high_pct`. The planning band is target × low% to target × high%.
- `meal_times`: `id, name, time_of_day, weekdays smallint[] (0 = Sunday), kind ('set'|'planned'|'if_room'), cal_min, cal_max, set_calories`.
- `recipes` joined to `recipe_totals` (`kcal_per_serving`), with `starred` and `meal_time_tags`.
- The target week's `meal_plans` row (if any) with its `cooks` and `portions`.
- Last week's `calorie_log` totals per day, for a one-line recap ("5 of 7 days under").

If there's no Calorie Target or there are no Recipes, say what's missing (Times tab for the target, `/add-recipe-cal` for Recipes) and stop.

## Which week

The next Sunday–Saturday week. If today is Sunday, ask whether he means this week or next. `week_start` is always a Sunday.

## Start the conversation

One short message: the recap of last week, then ask what to use up or plan around (nights out, guests, a busy day). Then draft. Don't ask a list of questions.

## Drafting rules

1. **Set** Meal Times are held first at their `set_calories` and never changed.
2. Every **Planned** Meal Time on its weekdays gets a Portion whose calories (`servings × kcal_per_serving`) fall inside `cal_min`–`cal_max`.
3. **If room** Meal Times are filled last, and only while the day stays under the top of the band.
4. Aim each day's total (Set + Portions) into the planning band. Never plan a day over the Calorie Target.
5. Use **only existing Recipes**. Never invent one; if something's missing, say so and point to `/add-recipe-cal`.
6. Prefer Recipes tagged for that Meal Time (a hint, not a rule), and starred ones.
7. He likes dinners that make leftovers: one **Cook** (a batch made on one day) should feed several Meal Times (dinner plus the next days' lunches). A Portion is never placed before its Cook's `cook_date`. `servings_made` ≥ servings placed (spare is fine).
8. Portion sizes in quarter servings (0.5, 0.75, 1, 1.25, 1.5…).

## Show the draft

A compact table per day (Meal Time → Recipe, servings, kcal) with each day's total, and a Cooks list (Recipe, cook day, servings made vs placed). Say which days miss the band and why. Things he asks for happen straight away; anything you only suggest waits for a yes.

## Write it

When he says go (or immediately, if he asked you to just do it), in one transaction:

```sql
insert into meal_plans (week_start) values ('YYYY-MM-DD')
  on conflict (week_start) do nothing;
-- for a draft plan being redone: delete from cooks where meal_plan_id = <id>;  (portions cascade)
insert into cooks (meal_plan_id, recipe_id, cook_date, servings_made) values (…) returning id;
insert into portions (cook_id, meal_time_id, eat_date, servings) values (…);
```

`portions` is unique on (`meal_time_id`, `eat_date`). Then tell him: "It's on the Plan tab. Resize or remove meals there, then tap Approve."

**If the plan is already approved**, don't delete Cooks without asking: an approved plan's Shopping list may already be bought. Changing a Cook's `servings_made` or adding a Cook after approval automatically adds an extra Shopping list line for the shortfall. Say so when it happens.

## Swaps and moves (any time in the week)

- **Swap**: replace a Portion's Cook with spare servings from another Cook, or a new Cook of another Recipe. Check the Meal Time range and the day total.
- **Move**: change the Portion's `eat_date` or `meal_time_id`. If that spot is taken, swap the two. If it would land before its Cook's `cook_date`, move the cook day too.
- Report the day totals that changed.

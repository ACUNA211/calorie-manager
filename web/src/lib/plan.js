// Plan data access: one week of the Household's Meal Plan, in one call to plan_week()
// (migration 038). The function returns only the caller's Household and only what the grid
// shows. Takes the Supabase client as its first argument so tests can pass a fake.

import { normalizeTime } from './mealTimesLogic.js';

// One Meal Time row from plan_week() or plan_meal_times().
function normalizeMealTime(meal) {
  return {
    id: meal.id,
    name: meal.name,
    time: normalizeTime(meal.time_of_day),
    kind: meal.kind,
    weekdays: meal.weekdays ?? null,
    memberIds: meal.member_ids || [],
  };
}

const asNumber = (value) => (value === null || value === undefined ? null : Number(value));

// The raw jsonb becomes plain data the grid logic reads: numbers are numbers, times are "HH:MM".
export function normalizePlanWeek(raw) {
  const data = raw || {};
  return {
    plan: data.plan ?? null,
    cooks: (data.cooks || []).map((cook) => ({
      id: cook.id,
      recipeId: cook.recipe_id,
      recipeName: cook.recipe_name,
      cookDate: cook.cook_date,
      servingsMade: asNumber(cook.servings_made),
      kcalPerServing: asNumber(cook.kcal_per_serving) ?? 0,
    })),
    portions: (data.portions || []).map((portion) => ({
      id: portion.id,
      cookId: portion.cook_id,
      memberId: portion.member_id,
      mealTimeId: portion.meal_time_id,
      eatDate: portion.eat_date,
      servings: asNumber(portion.servings) ?? 0,
    })),
    mealTimes: (data.meal_times || []).map(normalizeMealTime),
    members: (data.members || []).map((member) => ({
      id: member.id,
      name: member.display_name,
      role: member.role,
      bandLow: asNumber(member.band_low),
      bandHigh: asNumber(member.band_high),
    })),
  };
}

// The Meal Plan for the week starting on the Sunday `weekStart` ('YYYY-MM-DD'). A week with
// no plan comes back with plan null and empty lists.
export async function loadPlanWeek(client, weekStart) {
  const { data, error } = await client.rpc('plan_week', { p_week_start: weekStart });
  if (error) throw error;
  return normalizePlanWeek(data);
}

// Every Meal Time in the Household (migration 039), so the grid can show empty slots to add to.
export async function loadSlotMealTimes(client) {
  const { data, error } = await client.rpc('plan_meal_times');
  if (error) throw error;
  return (data || []).map(normalizeMealTime);
}

// The Household's Recipes to pick a Cook from, starred first. Row-level security scopes them.
export async function loadRecipeChoices(client) {
  const { data, error } = await client
    .from('recipes')
    .select('id, name, starred')
    .order('starred', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ id: row.id, name: row.name }));
}

async function call(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

// Writes (migration 039). Each runs as the owner and checks the Household, so a Member can
// place a Portion for another Member at a shared Meal Time.
export const addCook = (client, weekStart, recipeId, cookDate) =>
  call(client, 'plan_add_cook', {
    p_week_start: weekStart,
    p_recipe_id: recipeId,
    p_cook_date: cookDate,
  });

export const deleteCook = (client, cookId) =>
  call(client, 'plan_delete_cook', { p_cook_id: cookId });

// Puts or resizes a Portion; the Cook's servings made grows to cover it.
export const setPortion = (client, { cookId, memberId, mealTimeId, eatDate, servings }) =>
  call(client, 'plan_set_portion', {
    p_cook_id: cookId,
    p_member_id: memberId,
    p_meal_time_id: mealTimeId,
    p_eat_date: eatDate,
    p_servings: servings,
  });

export const movePortion = (client, portionId, mealTimeId, eatDate) =>
  call(client, 'plan_move_portion', {
    p_portion_id: portionId,
    p_meal_time_id: mealTimeId,
    p_eat_date: eatDate,
  });

export const removePortion = (client, portionId) =>
  call(client, 'plan_remove_portion', { p_portion_id: portionId });

// Approve (migration 041). The Owner always may; Members only when the Owner allowed them.
// The database checks it too, so hiding the button is a convenience, not the rule.
export async function loadCanApprove(client) {
  const { data, error } = await client.rpc('plan_can_approve');
  if (error) throw error;
  return data === true;
}

// Approves the plan. Safe to call twice: the second call changes nothing, and approving an
// edited approved plan again clears its "changed since approval" mark. Approval is what builds
// the Shopping list (ticket 46 hooks in on the database side, inside plan_approve()).
export const approvePlan = (client, planId) => call(client, 'plan_approve', { p_plan_id: planId });

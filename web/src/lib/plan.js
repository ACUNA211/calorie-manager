// Plan data access: one week of the Household's Meal Plan, in one call to plan_week()
// (migration 038). The function returns only the caller's Household and only what the grid
// shows. Takes the Supabase client as its first argument so tests can pass a fake.

import { normalizeTime } from './mealTimesLogic.js';

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
    mealTimes: (data.meal_times || []).map((meal) => ({
      id: meal.id,
      name: meal.name,
      time: normalizeTime(meal.time_of_day),
      kind: meal.kind,
      memberIds: meal.member_ids || [],
    })),
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

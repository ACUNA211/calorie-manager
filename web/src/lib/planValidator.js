// The plan validator (ticket 41): checks a Meal Plan slot by slot and returns the failing slots
// with reasons. PURE JavaScript over plain data: no React, no Supabase, no imports, no DOM, so
// the AI draft (42) and swap (43) can import this same file from a Deno Edge Function to check
// what the model returned before it is saved. Keep it that way.
//
// Input (the shapes plan.js normalizes; `slots` is every Meal Time of the Household):
//   days        the seven day keys 'YYYY-MM-DD', Sunday first
//   cooks       [{ id, recipeId, recipeName, kcalPerServing }]
//   portions    [{ id, cookId, memberId, mealTimeId, eatDate, servings }]
//   mealTimes   Meal Times with a Portion that week, and slots: every Meal Time of the Household;
//               each { id, name, time, kind: 'set'|'planned'|'if_room', weekdays, memberIds }
//   members     [{ id, name, bandLow, bandHigh }]   (band in calories, null without a Target)
//   ranges      [{ mealTimeId, memberId, calMin, calMax, setCalories }]   each sharer's own range
//   breaks      [{ recipeId, memberId, ruleKind, rule, foodName }]   Hard-rule breaks (040)
//   recipeIds   ids of the Recipes that exist; leave undefined to skip the existence check
//
// Output: { ok, failures }. Each failure is one slot (or one day for the band checks):
//   { code, day, memberId, mealTimeId (null for a day), cookId, portionId, params }
// `code` is a translation key suffix (plan.validation.<code>); `params` fills its placeholders.
//   unfilled       a Planned Meal Time has no Portion
//   belowRange     a Planned Portion has fewer calories than its range
//   aboveRange     a Planned or If room Portion has more calories than its range maximum
//   setTouched     a Portion sits at a Set Meal Time (Set Meal Times are left alone)
//   hardRule       the Recipe breaks a Hard rule of the Member who eats it
//   unknownRecipe  the Cook's Recipe id does not exist
//   dayUnder / dayOver   the Member's day is below / above their Planning band

// 0 = Sunday, from a 'YYYY-MM-DD' key, with no time zone involved.
function weekdayOfKey(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const kcalOf = (portion, cook) => Math.round(portion.servings * (cook?.kcalPerServing ?? 0));

export function validatePlan(data) {
  const days = data.days || [];
  const cooks = new Map((data.cooks || []).map((cook) => [cook.id, cook]));
  const members = data.members || [];
  const memberById = new Map(members.map((member) => [member.id, member]));
  const daySet = new Set(days);
  const portions = (data.portions || []).filter((p) => daySet.has(p.eatDate));
  const known = data.recipeIds === undefined ? null : new Set(data.recipeIds);

  const mealTimes = new Map();
  for (const meal of data.slots || []) mealTimes.set(meal.id, meal);
  for (const meal of data.mealTimes || [])
    if (!mealTimes.has(meal.id)) mealTimes.set(meal.id, meal);

  const ranges = new Map(
    (data.ranges || []).map((range) => [`${range.memberId}|${range.mealTimeId}`, range])
  );
  const breaks = new Map();
  for (const entry of data.breaks || []) {
    const key = `${entry.recipeId}|${entry.memberId}`;
    if (!breaks.has(key)) breaks.set(key, []);
    breaks.get(key).push(entry);
  }

  const failures = [];
  const fail = (code, fields, params) =>
    failures.push({
      code,
      day: fields.day,
      memberId: fields.memberId,
      mealTimeId: fields.mealTimeId ?? null,
      cookId: fields.cookId ?? null,
      portionId: fields.portionId ?? null,
      params,
    });

  const meals = [...mealTimes.values()];
  const happensOn = (meal, day) => !meal.weekdays || meal.weekdays.includes(weekdayOfKey(day));

  // Which slots hold a Portion, and each Member's planned calories per day.
  const filled = new Set();
  const dayKcal = new Map();
  for (const portion of portions) {
    filled.add(`${portion.memberId}|${portion.mealTimeId}|${portion.eatDate}`);
    const meal = mealTimes.get(portion.mealTimeId);
    if (meal && meal.kind === 'set') continue; // a Set Meal Time counts its set calories below
    const dayKey = `${portion.memberId}|${portion.eatDate}`;
    dayKcal.set(dayKey, (dayKcal.get(dayKey) ?? 0) + kcalOf(portion, cooks.get(portion.cookId)));
  }

  // Every Planned Meal Time is filled.
  for (const meal of meals) {
    if (meal.kind !== 'planned') continue;
    for (const memberId of meal.memberIds || []) {
      const member = memberById.get(memberId);
      if (!member) continue;
      for (const day of days) {
        if (!happensOn(meal, day) || filled.has(`${memberId}|${meal.id}|${day}`)) continue;
        const range = ranges.get(`${memberId}|${meal.id}`);
        fail(
          'unfilled',
          { day, memberId, mealTimeId: meal.id },
          {
            name: member.name,
            meal: meal.name,
            min: range?.calMin ?? null,
            max: range?.calMax ?? null,
          }
        );
      }
    }
  }

  // Portion by portion: range, Set Meal Times, Recipe exists, Hard rules.
  for (const portion of portions) {
    const cook = cooks.get(portion.cookId);
    const meal = mealTimes.get(portion.mealTimeId);
    const name = memberById.get(portion.memberId)?.name ?? '';
    const recipe = cook?.recipeName ?? '';
    const fields = {
      day: portion.eatDate,
      memberId: portion.memberId,
      mealTimeId: portion.mealTimeId,
      cookId: portion.cookId,
      portionId: portion.id,
    };
    const kcal = kcalOf(portion, cook);

    if (meal?.kind === 'set') {
      fail('setTouched', fields, { name, meal: meal.name, recipe });
    } else if (meal) {
      const range = ranges.get(`${portion.memberId}|${portion.mealTimeId}`);
      if (range) {
        const params = {
          name,
          meal: meal.name,
          recipe,
          kcal,
          min: range.calMin,
          max: range.calMax,
        };
        if (meal.kind === 'planned' && range.calMin != null && kcal < range.calMin) {
          fail('belowRange', fields, params);
        }
        if (range.calMax != null && kcal > range.calMax) fail('aboveRange', fields, params);
      }
    }

    if (known && cook && !known.has(cook.recipeId)) {
      fail('unknownRecipe', fields, { name, recipe, recipeId: cook.recipeId });
    }

    for (const found of breaks.get(`${cook?.recipeId}|${portion.memberId}`) || []) {
      fail('hardRule', fields, {
        name,
        recipe,
        rule: found.rule,
        ruleKind: found.ruleKind ?? null,
        ingredient: found.foodName ?? '',
      });
    }
  }

  // Each Member's day inside their Planning band. Set calories count toward the day. A day on
  // which the Member has no Meal Time and no Portion is not checked.
  for (const member of members) {
    if (member.bandLow == null || member.bandHigh == null) continue;
    for (const day of days) {
      let total = dayKcal.get(`${member.id}|${day}`) ?? 0;
      let any = total > 0;
      for (const meal of meals) {
        if (!(meal.memberIds || []).includes(member.id) || !happensOn(meal, day)) continue;
        any = true;
        if (meal.kind === 'set') total += ranges.get(`${member.id}|${meal.id}`)?.setCalories ?? 0;
      }
      if (!any) continue;
      const params = { name: member.name, kcal: total, low: member.bandLow, high: member.bandHigh };
      if (total < member.bandLow) fail('dayUnder', { day, memberId: member.id }, params);
      else if (total > member.bandHigh) fail('dayOver', { day, memberId: member.id }, params);
    }
  }

  return { ok: failures.length === 0, failures };
}

// Failures that belong to one grid cell: any of `mealTimeIds` (the row's Meal Times) on `day`.
export function failuresForCell(failures, mealTimeIds, day) {
  return failures.filter(
    (f) => f.mealTimeId != null && f.day === day && mealTimeIds.includes(f.mealTimeId)
  );
}

// Failures for one Member's whole day (the band checks).
export function failuresForDay(failures, memberId, day) {
  return failures.filter((f) => f.mealTimeId == null && f.memberId === memberId && f.day === day);
}

// Ticket #65: after a Member logs a new weight, decide whether to offer updated Targets from
// the Intake formula (ticket #64). Pure: the screen loads the rows and shows the result.
//
// Threshold: the offer is made when the rounded Calorie Target or the rounded protein floor
// the formula now gives differs from the saved one (a Target that is not set counts as
// different). Those two are the values that move with weight; the carb and fat ranges follow
// the Calorie Target, so a hand-edited range alone does not nag on every weight. When the offer
// is made it lists every figure that changes, and "Yes" saves all six, as the Intake form does.
// A logged weight that is not the Member's latest (a back-dated entry) makes no offer.
import { ageOn, suggestTargets } from './intakeLogic.js';

// The Target figures in display order: [form field, stored column, suggestion key].
export const SUGGESTED_FIELDS = [
  ['calorieTarget', 'calorie_target', 'calorieTarget'],
  ['proteinFloor', 'protein_floor_g', 'proteinFloorG'],
  ['carbLow', 'carb_low_g', 'carbLowG'],
  ['carbHigh', 'carb_high_g', 'carbHighG'],
  ['fatLow', 'fat_low_g', 'fatLowG'],
  ['fatHigh', 'fat_high_g', 'fatHighG'],
];

// Decides. Inputs: isDependent, intake (the member_intake row or null), targets (the
// member_settings row or null), kg (the new weight), todayKey, and isLatest (false when the
// weight logged is older than an entry already in the log). Returns { show: false, reason }
// or { show: true, form, changes }, where form holds the proposed values as strings for
// validateTargets and changes lists { field, from, to } for each figure that differs.
export function decideTargetsUpdate({
  isDependent = false,
  intake,
  targets,
  kg,
  todayKey,
  isLatest = true,
}) {
  if (isDependent) return { show: false, reason: 'dependent' };
  if (!intake) return { show: false, reason: 'noIntake' };
  if (!isLatest) return { show: false, reason: 'notLatest' };

  const result = suggestTargets({
    isDependent: false,
    sex: intake.sex,
    age: ageOn(intake.birth_date, todayKey),
    cm: Number(intake.height_cm),
    kg,
    work: intake.work,
    sessions: intake.exercise_sessions,
    minutes: intake.exercise_minutes,
    goal: intake.goal,
    pace: intake.pace_kcal ?? undefined,
    floorOn: intake.floor_on !== false,
    floorKcal: intake.floor_kcal ?? null,
  });
  if (!result.ok) return { show: false, reason: result.reason };

  const changes = [];
  const form = {};
  for (const [field, column, key] of SUGGESTED_FIELDS) {
    const to = result[key];
    const from = targets && targets[column] !== undefined ? targets[column] : null;
    form[field] = String(to);
    if (from !== to) changes.push({ field, from, to });
  }
  const moved = changes.some(
    (change) => change.field === 'calorieTarget' || change.field === 'proteinFloor'
  );
  if (!moved) return { show: false, reason: 'same' };
  return { show: true, form, changes };
}

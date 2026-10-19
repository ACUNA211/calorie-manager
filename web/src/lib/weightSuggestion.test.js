import { describe, expect, it } from 'vitest';
import { decideTargetsUpdate } from './weightSuggestion.js';
import { suggestTargets } from './intakeLogic.js';

const TODAY = '2026-10-19';
const intake = {
  sex: 'female',
  birth_date: '1990-05-17',
  height_cm: 165,
  work: 'sitting',
  exercise_sessions: null,
  exercise_minutes: null,
  goal: 'maintain',
  pace_kcal: null,
  floor_on: true,
  floor_kcal: null,
};

// What the formula gives for a weight, as the saved Targets row.
function rowFor(kg, extra = {}) {
  const s = suggestTargets({
    isDependent: false,
    sex: 'female',
    age: 36,
    cm: 165,
    kg,
    work: 'sitting',
    goal: 'maintain',
  });
  return {
    calorie_target: s.calorieTarget,
    protein_floor_g: s.proteinFloorG,
    carb_low_g: s.carbLowG,
    carb_high_g: s.carbHighG,
    fat_low_g: s.fatLowG,
    fat_high_g: s.fatHighG,
    ...extra,
  };
}

const base = { intake, todayKey: TODAY };

describe('decideTargetsUpdate', () => {
  it('offers the new values when the weight moves the Calorie Target', () => {
    const result = decideTargetsUpdate({ ...base, targets: rowFor(70), kg: 75 });
    expect(result.show).toBe(true);
    const calorie = result.changes.find((change) => change.field === 'calorieTarget');
    // Mifflin-St Jeor: 5 kg more is 50 kcal of resting energy, times 1.2 is 60.
    expect(calorie).toEqual({
      field: 'calorieTarget',
      from: rowFor(70).calorie_target,
      to: rowFor(70).calorie_target + 60,
    });
    expect(result.form.calorieTarget).toBe(String(rowFor(75).calorie_target));
    expect(result.form.proteinFloor).toBe(String(rowFor(75).protein_floor_g));
  });

  it('makes no offer when the rounded figures are unchanged', () => {
    expect(decideTargetsUpdate({ ...base, targets: rowFor(70), kg: 70 })).toEqual({
      show: false,
      reason: 'same',
    });
  });

  it('does not nag over a hand-edited carb range alone', () => {
    const targets = rowFor(70, { carb_low_g: 10, carb_high_g: 20 });
    expect(decideTargetsUpdate({ ...base, targets, kg: 70 }).reason).toBe('same');
  });

  it('offers when the Member has no Targets saved yet', () => {
    const result = decideTargetsUpdate({ ...base, targets: null, kg: 70 });
    expect(result.show).toBe(true);
    expect(result.changes[0]).toEqual({
      field: 'calorieTarget',
      from: null,
      to: rowFor(70).calorie_target,
    });
  });

  it('gives no offer to a Dependent', () => {
    expect(decideTargetsUpdate({ ...base, isDependent: true, targets: null, kg: 75 })).toEqual({
      show: false,
      reason: 'dependent',
    });
  });

  it('gives no offer without Intake answers', () => {
    expect(decideTargetsUpdate({ ...base, intake: null, targets: null, kg: 75 }).reason).toBe(
      'noIntake'
    );
  });

  it('gives no offer when the goal is to enter Targets by hand', () => {
    const hand = { ...intake, goal: 'hand' };
    expect(decideTargetsUpdate({ ...base, intake: hand, targets: null, kg: 75 }).reason).toBe(
      'hand'
    );
  });

  it('gives no offer under 18', () => {
    const young = { ...intake, birth_date: '2012-01-01' };
    expect(decideTargetsUpdate({ ...base, intake: young, targets: null, kg: 50 }).reason).toBe(
      'underage'
    );
  });

  it('gives no offer for a back-dated weight', () => {
    expect(
      decideTargetsUpdate({ ...base, targets: rowFor(70), kg: 75, isLatest: false }).reason
    ).toBe('notLatest');
  });

  it('keeps the Member suggestion floor', () => {
    const lowKg = decideTargetsUpdate({
      ...base,
      intake: { ...intake, goal: 'lose', pace_kcal: 750, height_cm: 150 },
      targets: null,
      kg: 40,
    });
    expect(lowKg.form.calorieTarget).toBe('1200');
  });
});

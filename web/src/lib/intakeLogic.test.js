import { describe, it, expect } from 'vitest';
import {
  activityFactor,
  ageOn,
  floorFor,
  heightFields,
  mifflinStJeor,
  parseCount,
  parseHeight,
  suggestTargets,
} from './intakeLogic.js';

// Worked examples. Ticket 01's report gives the equation and the factors but no numeric
// examples, so each one here is worked by hand from those, and the arithmetic is in the comment.

describe('mifflinStJeor', () => {
  it('man, 30 y, 80 kg, 180 cm: 800 + 1125 - 150 + 5 = 1780', () => {
    expect(mifflinStJeor({ sex: 'male', kg: 80, cm: 180, age: 30 })).toBe(1780);
  });

  it('woman, 40 y, 70 kg, 165 cm: 700 + 1031.25 - 200 - 161 = 1370.25', () => {
    expect(mifflinStJeor({ sex: 'female', kg: 70, cm: 165, age: 40 })).toBeCloseTo(1370.25, 5);
  });
});

describe('activityFactor', () => {
  it('sitting work and no exercise is the lowest factor', () => {
    expect(activityFactor({ work: 'sitting', sessions: 0, minutes: 0 })).toBe(1.2);
  });
  it('work on your feet starts at 1.375, heavy work at 1.55', () => {
    expect(activityFactor({ work: 'on_feet', sessions: 0, minutes: 0 })).toBe(1.375);
    expect(activityFactor({ work: 'heavy', sessions: 0, minutes: 0 })).toBe(1.55);
  });
  it('exercise adds a level from 90 minutes a week and two from 300', () => {
    expect(activityFactor({ work: 'sitting', sessions: 3, minutes: 30 })).toBe(1.375);
    expect(activityFactor({ work: 'sitting', sessions: 5, minutes: 60 })).toBe(1.55);
    expect(activityFactor({ work: 'sitting', sessions: 2, minutes: 40 })).toBe(1.2);
  });
  it('stops at 1.725', () => {
    expect(activityFactor({ work: 'heavy', sessions: 6, minutes: 60 })).toBe(1.725);
  });
  it('treats missing answers as the lowest', () => {
    expect(activityFactor({})).toBe(1.2);
  });
});

describe('suggestTargets', () => {
  const man = {
    sex: 'male',
    kg: 80,
    cm: 180,
    age: 30,
    work: 'sitting',
    sessions: 0,
    minutes: 0,
    goal: 'lose',
    pace: 500,
  };

  it('man, sitting, lose at 500: 1780 x 1.2 = 2136, less 500 = 1636', () => {
    const result = suggestTargets(man);
    expect(result.ok).toBe(true);
    expect(result.rmr).toBe(1780);
    expect(result.tdee).toBe(2136);
    expect(result.calorieTarget).toBe(1636);
    expect(result.clamped).toBe(false);
  });

  it('man: protein floor 1.4 x 80 = 112 g; fat 25-35% and carbs 45-65% of 1636 kcal', () => {
    const result = suggestTargets(man);
    expect(result.proteinFloorG).toBe(112);
    expect(result.fatLowG).toBe(Math.round((1636 * 0.25) / 9)); // 45
    expect(result.fatHighG).toBe(Math.round((1636 * 0.35) / 9)); // 64
    expect(result.carbLowG).toBe(Math.round((1636 * 0.45) / 4)); // 184
    expect(result.carbHighG).toBe(Math.round((1636 * 0.65) / 4)); // 266
    expect([result.fatLowG, result.fatHighG, result.carbLowG, result.carbHighG]).toEqual([
      45, 64, 184, 266,
    ]);
  });

  it('woman, 40 y, 70 kg, 165 cm, on her feet, lose at 500: 1370.25 x 1.375 = 1884, less 500 = 1384', () => {
    const result = suggestTargets({
      sex: 'female',
      kg: 70,
      cm: 165,
      age: 40,
      work: 'on_feet',
      sessions: 0,
      minutes: 0,
      goal: 'lose',
      pace: 500,
    });
    expect(result.tdee).toBe(1884);
    expect(result.calorieTarget).toBe(1384);
    expect(result.proteinFloorG).toBe(98);
  });

  it('maintain has no deficit', () => {
    expect(suggestTargets({ ...man, goal: 'maintain' }).calorieTarget).toBe(2136);
  });

  it('the pace changes the deficit: 250 and 750', () => {
    expect(suggestTargets({ ...man, pace: 250 }).calorieTarget).toBe(1886);
    // 2136 - 750 = 1386, under the man's 1,500 floor, so it clamps
    expect(suggestTargets({ ...man, pace: 750 }).calorieTarget).toBe(1500);
    expect(suggestTargets({ ...man, pace: 750, floorOn: false }).calorieTarget).toBe(1386);
  });

  it('an unknown pace falls back to 500', () => {
    expect(suggestTargets({ ...man, pace: 900 }).deficit).toBe(500);
  });

  describe('the suggestion floor (ticket 70)', () => {
    // woman, 60 y, 55 kg, 155 cm: 550 + 968.75 - 300 - 161 = 1057.75; x 1.2 = 1269.3;
    // less 750 = 519.3, far under 1200.
    const small = {
      sex: 'female',
      kg: 55,
      cm: 155,
      age: 60,
      work: 'sitting',
      sessions: 0,
      minutes: 0,
      goal: 'lose',
      pace: 750,
    };

    it('clamps a woman at 1,200 by default', () => {
      const result = suggestTargets(small);
      expect(result.calorieTarget).toBe(1200);
      expect(result.clamped).toBe(true);
      expect(result.floor).toBe(1200);
    });

    it('clamps a man at 1,500 by default', () => {
      // man, 60 y, 60 kg, 165 cm: 600 + 1031.25 - 300 + 5 = 1336.25; x 1.2 = 1603.5; less 750 = 853.5
      const result = suggestTargets({ ...small, sex: 'male', kg: 60, cm: 165 });
      expect(result.calorieTarget).toBe(1500);
      expect(result.clamped).toBe(true);
    });

    it('uses a floor the Member changed', () => {
      const result = suggestTargets({ ...small, floorKcal: 1000 });
      expect(result.calorieTarget).toBe(1000);
    });

    it('does not clamp when the floor is off', () => {
      const result = suggestTargets({ ...small, floorOn: false });
      expect(result.calorieTarget).toBe(519);
      expect(result.clamped).toBe(false);
      expect(result.floor).toBeNull();
    });

    it('does not touch a suggestion that is already above the floor', () => {
      expect(suggestTargets(man).clamped).toBe(false);
    });

    it('works the macros from the clamped Calorie Target', () => {
      expect(suggestTargets(small).fatLowG).toBe(Math.round((1200 * 0.25) / 9));
    });
  });

  describe('no suggestion', () => {
    it('for a Dependent', () => {
      expect(suggestTargets({ ...man, isDependent: true })).toEqual({
        ok: false,
        reason: 'dependent',
      });
    });
    it('under 18', () => {
      expect(suggestTargets({ ...man, age: 17 }).reason).toBe('underage');
    });
    it('at 18 there is one', () => {
      expect(suggestTargets({ ...man, age: 18 }).ok).toBe(true);
    });
    it('when pregnant or breastfeeding', () => {
      expect(suggestTargets({ ...man, pregnant: true }).reason).toBe('pregnant');
    });
    it('for the hand-enter goal', () => {
      expect(suggestTargets({ ...man, goal: 'hand' }).reason).toBe('hand');
    });
    it('when an answer is missing', () => {
      expect(suggestTargets({ ...man, kg: 0 }).reason).toBe('missing');
      expect(suggestTargets({ ...man, sex: '' }).reason).toBe('missing');
      expect(suggestTargets({ ...man, goal: '' }).reason).toBe('missing');
      expect(suggestTargets({ ...man, age: null }).reason).toBe('missing');
    });
  });
});

describe('floorFor', () => {
  it('defaults by sex, can be changed, can be off', () => {
    expect(floorFor({ sex: 'female' })).toBe(1200);
    expect(floorFor({ sex: 'male' })).toBe(1500);
    expect(floorFor({ sex: 'male', floorKcal: 1300 })).toBe(1300);
    expect(floorFor({ sex: 'male', floorOn: false })).toBeNull();
  });
});

describe('ageOn', () => {
  it('counts whole years', () => {
    expect(ageOn('2000-10-19', '2026-10-19')).toBe(26);
    expect(ageOn('2000-10-20', '2026-10-19')).toBe(25);
    expect(ageOn('2008-10-19', '2026-10-19')).toBe(18);
    expect(ageOn('2008-10-20', '2026-10-19')).toBe(17);
  });
  it('refuses bad or future dates', () => {
    expect(ageOn('2000-02-31', '2026-10-19')).toBeNull();
    expect(ageOn('nope', '2026-10-19')).toBeNull();
    expect(ageOn('2030-01-01', '2026-10-19')).toBeNull();
  });
});

describe('height', () => {
  it('reads centimetres in metric', () => {
    expect(parseHeight('metric', { cm: '180' })).toEqual({ ok: true, cm: 180 });
  });
  it('reads feet and inches in US', () => {
    expect(parseHeight('us', { feet: '5', inches: '11' })).toEqual({ ok: true, cm: 180.3 });
    expect(parseHeight('us', { feet: '6', inches: '' })).toEqual({ ok: true, cm: 182.9 });
  });
  it('refuses nonsense', () => {
    expect(parseHeight('metric', { cm: 'tall' }).error).toBe('intake.errors.heightNumber');
    expect(parseHeight('metric', { cm: '20' }).error).toBe('intake.errors.heightRange');
  });
  it('shows a stored height in the display units', () => {
    expect(heightFields(180.3, 'metric').cm).toBe('180.3');
    expect(heightFields(180.3, 'us')).toEqual({ cm: '', feet: '5', inches: '11' });
    expect(heightFields(null, 'us').feet).toBe('');
  });
});

describe('parseCount', () => {
  it('reads whole numbers in range; empty is null', () => {
    expect(parseCount('', 0, 21, 'e')).toEqual({ ok: true, value: null });
    expect(parseCount('3', 0, 21, 'e')).toEqual({ ok: true, value: 3 });
    expect(parseCount('22', 0, 21, 'e').ok).toBe(false);
    expect(parseCount('1.5', 0, 21, 'e').ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { dayTotal, overage, planRebalance } from './rebalanceLogic.js';

const TARGET = 2000;

const p = (id, kind, servings, kcalPerServing, extra = {}) => ({
  id,
  cookId: `cook-${id}`,
  mealTimeId: `mt-${id}`,
  kind,
  servings,
  kcalPerServing,
  calMin: 0,
  logged: false,
  ...extra,
});

const day = (date, loggedKcal, portions) => ({ date, loggedKcal, portions });

describe('overage', () => {
  it('is logged plus unlogged planned minus the target', () => {
    const d = day('2026-10-18', 800, [p('a', 'planned', 1, 600), p('b', 'set', 1, 300)]);
    expect(dayTotal(d)).toBe(1700);
    expect(overage([d], TARGET)).toBe(-300);
  });

  it('counts a logged Portion once (through loggedKcal only)', () => {
    const d = day('2026-10-18', 800, [p('a', 'planned', 1, 600, { logged: true })]);
    expect(dayTotal(d)).toBe(800);
  });

  it('adds up several days against several targets', () => {
    const a = day('2026-10-18', 2100, []);
    const b = day('2026-10-19', 1800, []);
    expect(overage([a, b], TARGET)).toBe(-100);
  });
});

describe('planRebalance', () => {
  it('returns no options when already at or under the target', () => {
    const d = day('2026-10-18', 1500, [p('a', 'planned', 1, 500)]);
    expect(planRebalance({ today: d, calorieTarget: TARGET })).toEqual({
      status: 'ok',
      overage: 0,
      options: [],
    });
  });

  it('lever 1 drops an If room Portion, and only as many as needed', () => {
    const d = day('2026-10-18', 1500, [
      p('big', 'if_room', 1, 300),
      p('small', 'if_room', 1, 150),
      p('dinner', 'planned', 1, 400, { calMin: 400 }),
    ]); // total 2350, over 350
    const res = planRebalance({ today: d, calorieTarget: TARGET });
    const drop = res.options.find((o) => o.label === 'drop');
    expect(drop.changes.map((c) => [c.type, c.portionId])).toEqual([
      ['drop', 'big'],
      ['drop', 'small'],
    ]);
    expect(drop.landsAt).toBe(1900);
    expect(drop.fits).toBe(true);
  });

  it('lever 2 shrinks Planned Portions in quarter servings and the rest become Leftovers', () => {
    const d = day('2026-10-18', 1500, [p('dinner', 'planned', 2, 400, { calMin: 200 })]);
    // total 2300, over 300 -> 3 quarter steps of 100 kcal
    const res = planRebalance({ today: d, calorieTarget: TARGET });
    const shrink = res.options.find((o) => o.label === 'shrink');
    expect(shrink.changes).toHaveLength(1);
    expect(shrink.changes[0]).toMatchObject({
      type: 'shrink',
      from: 2,
      to: 1.25,
      leftoverServings: 0.75,
    });
    expect(shrink.changes[0].to % 0.25).toBe(0);
    expect(shrink.landsAt).toBe(2000);
  });

  it('never shrinks a Planned Portion below its range', () => {
    const d = day('2026-10-18', 1700, [p('dinner', 'planned', 1, 400, { calMin: 300 })]);
    // total 2100, over 100; floor allows 100 off (one quarter step)
    const ok = planRebalance({ today: d, calorieTarget: TARGET });
    expect(ok.status).toBe('fits');
    expect(ok.options[0].changes[0].to).toBe(0.75);

    const tight = day('2026-10-18', 1700, [p('dinner', 'planned', 1, 400, { calMin: 350 })]);
    const res = planRebalance({ today: tight, calorieTarget: TARGET });
    expect(res.status).toBe('cantFit');
    expect(res.options).toEqual([]); // nothing may change
  });

  it('keeps a shared Meal Time total above its floor across several Portions', () => {
    const a = p('a', 'planned', 1, 400, { mealTimeId: 'lunch', calMin: 700 });
    const b = p('b', 'planned', 1, 400, { mealTimeId: 'lunch', calMin: 700 });
    const d = day('2026-10-18', 1500, [a, b]); // 2300, over 300; lunch 800 with floor 700
    const res = planRebalance({ today: d, calorieTarget: TARGET });
    expect(res.status).toBe('cantFit');
    const lunch = res.options[0].changes.reduce((s, c) => s + (c.from - c.to) * 400, 0);
    expect(800 - lunch).toBeGreaterThanOrEqual(700);
  });

  it('never touches Set, logged, or Cook servings made', () => {
    const d = day('2026-10-18', 1000, [
      p('set', 'set', 1, 500),
      p('done', 'planned', 1, 500, { logged: true }),
      p('snack', 'if_room', 1, 200),
      p('dinner', 'planned', 1, 800, { calMin: 400 }),
    ]);
    const res = planRebalance({
      today: d,
      later: [
        day('2026-10-19', 0, [
          p('set2', 'set', 1, 900),
          p('l', 'planned', 1, 500, { calMin: 300 }),
        ]),
      ],
      calorieTarget: TARGET,
    });
    const touched = res.options.flatMap((o) => o.changes.map((c) => c.portionId));
    expect(touched.length).toBeGreaterThan(0);
    for (const id of ['set', 'done', 'set2']) expect(touched).not.toContain(id);
    for (const o of res.options) {
      for (const c of o.changes) {
        expect(c).not.toHaveProperty('servingsMade');
        expect(c.to).toBeLessThan(c.from);
      }
    }
  });

  it('spreads the rest over later days at most 10% of the target per day', () => {
    // today: 2400 (over 400) with only a shrinkable dinner that floors out.
    const today = day('2026-10-18', 1600, [p('dinner', 'planned', 1, 800, { calMin: 800 })]);
    const later = [
      day('2026-10-19', 0, [p('x', 'planned', 4, 400, { calMin: 100 })]),
      day('2026-10-20', 0, [p('y', 'planned', 4, 400, { calMin: 100 })]),
      day('2026-10-21', 0, [p('z', 'planned', 4, 400, { calMin: 100 })]),
    ];
    const res = planRebalance({ today, later, calorieTarget: TARGET });
    expect(res.status).toBe('fits');
    const spread = res.options[0];
    expect(spread.label).toBe('spread');
    expect(spread.spreadKcal).toBeGreaterThanOrEqual(400);
    const perDay = {};
    for (const c of spread.changes) perDay[c.date] = (perDay[c.date] || 0) + c.kcalSaved;
    expect(perDay['2026-10-18']).toBeUndefined();
    for (const saved of Object.values(perDay)) expect(saved).toBeLessThanOrEqual(200 + 1e-9);
    expect(spread.lands.map((l) => l.date)).toEqual(['2026-10-18', '2026-10-19', '2026-10-20']);
  });

  it('honours a different spread percentage', () => {
    const today = day('2026-10-18', 1600, [p('dinner', 'planned', 1, 800, { calMin: 800 })]);
    const later = [
      day('2026-10-19', 0, [p('x', 'planned', 4, 400, { calMin: 100 })]),
      day('2026-10-20', 0, [p('y', 'planned', 4, 400, { calMin: 100 })]),
    ];
    const res = planRebalance({ today, later, calorieTarget: TARGET, maxSpreadPct: 5 });
    // 5% = 100 kcal a day, two days = 200 < 400
    expect(res.status).toBe('cantFit');
    expect(res.options[0].spreadKcal).toBe(200);
    expect(res.options[0].shortfall).toBe(200);
  });

  it('reports cantFit with the best effort and its shortfall', () => {
    const today = day('2026-10-18', 2600, [p('dinner', 'planned', 1, 400, { calMin: 300 })]);
    const res = planRebalance({ today, calorieTarget: TARGET });
    expect(res.status).toBe('cantFit');
    expect(res.options).toHaveLength(1);
    expect(res.options[0].fits).toBe(false);
    expect(res.options[0].shortfall).toBe(900); // over 1000, one quarter step (100) saved
  });

  it('orders options smallest change first and returns at most 3', () => {
    const today = day('2026-10-18', 1500, [
      p('snack', 'if_room', 1, 400),
      p('dinner', 'planned', 2, 400, { calMin: 200 }),
    ]); // total 2700, over 700
    const later = [day('2026-10-19', 0, [p('x', 'planned', 4, 400, { calMin: 100 })])];
    const res = planRebalance({ today, later, calorieTarget: TARGET });
    expect(res.status).toBe('fits');
    expect(res.options.length).toBeLessThanOrEqual(3);
    const saved = res.options.map((o) => o.kcalSaved);
    expect(saved).toEqual([...saved].sort((a, b) => a - b));
    // drop alone (400) is not enough; shrink alone (600 max) is not enough; so first is drop+shrink
    expect(res.options[0].levers).toEqual(['drop', 'shrink']);
  });

  it('puts the smallest sufficient lever first', () => {
    const today = day('2026-10-18', 1500, [
      p('snack', 'if_room', 1, 250),
      p('dinner', 'planned', 2, 400, { calMin: 200 }),
    ]); // total 2550, over 550: drop (250) is not enough, shrink alone is (600 room)
    const res = planRebalance({ today, calorieTarget: TARGET });
    expect(res.status).toBe('fits');
    expect(res.options[0].kcalSaved).toBeLessThanOrEqual(
      res.options[res.options.length - 1].kcalSaved
    );
    expect(res.options.every((o) => o.fits)).toBe(true);
  });
});

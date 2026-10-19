import { describe, expect, it } from 'vitest';
import { matchLine, scanPlan } from './shoppingScan.js';

const line = (id, overrides = {}) => ({
  id,
  foodId: 2,
  source: 'plan',
  purchased: false,
  pending: null,
  addedAt: '2026-10-19T12:00:00Z',
  ...overrides,
});

describe('matchLine', () => {
  it('finds the open line of the scanned food', () => {
    expect(matchLine([line(1, { foodId: 3 }), line(2)], 2).id).toBe(2);
  });
  it('compares food ids as numbers', () => {
    expect(matchLine([line(1, { foodId: '2' })], 2).id).toBe(1);
  });
  it('returns null with no line for the food', () => {
    expect(matchLine([line(1, { foodId: 3 })], 2)).toBeNull();
  });
  it('returns null for a food with no id', () => {
    expect(matchLine([line(1, { foodId: null })], null)).toBeNull();
    expect(matchLine([line(1)], undefined)).toBeNull();
  });
  it('skips ticked lines and lines still waiting to be sent', () => {
    const lines = [line(1, { purchased: true }), line(2, { pending: 'add' }), line('c-1'), line(4)];
    expect(matchLine(lines, 2).id).toBe(4);
  });
  it('takes the planned line before an extra, then the oldest', () => {
    const extra = line(1, { source: 'plan_extra', addedAt: '2026-10-18T12:00:00Z' });
    const older = line(5, { addedAt: '2026-10-17T12:00:00Z' });
    const newer = line(3, { addedAt: '2026-10-19T12:00:00Z' });
    expect(matchLine([extra, newer, older], 2).id).toBe(5);
    expect(matchLine([extra], 2).id).toBe(1);
  });
});

describe('scanPlan', () => {
  it('ticks the matching line', () => {
    expect(scanPlan([line(1)], 2)).toEqual({ kind: 'tick', line: line(1) });
  });
  it('offers the Pantry when the food has no line', () => {
    expect(scanPlan([line(1, { foodId: 9 })], 2)).toEqual({ kind: 'offer', alreadyTicked: false });
  });
  it('says so when every line of the food is already ticked', () => {
    expect(scanPlan([line(1, { purchased: true })], 2)).toEqual({
      kind: 'offer',
      alreadyTicked: true,
    });
  });
});

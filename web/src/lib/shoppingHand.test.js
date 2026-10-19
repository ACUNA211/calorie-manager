import { describe, expect, it } from 'vitest';
import {
  lineFromRow,
  queuedAdd,
  queuedTick,
  validateHandLine,
  withQueued,
} from './shoppingLogic.js';

describe('hand-added lines and the offline queue (ticket 48)', () => {
  const server = [
    lineFromRow({ id: 1, item_name: 'Apple', purchased: false, food_id: 3, source: 'plan' }),
    lineFromRow({ id: 2, item_name: 'Foil', purchased: false, source: 'hand', client_id: 'abc' }),
  ];

  it('queuedTick keys a tick by its line', () => {
    expect(queuedTick({ lineId: 4, kind: 'have_it' })).toEqual({
      clientId: 'tick:4',
      row: { op: 'tick', lineId: 4, kind: 'have_it', grams: null },
    });
  });

  it('withQueued shows a queued tick as ticked and not synced', () => {
    const items = [{ ...queuedTick({ lineId: 1, kind: 'bought' }), status: 'queued' }];
    const out = withQueued(server, items);
    expect(out[0].purchased).toBe(true);
    expect(out[0].pending).toBe('queued');
    expect(out[1].purchased).toBe(false);
  });

  it('withQueued adds a queued line, and not twice once the database has it', () => {
    const add = {
      ...queuedAdd({ clientId: 'new-1', name: 'Soap', text: '2' }),
      status: 'queued',
      queuedAt: '2026-10-19T09:00:00Z',
    };
    const out = withQueued(server, [add]);
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ id: 'new-1', name: 'Soap', source: 'hand', pending: 'queued' });
    const sent = { ...add, row: { ...add.row, clientId: 'abc' } };
    expect(withQueued(server, [sent])).toHaveLength(2);
  });

  describe('validateHandLine', () => {
    const parseMass = (text) =>
      /^\d+$/.test(text) ? { ok: true, grams: Number(text) } : { ok: false };
    const formatMass = (grams) => `${grams} g`;
    const check = (fields) => validateHandLine({ parseMass, formatMass, ...fields });

    it('needs a name or a food', () => {
      expect(check({ name: '  ' })).toEqual({ ok: false, error: 'shopping.add.errors.name' });
    });

    it('keeps free text for an amount with no food', () => {
      expect(check({ name: 'Foil', amount: 'one roll' })).toEqual({
        ok: true,
        name: 'Foil',
        foodId: null,
        grams: null,
        text: 'one roll',
      });
    });

    it('reads the amount of a food as grams', () => {
      expect(check({ name: '', food: { id: 9, name: 'Rice' }, amount: '500' })).toEqual({
        ok: true,
        name: 'Rice',
        foodId: 9,
        grams: 500,
        text: '500 g',
      });
      expect(check({ food: { id: 9, name: 'Rice' }, amount: 'lots' }).ok).toBe(false);
    });

    it('allows no amount at all', () => {
      expect(check({ name: 'Soap' })).toMatchObject({ ok: true, grams: null, text: null });
    });

    it('refuses a very long name', () => {
      expect(check({ name: 'x'.repeat(121) }).error).toBe('shopping.add.errors.tooLong');
    });
  });
});

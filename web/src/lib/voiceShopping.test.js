import { describe, it, expect } from 'vitest';
import {
  candidateLines,
  MAX_CARDS,
  NO_LINE,
  parseSpokenAdd,
  shoppingCards,
  shoppingQuestions,
  VOICE_ACTIONS,
} from './voiceShopping.js';
import { checkQuestions } from '../../../supabase/functions/_shared/decide.ts';

const lines = [
  { id: 1, name: 'Milk', purchased: false },
  { id: 2, name: 'Bread', purchased: false },
  { id: 3, name: 'Rice', purchased: true },
  { id: 4, name: 'Eggs', purchased: false, pending: true },
  { id: 5, name: 'Whole milk yogurt', purchased: false },
];

describe('candidateLines', () => {
  it('keeps only the open, unticked lines', () => {
    expect(candidateLines(lines, 'tick off the milk').map((l) => l.id)).toEqual([1, 2, 5]);
  });

  it('keeps the lines sharing words with the command when the list is too long', () => {
    expect(candidateLines(lines, 'tick off the milk', 2).map((l) => l.id)).toEqual([1, 5]);
  });
});

describe('shoppingQuestions', () => {
  it('asks for the action and which candidate line, with a no-match option', () => {
    const qs = shoppingQuestions(candidateLines(lines, ''));
    expect(qs.action.choices).toEqual(VOICE_ACTIONS);
    expect(qs.line.choices.map((c) => c.value)).toEqual(['line_1', 'line_2', 'line_5', NO_LINE]);
    expect(qs.line.choices[0].description).toBe('Milk');
  });

  it('passes the decide function check, even for a 39-line list', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
    expect(() => checkQuestions(shoppingQuestions(candidateLines(many, '')))).not.toThrow();
  });
});

describe('parseSpokenAdd', () => {
  it.each([
    ['add bread', { name: 'Bread', text: null }],
    ['Add two litres of milk to the list', { name: 'Milk', text: '2 litres' }],
    ['please add 2kg of rice', { name: 'Rice', text: '2 kg' }],
    ['add half a kilo of cheese', { name: 'Cheese', text: '0.5 kilo' }],
    ['add a dozen eggs', { name: 'Eggs', text: '1 dozen' }],
    ['add ten eggs', { name: 'Eggs', text: '10' }],
    ['add a melon', { name: 'Melon', text: null }],
    ['add apples', { name: 'Apples', text: null }],
    ['add tenderloin', { name: 'Tenderloin', text: null }],
    ['I need bread.', { name: 'Bread', text: null }],
    ['Añade pan', { name: 'Pan', text: null }],
    ['Agrega una docena de huevos a la lista', { name: 'Huevos', text: '1 docena' }],
    ['pon 3 latas de atún en la lista', { name: 'Atún', text: '3 latas' }],
    ['Añade medio kilo de queso', { name: 'Queso', text: '0.5 kilo' }],
  ])('%s', (said, expected) => {
    expect(parseSpokenAdd(said)).toEqual(expected);
  });

  it('returns null when nothing is left to add', () => {
    expect(parseSpokenAdd('add')).toBeNull();
    expect(parseSpokenAdd('')).toBeNull();
  });
});

describe('shoppingCards', () => {
  const open = candidateLines(lines, '');
  const answers = (action, line) => ({
    action: { type: 'choice', probabilities: action },
    line: { type: 'choice', probabilities: line },
  });

  it('puts the likeliest tick first, then other meanings, at most three', () => {
    const cards = shoppingCards(
      answers(
        { tick_shopping_line: 0.8, add_shopping_item: 0.15 },
        { line_1: 0.7, line_5: 0.25, line_2: 0.05 }
      ),
      open,
      'tick off the milk'
    );
    expect(cards).toHaveLength(MAX_CARDS);
    expect(cards.map((c) => [c.kind, c.line?.id ?? c.name])).toEqual([
      ['tick', 1],
      ['tick', 5],
      ['add', 'Tick off the milk'],
    ]);
  });

  it('offers the add with its amount when adding is likeliest', () => {
    const cards = shoppingCards(
      answers({ add_shopping_item: 0.9, tick_shopping_line: 0.1 }, { none: 0.9, line_1: 0.1 }),
      open,
      'add two litres of milk'
    );
    expect(cards[0]).toMatchObject({ kind: 'add', name: 'Milk', text: '2 litres' });
  });

  it('shows nothing for a command that is not about the Shopping list', () => {
    const cards = shoppingCards(
      answers({ log_other: 0.97, tick_shopping_line: 0.02, add_shopping_item: 0.01 }, { none: 1 }),
      open,
      'I ate an apple'
    );
    expect(cards).toEqual([]);
  });
});

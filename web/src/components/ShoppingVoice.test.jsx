import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { LOCALE_KEY } from '../i18n/locale.js';
import { supabase } from '../lib/supabase.js';
import ShoppingVoice from './ShoppingVoice.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

let instances;
class FakeRecognition {
  constructor() {
    instances.push(this);
  }
  start() {}
  stop() {
    this.onend?.();
  }
  abort() {}
}

// Speaks a final phrase and ends the capture.
const say = (text) =>
  act(() => {
    const rec = instances.at(-1);
    rec.onresult({ results: [Object.assign([{ transcript: text }], { isFinal: true })] });
    rec.onend();
  });

const lines = [
  { id: 1, name: 'Milk', purchased: false },
  { id: 2, name: 'Bread', purchased: false },
  { id: 3, name: 'Rice', purchased: true },
];

function decision(action, line) {
  return {
    data: {
      provider: 'jev',
      model: 'jev-1.14.0',
      answers: {
        action: { type: 'choice', value: 'x', confidence: 0.9, probabilities: action },
        line: { type: 'choice', value: 'x', confidence: 0.9, probabilities: line },
      },
    },
    error: null,
  };
}

function renderVoice(props = {}, locale = 'en') {
  window.localStorage.setItem(LOCALE_KEY, locale);
  const onTick = props.onTick ?? vi.fn(async () => true);
  const onAdd = props.onAdd ?? vi.fn(async () => ({ queued: false }));
  render(
    <I18nProvider>
      <ShoppingVoice lines={lines} online={props.online ?? true} onTick={onTick} onAdd={onAdd} />
    </I18nProvider>
  );
  return { onTick, onAdd };
}

describe('ShoppingVoice', () => {
  beforeEach(() => {
    instances = [];
    window.SpeechRecognition = FakeRecognition;
    supabase.functions.invoke.mockReset();
  });
  afterEach(() => {
    cleanup();
    delete window.SpeechRecognition;
    window.localStorage.clear();
  });

  it('sends the words with the open, unticked lines and shows cards, changing nothing yet', async () => {
    supabase.functions.invoke.mockResolvedValue(
      decision({ tick_shopping_line: 0.9, add_shopping_item: 0.1 }, { line_1: 0.95, none: 0.05 })
    );
    const { onTick, onAdd } = renderVoice();
    await userEvent.click(screen.getByRole('button', { name: /start speaking/i }));
    await say('tick off the milk');

    expect(await screen.findByRole('button', { name: 'Bought: Milk' })).toBeInTheDocument();
    const [name, { body }] = supabase.functions.invoke.mock.calls[0];
    expect(name).toBe('decide');
    expect(body.lang).toBe('en');
    expect(body.state).toBe('tick off the milk');
    expect(body.questions.line.choices.map((c) => c.value)).toEqual(['line_1', 'line_2', 'none']);
    expect(onTick).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('ticks the line Bought when its card is tapped', async () => {
    supabase.functions.invoke.mockResolvedValue(
      decision({ tick_shopping_line: 0.9 }, { line_1: 0.95 })
    );
    const { onTick } = renderVoice();
    await userEvent.click(screen.getByRole('button', { name: /start speaking/i }));
    await say('tick off the milk');
    await userEvent.click(await screen.findByRole('button', { name: 'Bought: Milk' }));
    expect(onTick).toHaveBeenCalledWith(lines[0]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Bought: Milk' })).not.toBeInTheDocument()
    );
  });

  it('adds a hand line with the spoken amount when the add card is tapped (Spanish)', async () => {
    supabase.functions.invoke.mockResolvedValue(
      decision({ add_shopping_item: 0.92, tick_shopping_line: 0.08 }, { none: 0.9, line_2: 0.1 })
    );
    const { onAdd } = renderVoice({}, 'es');
    await userEvent.click(screen.getByRole('button', { name: /hablar|habla/i }));
    await say('añade dos litros de leche');
    const card = await screen.findByRole('button', { name: 'Añadir Leche (2 litros) a la lista' });
    await userEvent.click(card);
    expect(onAdd).toHaveBeenCalledWith({
      name: 'Leche',
      foodId: null,
      grams: null,
      text: '2 litros',
    });
    expect(supabase.functions.invoke.mock.calls[0][1].body.lang).toBe('es');
  });

  it('says so when the words are not a Shopping list command', async () => {
    supabase.functions.invoke.mockResolvedValue(decision({ log_other: 0.98 }, { none: 1 }));
    renderVoice();
    await userEvent.click(screen.getByRole('button', { name: /start speaking/i }));
    await say('I ate an apple');
    expect(
      await screen.findByText(/did not sound like a Shopping list command/i)
    ).toBeInTheDocument();
  });

  it('shows the AI limit message when the cap is reached', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ code: 'AI_LIMIT_REACHED' }) } },
    });
    renderVoice();
    await userEvent.click(screen.getByRole('button', { name: /start speaking/i }));
    await say('tick off the milk');
    expect(await screen.findByRole('alert')).toHaveTextContent(/AI limit reached this month/);
  });

  it('clears the cards when the Member speaks again', async () => {
    supabase.functions.invoke.mockResolvedValue(
      decision({ tick_shopping_line: 0.9 }, { line_1: 0.95 })
    );
    renderVoice();
    await userEvent.click(screen.getByRole('button', { name: /start speaking/i }));
    await say('tick off the milk');
    await screen.findByRole('button', { name: 'Bought: Milk' });
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.queryByRole('button', { name: 'Bought: Milk' })).not.toBeInTheDocument();
  });

  it('only says voice needs a connection when offline', () => {
    renderVoice({ online: false });
    expect(screen.getByText(/need a connection/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start speaking/i })).not.toBeInTheDocument();
  });
});

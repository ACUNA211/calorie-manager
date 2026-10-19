import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import LabelForm from './LabelForm.jsx';
import { supabase } from '../lib/supabase.js';
import { MetricProvider } from '../test/metricUnits.jsx';
import recorded from '../test/recorded/read-label-oat-drink.json';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

const CODE = '036000291452';
const reading = JSON.parse(recorded.content[0].text);
delete reading.readable;

const photo = new File([new Uint8Array([1, 2, 3])], 'label.jpg', { type: 'image/jpeg' });

function renderForm() {
  const onSaved = vi.fn();
  render(<LabelForm code={CODE} onSaved={onSaved} onCancel={vi.fn()} />, {
    wrapper: MetricProvider,
  });
  return { onSaved };
}

describe('Label photo in the label form (ticket 66)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue({
      select: () => ({ maybeSingle: async () => ({ data: { household_id: 3 }, error: null }) }),
    });
    supabase.storage.from.mockReturnValue({ upload: vi.fn(async () => ({ error: null })) });
  });

  afterEach(() => {
    cleanup();
  });

  it('pre-fills the form from the recorded reading and saves nothing until Save is pressed', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: reading, error: null });
    supabase.rpc.mockResolvedValue({ data: 77, error: null });
    const { onSaved } = renderForm();

    await userEvent.upload(screen.getByLabelText('Label photo'), photo);

    await waitFor(() => expect(screen.getByLabelText('Food name')).toHaveValue('Oat drink'));
    expect(screen.getByLabelText('Serving size (g)')).toHaveValue('250');
    expect(screen.getByLabelText('Calories per serving')).toHaveValue('92');
    expect(screen.getByLabelText('Protein per serving (g)')).toHaveValue('1');
    expect(screen.getByLabelText('Carbs per serving (g)')).toHaveValue('15');
    expect(screen.getByLabelText('Fat per serving (g)')).toHaveValue('3');
    expect(screen.getByLabelText('Fibre per serving (g, optional)')).toHaveValue('');
    expect(screen.getByLabelText('Sugars per serving (g, optional)')).toHaveValue('7');
    expect(screen.getByLabelText('Sodium per serving (mg, optional)')).toHaveValue('100');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Save food' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(77));
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc.mock.calls[0][1]).toMatchObject({
      p_name: 'Oat drink',
      p_kcal_per_100g: 36.8,
    });
  });

  it('says when the AI limit is reached and leaves the form empty', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ code: 'AI_LIMIT_REACHED' }) } },
    });
    renderForm();

    await userEvent.upload(screen.getByLabelText('Label photo'), photo);

    expect(await screen.findByRole('alert')).toHaveTextContent('AI limit');
    expect(screen.getByLabelText('Food name')).toHaveValue('');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('says when the label could not be read', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ code: 'UNREADABLE' }) } },
    });
    renderForm();

    await userEvent.upload(screen.getByLabelText('Label photo'), photo);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
  });
});

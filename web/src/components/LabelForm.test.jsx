import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import LabelForm from './LabelForm.jsx';
import { supabase } from '../lib/supabase.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({
  supabase: { rpc: vi.fn() },
}));

const CODE = '036000291452';

function renderForm(props = {}) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(<LabelForm code={CODE} onSaved={onSaved} onCancel={onCancel} {...props} />, {
    wrapper: MetricProvider,
  });
  return { onSaved, onCancel };
}

async function fill(values) {
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    if (value !== '') await userEvent.type(input, value);
  }
}

// The label of one Nutrition Facts panel: name, serving 250 g, 92 kcal, macros 1, 15 and 3.
const GOOD = {
  'Food name': 'Oat drink',
  'Brand (optional)': 'Oatly',
  'Serving size (g)': '250',
  'Calories per serving': '92',
  'Protein per serving (g)': '1',
  'Carbs per serving (g)': '15',
  'Fat per serving (g)': '3',
};

describe('LabelForm (ticket 20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('saves the typed label with the barcode, converted to per 100 g', async () => {
    supabase.rpc.mockResolvedValue({ data: 77, error: null });
    const { onSaved } = renderForm();

    await fill(GOOD);
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }));

    expect(supabase.rpc).toHaveBeenCalledWith('save_label_food', {
      p_gtin: '00036000291452',
      p_name: 'Oat drink',
      p_brand: 'Oatly',
      p_serving_grams: 250,
      p_kcal_per_100g: 36.8,
      p_protein_g: 0.4,
      p_carbs_g: 6,
      p_fat_g: 1.2,
      p_fibre_g: null,
      p_sugars_g: null,
      p_sodium_mg: null,
    });
    expect(onSaved).toHaveBeenCalledWith(77);
  });

  it('shows each missing or wrong field and saves nothing', async () => {
    renderForm();

    await fill({ 'Food name': '', 'Calories per serving': 'lots' });
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }));

    const name = screen.getByLabelText('Food name').closest('div');
    expect(within(name).getByRole('alert')).toHaveTextContent('Enter a value.');
    const kcal = screen.getByLabelText('Calories per serving').closest('div');
    expect(within(kcal).getByRole('alert')).toHaveTextContent('Use numbers only');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('asks for a second press when the calories are far from the macros', async () => {
    supabase.rpc.mockResolvedValue({ data: 78, error: null });
    const { onSaved } = renderForm();

    await fill({ ...GOOD, 'Calories per serving': '300' });
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }));

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('The calories (300) are far from the 91');
    await userEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(78);
  });

  it('clears the calorie question when a value changes', async () => {
    renderForm();

    await fill({ ...GOOD, 'Calories per serving': '300' });
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }));
    expect(screen.getByRole('button', { name: 'Save anyway' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Carbs per serving (g)'), '0');
    expect(screen.queryByRole('button', { name: 'Save anyway' })).not.toBeInTheDocument();
  });

  it('says so and keeps the form when the save fails', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('down') });
    const { onSaved } = renderForm();

    await fill(GOOD);
    await userEvent.click(screen.getByRole('button', { name: 'Save food' }));

    expect(await screen.findByText('Could not save this food. Try again.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Food name')).toHaveValue('Oat drink');
  });

  it('goes back when cancelled', async () => {
    const { onCancel } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

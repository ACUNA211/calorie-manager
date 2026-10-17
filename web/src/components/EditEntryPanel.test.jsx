import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EditEntryPanel from './EditEntryPanel.jsx';
import { deleteEntry, updateEntry } from '../lib/today.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/today.js', () => ({
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));

const breakfast = { id: 1, name: 'Breakfast', time_of_day: '07:30:00' };
const dinner = { id: 2, name: 'Dinner', time_of_day: '18:30:00' };

// A logged entry at Breakfast: 60 g of toast, 500 kcal.
const toast = {
  id: 5,
  log_date: '2026-10-17',
  meal_time_id: 1,
  log_time: null,
  food_id: 3,
  description: 'Toast',
  servings: null,
  grams: 60,
  kcal: 500,
  protein_g: 12,
  carbs_g: 60,
  fat_g: 4,
  created_at: '2026-10-17T07:40:00+00:00',
};

function renderPanel(props = {}) {
  const handlers = {
    onSaved: vi.fn(),
    onDeleted: vi.fn(),
    onCancel: vi.fn(),
  };
  render(<EditEntryPanel entry={toast} meals={[breakfast, dinner]} {...handlers} {...props} />, {
    wrapper: MetricProvider,
  });
  return handlers;
}

describe('EditEntryPanel', () => {
  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the amount, the Meal Time and the entry', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Edit entry' })).toBeInTheDocument();
    expect(screen.getByText('Food: Toast')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveValue('60');
    expect(screen.getByLabelText('Meal Time')).toHaveValue('1');
  });

  it('previews the recalculated calories and macros before saving', async () => {
    const user = userEvent.setup();
    renderPanel();

    const amount = screen.getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '120');

    expect(screen.getByText('1,000 kcal')).toBeInTheDocument();
    expect(screen.getByText('Protein 24 g, carbs 120 g, fat 8 g')).toBeInTheDocument();
  });

  it('saves the new amount and hands the stored row back', async () => {
    const user = userEvent.setup();
    const saved = { ...toast, grams: 120, kcal: 1000 };
    updateEntry.mockResolvedValue(saved);
    const { onSaved } = renderPanel();

    const amount = screen.getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '120');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved, toast));
    expect(updateEntry).toHaveBeenCalledWith(expect.anything(), 5, {
      grams: 120,
      servings: null,
      kcal: 1000,
      protein_g: 24,
      carbs_g: 120,
      fat_g: 8,
      meal_time_id: 1,
      log_time: null,
    });
  });

  it('moves the entry to another time', async () => {
    const user = userEvent.setup();
    updateEntry.mockResolvedValue({ ...toast, meal_time_id: null, log_time: '08:05' });
    renderPanel();

    await user.selectOptions(screen.getByLabelText('Meal Time'), 'other');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateEntry).toHaveBeenCalledTimes(1));
    const patch = updateEntry.mock.calls[0][2];
    expect(patch).toMatchObject({ meal_time_id: null });
    expect(patch.log_time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('closes without a write when nothing changed', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it('shows an error and keeps the panel open when the save fails', async () => {
    const user = userEvent.setup();
    updateEntry.mockRejectedValue(new Error('denied'));
    const { onSaved } = renderPanel();

    const amount = screen.getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '120');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the change.');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses an amount of zero without a write', async () => {
    const user = userEvent.setup();
    renderPanel();

    const amount = screen.getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '0');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount above zero.');
    expect(updateEntry).not.toHaveBeenCalled();
  });

  it('deletes the entry and hands it back', async () => {
    const user = userEvent.setup();
    deleteEntry.mockResolvedValue(undefined);
    const { onDeleted } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Delete entry' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(toast));
    expect(deleteEntry).toHaveBeenCalledWith(expect.anything(), 5);
  });

  it('shows an error when the delete fails', async () => {
    const user = userEvent.setup();
    deleteEntry.mockRejectedValue(new Error('denied'));
    const { onDeleted } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Delete entry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the entry.');
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

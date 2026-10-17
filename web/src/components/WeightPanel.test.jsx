import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WeightPanel from './WeightPanel.jsx';
import { deleteWeight, loadWeight, saveWeight } from '../lib/weight.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/weight.js', () => ({
  loadWeight: vi.fn(),
  saveWeight: vi.fn(),
  deleteWeight: vi.fn(),
}));

// The week shown is Sunday 11 to Saturday 17 October 2026; today is the Saturday.
const WEEK_START = '2026-10-11';
const TODAY = '2026-10-17';

function renderPanel() {
  render(<WeightPanel memberId={4} weekStart={WEEK_START} todayKey={TODAY} />, {
    wrapper: I18nProvider,
  });
}

const entries = [
  { id: 1, log_date: '2026-10-11', kg: 72.5 },
  { id: 2, log_date: '2026-10-14', kg: 72.1 },
];

describe('WeightPanel', () => {
  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    loadWeight.mockResolvedValue(entries);
    saveWeight.mockResolvedValue(undefined);
    deleteWeight.mockResolvedValue(undefined);
  });

  it('loads the 12 weeks that end with the week shown, and draws the trend with its entries', async () => {
    const { container } = render(
      <WeightPanel memberId={4} weekStart={WEEK_START} todayKey={TODAY} />,
      { wrapper: I18nProvider }
    );

    expect(await screen.findByRole('img', { name: /Weight over the last 12 weeks/ })).toBeTruthy();
    // 84 days (from 26 July) plus the six days before them, for the first 7-day averages.
    expect(loadWeight).toHaveBeenCalledWith({}, 4, '2026-07-20', '2026-10-17');
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelector('path')).not.toBeNull();
    expect(screen.getByText(/Sun, Oct 11: 72\.5 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Wed, Oct 14: 72\.1 kg/)).toBeInTheDocument();
  });

  it('logs a weight for a day and reloads the log', async () => {
    renderPanel();
    await screen.findByText(/Sun, Oct 11: 72\.5 kg/);

    await userEvent.type(screen.getByLabelText('Weight (kg)'), '72.4');
    await userEvent.click(screen.getByRole('button', { name: 'Save weight' }));

    await waitFor(() => expect(saveWeight).toHaveBeenCalledWith({}, 4, TODAY, 72.4));
    expect(await screen.findByText('Weight saved.')).toBeInTheDocument();
    expect(loadWeight).toHaveBeenCalledTimes(2);
  });

  it('refuses a weight for a future day and saves nothing', async () => {
    const { container } = render(
      <WeightPanel memberId={4} weekStart={WEEK_START} todayKey={TODAY} />,
      { wrapper: I18nProvider }
    );
    await screen.findByText(/Sun, Oct 11: 72\.5 kg/);

    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: '2026-10-18' },
    });
    await userEvent.type(screen.getByLabelText('Weight (kg)'), '72');
    await userEvent.click(screen.getByRole('button', { name: 'Save weight' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A weight cannot be logged for a future day.'
    );
    expect(saveWeight).not.toHaveBeenCalled();
  });

  it('refuses text that is not a weight in kg with one decimal', async () => {
    renderPanel();
    await screen.findByText(/Sun, Oct 11: 72\.5 kg/);

    await userEvent.type(screen.getByLabelText('Weight (kg)'), '72.25');
    await userEvent.click(screen.getByRole('button', { name: 'Save weight' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a weight in kg, with one decimal at most, such as 72.5.'
    );
    expect(saveWeight).not.toHaveBeenCalled();
  });

  it('edits an entry in place and saves it for its own day', async () => {
    renderPanel();
    await screen.findByText(/Wed, Oct 14: 72\.1 kg/);

    await userEvent.click(screen.getByRole('button', { name: 'Edit the weight for Wed, Oct 14' }));
    const input = screen.getByDisplayValue('72.1');
    await userEvent.clear(input);
    await userEvent.type(input, '72.3');
    const row = input.closest('li');
    await userEvent.click(within(row).getByRole('button', { name: 'Save weight' }));

    await waitFor(() => expect(saveWeight).toHaveBeenCalledWith({}, 4, '2026-10-14', 72.3));
  });

  it('deletes an entry and reloads the log', async () => {
    renderPanel();
    await screen.findByText(/Sun, Oct 11: 72\.5 kg/);

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete the weight for Sun, Oct 11' })
    );

    await waitFor(() => expect(deleteWeight).toHaveBeenCalledWith({}, 1));
    await waitFor(() => expect(loadWeight).toHaveBeenCalledTimes(2));
  });

  it('says so when no weight is logged in the 12 weeks, and gives no chart', async () => {
    loadWeight.mockResolvedValue([]);
    renderPanel();

    expect(
      await screen.findByText('No weight logged in the last 12 weeks yet.')
    ).toBeInTheDocument();
    expect(screen.getByText('Log a weight to see the trend.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows an error when the weights cannot be loaded', async () => {
    loadWeight.mockRejectedValue(new Error('offline'));
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the weight log. Try again.'
    );
  });

  it('shows an error when a save fails', async () => {
    saveWeight.mockRejectedValue(new Error('denied'));
    renderPanel();
    await screen.findByText(/Sun, Oct 11: 72\.5 kg/);

    await userEvent.type(screen.getByLabelText('Weight (kg)'), '72');
    await userEvent.click(screen.getByRole('button', { name: 'Save weight' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save the weight. Try again.'
    );
  });
});

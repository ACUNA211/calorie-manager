import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApproverSetting from './ApproverSetting.jsx';
import { loadApprovers, setMemberCanApprove } from '../lib/approvers.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/approvers.js', () => ({
  loadApprovers: vi.fn(),
  setMemberCanApprove: vi.fn(),
}));

function renderSetting() {
  render(
    <I18nProvider>
      <ApproverSetting />
    </I18nProvider>
  );
}

describe('ApproverSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadApprovers.mockResolvedValue([
      { id: 2, name: 'Dana', allowed: true },
      { id: 3, name: 'Eve', allowed: false },
    ]);
    setMemberCanApprove.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('shows each Member with their current setting', async () => {
    renderSetting();
    expect(await screen.findByLabelText('Let Dana approve the plan')).toBeChecked();
    expect(screen.getByLabelText('Let Eve approve the plan')).not.toBeChecked();
  });

  it('allows a Member', async () => {
    renderSetting();
    await userEvent.click(await screen.findByLabelText('Let Eve approve the plan'));
    expect(setMemberCanApprove).toHaveBeenCalledWith({}, 3, true);
    await waitFor(() => expect(screen.getByLabelText('Let Eve approve the plan')).toBeChecked());
  });

  it('disallows a Member', async () => {
    renderSetting();
    await userEvent.click(await screen.findByLabelText('Let Dana approve the plan'));
    expect(setMemberCanApprove).toHaveBeenCalledWith({}, 2, false);
  });

  it('keeps the old setting and says so when saving fails', async () => {
    setMemberCanApprove.mockRejectedValue(new Error('no'));
    renderSetting();
    await userEvent.click(await screen.findByLabelText('Let Eve approve the plan'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that');
    expect(screen.getByLabelText('Let Eve approve the plan')).not.toBeChecked();
  });

  it('says so when there are no other adult Members', async () => {
    loadApprovers.mockResolvedValue([]);
    renderSetting();
    expect(await screen.findByText('No other adult Members yet.')).toBeInTheDocument();
  });
});

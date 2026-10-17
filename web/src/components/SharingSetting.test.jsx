import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SharingSetting from './SharingSetting.jsx';
import { currentUserId, loadOwnSharing, setShareEverything } from '../lib/sharing.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/sharing.js', () => ({
  currentUserId: vi.fn(),
  loadOwnSharing: vi.fn(),
  setShareEverything: vi.fn(),
}));

const LABEL = /Share everything with the other adult Members/;

function renderSetting() {
  render(<SharingSetting />, { wrapper: I18nProvider });
}

describe('SharingSetting', () => {
  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId.mockResolvedValue('alice');
    loadOwnSharing.mockResolvedValue({ memberId: 1, shareEverything: false });
    setShareEverything.mockResolvedValue();
  });

  it('is off by default, so other adults see only the flags', async () => {
    renderSetting();
    const box = await screen.findByRole('checkbox', { name: LABEL });
    expect(box).not.toBeChecked();
    expect(screen.getByText(/other adults see only whether each of your days/)).toBeInTheDocument();
  });

  it('turns the switch on through the RPC and shows it on', async () => {
    const user = userEvent.setup();
    renderSetting();
    const box = await screen.findByRole('checkbox', { name: LABEL });
    await user.click(box);
    expect(setShareEverything).toHaveBeenCalledWith({}, true);
    await waitFor(() => expect(box).toBeChecked());
  });

  it('turns the switch back off', async () => {
    loadOwnSharing.mockResolvedValue({ memberId: 1, shareEverything: true });
    const user = userEvent.setup();
    renderSetting();
    const box = await screen.findByRole('checkbox', { name: LABEL });
    expect(box).toBeChecked();
    await user.click(box);
    expect(setShareEverything).toHaveBeenCalledWith({}, false);
  });

  it('puts the switch back and says so when the change is refused', async () => {
    setShareEverything.mockRejectedValue(new Error('denied'));
    const user = userEvent.setup();
    renderSetting();
    const box = await screen.findByRole('checkbox', { name: LABEL });
    await user.click(box);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save your sharing setting'
    );
    await waitFor(() => expect(box).not.toBeChecked());
  });

  it('says so when the signed-in person has no Member', async () => {
    currentUserId.mockResolvedValue(null);
    loadOwnSharing.mockResolvedValue(null);
    renderSetting();
    expect(await screen.findByText('Join or create a Household first.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: LABEL })).not.toBeInTheDocument();
  });
});

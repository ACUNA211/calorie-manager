import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnitsSetting from './UnitsSetting.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { useActingMember } from '../lib/actingMember.jsx';
import { supabase } from '../lib/supabase.js';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../lib/actingMember.jsx', () => ({ useActingMember: vi.fn() }));

let eq;

function acting(overrides = {}) {
  return {
    actingMemberId: 7,
    actingUnits: 'us',
    refresh: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderSetting() {
  return render(
    <I18nProvider>
      <UnitsSetting />
    </I18nProvider>
  );
}

beforeEach(() => {
  eq = vi.fn(async () => ({ error: null }));
  supabase.from.mockReturnValue({ update: vi.fn(() => ({ eq })) });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UnitsSetting', () => {
  it('shows the acting Member setting, US by default', () => {
    useActingMember.mockReturnValue(acting());
    renderSetting();
    expect(screen.getByRole('combobox')).toHaveValue('us');
  });

  it('shows metric when the Member has chosen it', () => {
    useActingMember.mockReturnValue(acting({ actingUnits: 'metric' }));
    renderSetting();
    expect(screen.getByRole('combobox')).toHaveValue('metric');
  });

  it('saves the new setting on the acting Member and reloads the Household', async () => {
    const context = acting();
    useActingMember.mockReturnValue(context);
    renderSetting();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'metric');
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(supabase.from).toHaveBeenCalledWith('members');
    expect(eq).toHaveBeenCalledWith('id', 7);
    expect(context.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows an error and keeps the page when the save fails', async () => {
    eq = vi.fn(async () => ({ error: new Error('boom') }));
    supabase.from.mockReturnValue({ update: vi.fn(() => ({ eq })) });
    const context = acting();
    useActingMember.mockReturnValue(context);
    renderSetting();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'metric');
    expect(await screen.findByRole('alert')).toHaveTextContent(/units|unidades/i);
    expect(context.refresh).not.toHaveBeenCalled();
  });

  it('shows nothing while no Member is known', () => {
    useActingMember.mockReturnValue(acting({ actingMemberId: null }));
    const { container } = renderSetting();
    expect(container).toBeEmptyDOMElement();
  });
});

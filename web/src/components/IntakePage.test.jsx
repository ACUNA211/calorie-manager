import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import IntakePage from './IntakePage.jsx';
import { ActingMemberContext } from '../lib/actingMember.jsx';
import { supabase } from '../lib/supabase.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

const user = { id: 'user-1' };

// A fake client: members returns { id: 5 }; member_settings and member_intake return the rows
// given and record upserts.
function fakeClient({ settingsRow = null, intakeRow = null, upsertError = null } = {}) {
  const upserts = { member_settings: vi.fn(), member_intake: vi.fn() };
  const calls = [];
  supabase.from.mockImplementation((table) => {
    calls.push(table);
    if (table === 'members') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { id: 5 }, error: null }) }),
        }),
      };
    }
    const row = table === 'member_intake' ? intakeRow : settingsRow;
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      upsert: async (payload) => {
        upserts[table](payload);
        return { error: upsertError };
      },
    };
  });
  return { upserts, calls };
}

function renderPage(acting = {}) {
  return render(
    <ActingMemberContext.Provider
      value={{
        actingMemberId: null,
        actingName: null,
        actingIsDependent: false,
        actingUnits: 'metric',
        refresh: vi.fn(),
        ...acting,
      }}
    >
      <IntakePage user={user} />
    </ActingMemberContext.Provider>,
    { wrapper: MetricProvider }
  );
}

// A 30-year-old man, 80 kg, 180 cm, sitting, losing at 500: Calorie Target 1,636 kcal.
async function fillMan(person) {
  await person.selectOptions(screen.getByLabelText(/Sex, as the formula uses it/), 'male');
  await person.type(screen.getByLabelText('Date of birth'), '1990-01-01');
  await person.type(screen.getByLabelText('Height (cm)'), '180');
  await person.type(screen.getByLabelText(/^Weight/), '80');
  await person.selectOptions(screen.getByLabelText('Goal'), 'lose');
}

describe('IntakePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2020-01-01T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('suggests Targets from the answers and saves nothing yet', async () => {
    const person = userEvent.setup();
    const { upserts } = fakeClient();
    renderPage();
    await screen.findByLabelText('Date of birth');
    await fillMan(person);
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));

    const form = await screen.findByRole('form', { name: 'Suggested Targets' });
    expect(within(form).getByLabelText('Protein floor (g per day)')).toHaveValue('112');
    expect(upserts.member_settings).not.toHaveBeenCalled();
    expect(upserts.member_intake).not.toHaveBeenCalled();
    expect(screen.getByText(/Not saved yet/)).toBeInTheDocument();
  });

  it('shows no suggested Targets while answers are missing', async () => {
    const person = userEvent.setup();
    fakeClient();
    renderPage();
    await screen.findByLabelText('Date of birth');
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    expect(screen.queryByRole('form', { name: 'Suggested Targets' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('accepting saves the suggestion as it stands, through the Targets path, plus the answers', async () => {
    const person = userEvent.setup();
    const { upserts } = fakeClient({
      settingsRow: { calorie_target: 2000, band_low_pct: 85, band_high_pct: 100 },
    });
    renderPage();
    await screen.findByLabelText('Date of birth');
    await fillMan(person);
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    const form = await screen.findByRole('form', { name: 'Suggested Targets' });
    expect(within(form).getByLabelText('Calorie Target (kcal per day)')).toHaveValue('1636');
    await person.click(within(form).getByRole('button', { name: 'Save these Targets' }));

    await waitFor(() => expect(upserts.member_settings).toHaveBeenCalledTimes(1));
    expect(upserts.member_settings.mock.calls[0][0]).toMatchObject({
      member_id: 5,
      calorie_target: 1636,
      protein_floor_g: 112,
      carb_low_g: 184,
      carb_high_g: 266,
      fat_low_g: 45,
      fat_high_g: 64,
      band_low_pct: 85,
      band_high_pct: 100,
    });
    expect(upserts.member_intake.mock.calls[0][0]).toMatchObject({
      member_id: 5,
      sex: 'male',
      birth_date: '1990-01-01',
      height_cm: 180,
      goal: 'lose',
      pace_kcal: 500,
      floor_on: true,
      floor_kcal: null,
    });
    expect(await screen.findByText('Targets saved.')).toBeInTheDocument();
  });

  it('saves what the Member edited, not the raw suggestion', async () => {
    const person = userEvent.setup();
    const { upserts } = fakeClient();
    renderPage();
    await screen.findByLabelText('Date of birth');
    await fillMan(person);
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    const form = await screen.findByRole('form', { name: 'Suggested Targets' });
    const calories = within(form).getByLabelText('Calorie Target (kcal per day)');
    await person.clear(calories);
    await person.type(calories, '1800');
    await person.click(within(form).getByRole('button', { name: 'Save these Targets' }));

    await waitFor(() => expect(upserts.member_settings).toHaveBeenCalledTimes(1));
    expect(upserts.member_settings.mock.calls[0][0].calorie_target).toBe(1800);
  });

  it('refuses an invalid edit and saves nothing', async () => {
    const person = userEvent.setup();
    const { upserts } = fakeClient();
    renderPage();
    await screen.findByLabelText('Date of birth');
    await fillMan(person);
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    const form = await screen.findByRole('form', { name: 'Suggested Targets' });
    const calories = within(form).getByLabelText('Calorie Target (kcal per day)');
    await person.clear(calories);
    await person.type(calories, '18.5');
    await person.click(within(form).getByRole('button', { name: 'Save these Targets' }));
    expect(await within(form).findByRole('alert')).toBeInTheDocument();
    expect(upserts.member_settings).not.toHaveBeenCalled();
    expect(upserts.member_intake).not.toHaveBeenCalled();
  });

  it('clamps at the floor, and not when the floor is turned off', async () => {
    const person = userEvent.setup();
    fakeClient();
    renderPage();
    await screen.findByLabelText('Date of birth');
    await person.selectOptions(screen.getByLabelText(/Sex, as the formula uses it/), 'female');
    await person.type(screen.getByLabelText('Date of birth'), '1960-01-01');
    await person.type(screen.getByLabelText('Height (cm)'), '155');
    await person.type(screen.getByLabelText(/^Weight/), '55');
    await person.selectOptions(screen.getByLabelText('Goal'), 'lose');
    await person.selectOptions(screen.getByLabelText('Pace'), '750');
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    let form = await screen.findByRole('form', { name: 'Suggested Targets' });
    expect(within(form).getByLabelText('Calorie Target (kcal per day)')).toHaveValue('1200');

    await person.click(screen.getByLabelText('Use a suggestion floor'));
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    form = await screen.findByRole('form', { name: 'Suggested Targets' });
    expect(Number(within(form).getByLabelText('Calorie Target (kcal per day)').value)).toBeLessThan(
      1200
    );
  });

  it('uses a floor the Member typed, and saves it', async () => {
    const person = userEvent.setup();
    const { upserts } = fakeClient();
    renderPage();
    await screen.findByLabelText('Date of birth');
    await fillMan(person);
    await person.selectOptions(screen.getByLabelText('Pace'), '750');
    await person.type(screen.getByLabelText('Floor (kcal a day)'), '1450');
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    const form = await screen.findByRole('form', { name: 'Suggested Targets' });
    expect(within(form).getByLabelText('Calorie Target (kcal per day)')).toHaveValue('1450');
    await person.click(within(form).getByRole('button', { name: 'Save these Targets' }));
    await waitFor(() => expect(upserts.member_intake).toHaveBeenCalled());
    expect(upserts.member_intake.mock.calls[0][0]).toMatchObject({ floor_kcal: 1450 });
  });

  it('gives a Dependent no form and no suggestion', async () => {
    const { calls } = fakeClient();
    renderPage({ actingMemberId: 9, actingName: 'Kid', actingIsDependent: true });
    expect(await screen.findByText(/has no suggested Targets/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suggest Targets' })).not.toBeInTheDocument();
    expect(calls).not.toContain('member_intake');
  });

  it('gives no suggestion to someone under 18, to pregnancy, or to the hand-enter goal', async () => {
    const person = userEvent.setup();
    const { upserts } = fakeClient();
    renderPage();
    await screen.findByLabelText('Date of birth');
    await fillMan(person);
    await person.clear(screen.getByLabelText('Date of birth'));
    await person.type(screen.getByLabelText('Date of birth'), '2005-01-01');
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    expect(await screen.findByText(/for adults, 18 and over/)).toBeInTheDocument();

    await person.clear(screen.getByLabelText('Date of birth'));
    await person.type(screen.getByLabelText('Date of birth'), '1990-01-01');
    await person.click(screen.getByLabelText('I am pregnant or breastfeeding'));
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    expect(await screen.findByText(/during pregnancy or breastfeeding/)).toBeInTheDocument();

    await person.click(screen.getByLabelText('I am pregnant or breastfeeding'));
    await person.selectOptions(screen.getByLabelText('Goal'), 'hand');
    await person.click(screen.getByRole('button', { name: 'Suggest Targets' }));
    expect(await screen.findByText(/You chose to set Targets by hand/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Suggested Targets' })).not.toBeInTheDocument();
    expect(upserts.member_settings).not.toHaveBeenCalled();
    expect(upserts.member_intake).not.toHaveBeenCalled();
  });

  it('prefills saved answers', async () => {
    fakeClient({
      intakeRow: {
        sex: 'female',
        birth_date: '1985-03-04',
        height_cm: 165,
        work: 'heavy',
        exercise_sessions: 3,
        exercise_minutes: 40,
        goal: 'maintain',
        pace_kcal: null,
        floor_on: false,
        floor_kcal: null,
      },
    });
    renderPage();
    expect(await screen.findByLabelText('Date of birth')).toHaveValue('1985-03-04');
    expect(screen.getByLabelText('Height (cm)')).toHaveValue('165');
    expect(screen.getByLabelText('Use a suggestion floor')).not.toBeChecked();
  });

  it('shows an error when the answers cannot load', async () => {
    supabase.from.mockImplementation(() => {
      throw new Error('down');
    });
    renderPage();
    expect(await screen.findByText('Could not load your Intake.')).toBeInTheDocument();
  });
});

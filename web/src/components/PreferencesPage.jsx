import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { resolveMemberId } from '../lib/targets.js';
import {
  loadHouseholdPreferences,
  loadMemberHouseholdId,
  loadMemberPreferences,
  saveHouseholdPreferences,
  saveMemberPreferences,
} from '../lib/preferences.js';
import {
  BUDGET_FEELS,
  DIET_RULES,
  EQUIPMENT,
  FOOD_GROUPS,
  LEFTOVERS_LEVELS,
  REPEAT_FREQUENCIES,
  householdRowToForm,
  memberRowToForm,
  validateHousehold,
  validateMember,
} from '../lib/preferencesLogic.js';
import { useActingMember } from '../lib/actingMember.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import './PreferencesPage.css';

// Preferences: what the Agent plans from. Household Preferences are shared by every Member;
// Member Preferences belong to the Member being acted as ("logging for", see actingMember.jsx),
// so an adult can fill them in for a Dependent.
export default function PreferencesPage({ user }) {
  const { t } = useI18n();
  const { actingMemberId, actingName, actingIsDependent } = useActingMember();
  const requestKey = `${user.id}:${actingMemberId ?? ''}`;
  const [loaded, setLoaded] = useState({ key: null, status: 'loading' });
  const [household, setHousehold] = useState(() => householdRowToForm(null));
  const [member, setMember] = useState(() => memberRowToForm(null));

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const memberId = actingMemberId ?? (await resolveMemberId(supabase, user.id));
        if (memberId === null || memberId === undefined) throw new Error('no Member');
        const householdId = await loadMemberHouseholdId(supabase, memberId);
        if (householdId === null || householdId === undefined) throw new Error('no Household');
        const [householdRow, memberRow] = await Promise.all([
          loadHouseholdPreferences(supabase, householdId),
          loadMemberPreferences(supabase, memberId),
        ]);
        if (!active) return;
        setHousehold(householdRowToForm(householdRow));
        setMember(memberRowToForm(memberRow));
        setLoaded({ key: requestKey, status: 'ready', memberId, householdId });
      } catch {
        if (active) setLoaded({ key: requestKey, status: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [user.id, actingMemberId, requestKey]);

  const state = loaded.key === requestKey ? loaded : { status: 'loading' };
  if (state.status === 'loading') return <p>{t('preferences.loading')}</p>;
  if (state.status === 'error') return <p role="alert">{t('preferences.loadError')}</p>;

  return (
    <section className="preferences" aria-labelledby="preferences-heading">
      <h2 id="preferences-heading">{t('preferences.heading')}</h2>
      <p>{t('preferences.intro')}</p>
      <HouseholdSection householdId={state.householdId} form={household} setForm={setHousehold} />
      <MemberSection
        memberId={state.memberId}
        form={member}
        setForm={setMember}
        dependentName={actingIsDependent ? actingName : null}
      />
    </section>
  );
}

// Adds or removes one value in a list of checked choices.
const toggled = (list, value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

// Runs a save and reports the outcome as a notice: 'saved' or 'saveError'.
function useSave(save) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  async function run(values) {
    setBusy(true);
    setNotice(null);
    try {
      await save(values);
      setNotice('saved');
    } catch {
      setNotice('saveError');
    } finally {
      setBusy(false);
    }
  }
  return { busy, notice, setNotice, run };
}

function Notice({ notice, savedKey, errorKey }) {
  const { t } = useI18n();
  if (notice === 'saved') return <p role="status">{t(savedKey)}</p>;
  if (notice === 'saveError') return <p role="alert">{t(errorKey)}</p>;
  return null;
}

function FieldError({ id, errorKey }) {
  const { t } = useI18n();
  return errorKey ? (
    <p id={id} role="alert">
      {t(errorKey)}
    </p>
  ) : null;
}

function TextField({ name, labelKey, hintKey, value, error, onChange, inputMode, prefix }) {
  const { t } = useI18n();
  const errorId = `${prefix}-${name}-error`;
  return (
    <div className="preferences-field">
      <label>
        {t(labelKey)}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {hintKey && <p className="preferences-hint">{t(hintKey)}</p>}
      <FieldError id={errorId} errorKey={error} />
    </div>
  );
}

function ChoiceField({ labelKey, optionKeyPrefix, options, value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="preferences-field">
      <label>
        {t(labelKey)}
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{t('preferences.notSet')}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {t(`${optionKeyPrefix}.${option}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function CheckGroup({ legendKey, optionKeyPrefix, options, selected, onToggle }) {
  const { t } = useI18n();
  return (
    <fieldset className="preferences-checks">
      <legend>{t(legendKey)}</legend>
      {options.map((option) => (
        <label key={option} className="preferences-check">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
          />
          {t(`${optionKeyPrefix}.${option}`)}
        </label>
      ))}
    </fieldset>
  );
}

function HouseholdSection({ householdId, form, setForm }) {
  const { t } = useI18n();
  const [errors, setErrors] = useState({});
  const { busy, notice, setNotice, run } = useSave((values) =>
    saveHouseholdPreferences(supabase, householdId, values)
  );

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  };

  function handleSubmit(event) {
    event.preventDefault();
    const result = validateHousehold(form);
    setErrors(result.errors);
    if (result.ok) run(result.values);
  }

  return (
    <section aria-labelledby="preferences-household-heading">
      <h3 id="preferences-household-heading">{t('preferences.household.heading')}</h3>
      <p>{t('preferences.household.intro')}</p>
      <form onSubmit={handleSubmit} noValidate>
        <TextField
          prefix="household"
          name="cuisines"
          labelKey="preferences.household.cuisines"
          hintKey="preferences.listHint"
          value={form.cuisines}
          error={errors.cuisines}
          onChange={(value) => update('cuisines', value)}
        />
        <TextField
          prefix="household"
          name="weeknightMinutes"
          labelKey="preferences.household.weeknight"
          inputMode="numeric"
          value={form.weeknightMinutes}
          error={errors.weeknightMinutes}
          onChange={(value) => update('weeknightMinutes', value)}
        />
        <TextField
          prefix="household"
          name="weekendMinutes"
          labelKey="preferences.household.weekend"
          inputMode="numeric"
          value={form.weekendMinutes}
          error={errors.weekendMinutes}
          onChange={(value) => update('weekendMinutes', value)}
        />
        <CheckGroup
          legendKey="preferences.household.equipment"
          optionKeyPrefix="preferences.equipment"
          options={EQUIPMENT}
          selected={form.equipment}
          onToggle={(value) => update('equipment', toggled(form.equipment, value))}
        />
        <ChoiceField
          labelKey="preferences.household.repeat"
          optionKeyPrefix="preferences.repeat"
          options={REPEAT_FREQUENCIES}
          value={form.repeatFrequency}
          onChange={(value) => update('repeatFrequency', value)}
        />
        <ChoiceField
          labelKey="preferences.household.leftovers"
          optionKeyPrefix="preferences.leftovers"
          options={LEFTOVERS_LEVELS}
          value={form.leftoversTolerance}
          onChange={(value) => update('leftoversTolerance', value)}
        />
        <ChoiceField
          labelKey="preferences.household.budget"
          optionKeyPrefix="preferences.budget"
          options={BUDGET_FEELS}
          value={form.budgetFeel}
          onChange={(value) => update('budgetFeel', value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? t('preferences.saving') : t('preferences.household.save')}
        </button>
        <Notice
          notice={notice}
          savedKey="preferences.household.saved"
          errorKey="preferences.saveError"
        />
      </form>
    </section>
  );
}

function MemberSection({ memberId, form, setForm, dependentName }) {
  const { t } = useI18n();
  const [errors, setErrors] = useState({});
  const { busy, notice, setNotice, run } = useSave((values) =>
    saveMemberPreferences(supabase, memberId, values)
  );

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  };

  function handleSubmit(event) {
    event.preventDefault();
    const result = validateMember(form);
    setErrors(result.errors);
    if (result.ok) run(result.values);
  }

  return (
    <section aria-labelledby="preferences-member-heading">
      <h3 id="preferences-member-heading">{t('preferences.member.heading')}</h3>
      {dependentName && <p>{t('preferences.member.forDependent', { name: dependentName })}</p>}
      <p>{t('preferences.member.intro')}</p>
      <form onSubmit={handleSubmit} noValidate>
        <TextField
          prefix="member"
          name="favourites"
          labelKey="preferences.member.favourites"
          hintKey="preferences.listHint"
          value={form.favourites}
          error={errors.favourites}
          onChange={(value) => update('favourites', value)}
        />
        <TextField
          prefix="member"
          name="dislikes"
          labelKey="preferences.member.dislikes"
          hintKey="preferences.listHint"
          value={form.dislikes}
          error={errors.dislikes}
          onChange={(value) => update('dislikes', value)}
        />
        <h4>{t('preferences.hard.heading')}</h4>
        <p>{t('preferences.hard.intro')}</p>
        <TextField
          prefix="member"
          name="hardFoods"
          labelKey="preferences.hard.foods"
          hintKey="preferences.listHint"
          value={form.hardFoods}
          error={errors.hardFoods}
          onChange={(value) => update('hardFoods', value)}
        />
        <CheckGroup
          legendKey="preferences.hard.groups"
          optionKeyPrefix="preferences.groups"
          options={FOOD_GROUPS}
          selected={form.hardFoodGroups}
          onToggle={(value) => update('hardFoodGroups', toggled(form.hardFoodGroups, value))}
        />
        <CheckGroup
          legendKey="preferences.hard.diets"
          optionKeyPrefix="preferences.diets"
          options={DIET_RULES}
          selected={form.hardDiets}
          onToggle={(value) => update('hardDiets', toggled(form.hardDiets, value))}
        />
        <button type="submit" disabled={busy}>
          {busy ? t('preferences.saving') : t('preferences.member.save')}
        </button>
        <Notice
          notice={notice}
          savedKey="preferences.member.saved"
          errorKey="preferences.saveError"
        />
      </form>
    </section>
  );
}

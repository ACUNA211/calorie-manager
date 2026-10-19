import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadIntake, saveIntake } from '../lib/intake.js';
import {
  DEFAULT_PACE,
  PACES,
  ageOn,
  floorFor,
  heightFields,
  parseCount,
  parseHeight,
  suggestTargets,
} from '../lib/intakeLogic.js';
import {
  loadTargets,
  resolveMemberId,
  rowToForm,
  saveTargets,
  validateTargets,
} from '../lib/targets.js';
import { useActingMember } from '../lib/actingMember.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { formatNumber } from '../i18n/format.js';
import { useUnits } from '../lib/useUnits.jsx';
import { normalizeUnits } from '../lib/units.js';
import UnitsSetting from './UnitsSetting.jsx';
import './IntakePage.css';

const todayKey = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

function answersFromRow(row, units) {
  const height = heightFields(row?.height_cm, units);
  return {
    sex: row?.sex ?? '',
    birthDate: row?.birth_date ?? '',
    ...height,
    weight: '',
    work: row?.work ?? 'sitting',
    sessions:
      row?.exercise_sessions === null || row?.exercise_sessions === undefined
        ? ''
        : String(row.exercise_sessions),
    minutes:
      row?.exercise_minutes === null || row?.exercise_minutes === undefined
        ? ''
        : String(row.exercise_minutes),
    goal: row?.goal ?? '',
    pace: String(row?.pace_kcal ?? DEFAULT_PACE),
    pregnant: false,
    floorOn: row ? row.floor_on !== false : true,
    floorKcal: row?.floor_kcal ? String(row.floor_kcal) : '',
  };
}

const TARGET_FIELDS = [
  ['calorieTarget', 'intake.targets.calorie'],
  ['proteinFloor', 'intake.targets.protein'],
  ['carbLow', 'intake.targets.carbLow'],
  ['carbHigh', 'intake.targets.carbHigh'],
  ['fatLow', 'intake.targets.fatLow'],
  ['fatHigh', 'intake.targets.fatHigh'],
];

// The Intake form: a Member answers, the app suggests Targets, and nothing is saved until the
// Member accepts (or edits, then saves) them. The Member is the one being acted as; a
// Dependent gets no suggestion.
export default function IntakePage({ user }) {
  const { t, locale } = useI18n();
  const { actingMemberId, actingName, actingIsDependent } = useActingMember();
  const units = useUnits();
  const system = normalizeUnits(units.units);
  const requestKey = `${user.id}:${actingMemberId ?? ''}`;
  const [loaded, setLoaded] = useState({ key: null, status: 'loading', memberId: null });
  const [answers, setAnswers] = useState(() => answersFromRow(null, system));
  const [targetsRow, setTargetsRow] = useState(null);
  const [errors, setErrors] = useState({});
  const [suggestion, setSuggestion] = useState(null);
  const [targetForm, setTargetForm] = useState(null);
  const [targetErrors, setTargetErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (actingIsDependent) return undefined;
    let active = true;
    (async () => {
      try {
        const id = actingMemberId ?? (await resolveMemberId(supabase, user.id));
        if (id === null || id === undefined) throw new Error('no Member');
        const [intakeRow, targets] = await Promise.all([
          loadIntake(supabase, id),
          loadTargets(supabase, id),
        ]);
        if (!active) return;
        setAnswers(answersFromRow(intakeRow, system));
        setTargetsRow(targets);
        setSuggestion(null);
        setTargetForm(null);
        setErrors({});
        setNotice(null);
        setLoaded({ key: requestKey, status: 'ready', memberId: id });
      } catch {
        if (active) setLoaded({ key: requestKey, status: 'error', memberId: null });
      }
    })();
    return () => {
      active = false;
    };
    // The units are read once per load: switching units later keeps what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, actingMemberId, actingIsDependent, requestKey]);

  const state = loaded.key === requestKey ? loaded : { status: 'loading', memberId: null };

  function setAnswer(name, value) {
    setAnswers((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setNotice(null);
  }

  // Reads and checks the answers. Returns { ok, values, input, errors }.
  function readAnswers() {
    const found = {};
    const age = ageOn(answers.birthDate, todayKey());
    if (age === null) found.birthDate = 'intake.errors.birthDate';
    if (!answers.sex) found.sex = 'intake.errors.sex';
    const height = parseHeight(system, answers);
    if (!height.ok) found.height = height.error;
    const weight = units.parseWeight(answers.weight);
    if (!weight.ok) found.weight = weight.error;
    if (!answers.goal) found.goal = 'intake.errors.goal';
    const sessions = parseCount(answers.sessions, 0, 21, 'intake.errors.sessions');
    if (!sessions.ok) found.sessions = sessions.error;
    const minutes = parseCount(answers.minutes, 0, 600, 'intake.errors.minutes');
    if (!minutes.ok) found.minutes = minutes.error;
    const floor = parseCount(answers.floorKcal, 500, 5000, 'intake.errors.floor');
    if (answers.floorOn && !floor.ok) found.floorKcal = floor.error;
    if (Object.keys(found).length > 0) return { ok: false, errors: found };

    const floorKcal = answers.floorOn ? floor.value : null;
    return {
      ok: true,
      values: {
        sex: answers.sex,
        birth_date: answers.birthDate,
        height_cm: height.cm,
        work: answers.work,
        exercise_sessions: sessions.value,
        exercise_minutes: minutes.value,
        goal: answers.goal,
        pace_kcal: answers.goal === 'lose' ? Number(answers.pace) : null,
        floor_on: answers.floorOn,
        floor_kcal: floorKcal,
      },
      input: {
        sex: answers.sex,
        age,
        cm: height.cm,
        kg: weight.value,
        work: answers.work,
        sessions: sessions.value,
        minutes: minutes.value,
        goal: answers.goal,
        pace: Number(answers.pace),
        floorOn: answers.floorOn,
        floorKcal,
      },
    };
  }

  // "Suggest": works the numbers and shows them. Saves nothing.
  function handleSuggest(event) {
    event.preventDefault();
    setNotice(null);
    setTargetErrors({});
    if (answers.goal === 'hand' || answers.pregnant) {
      setErrors({});
      setSuggestion({ ok: false, reason: answers.pregnant ? 'pregnant' : 'hand' });
      setTargetForm(null);
      return;
    }
    const read = readAnswers();
    setErrors(read.ok ? {} : read.errors);
    if (!read.ok) {
      setSuggestion(null);
      setTargetForm(null);
      return;
    }
    const result = suggestTargets({ ...read.input, isDependent: false });
    setSuggestion(result);
    if (!result.ok) {
      setTargetForm(null);
      return;
    }
    setTargetForm({
      calorieTarget: String(result.calorieTarget),
      proteinFloor: String(result.proteinFloorG),
      carbLow: String(result.carbLowG),
      carbHigh: String(result.carbHighG),
      fatLow: String(result.fatLowG),
      fatHigh: String(result.fatHighG),
    });
  }

  function updateTarget(name, value) {
    setTargetForm((current) => ({ ...current, [name]: value }));
    setTargetErrors((current) => ({ ...current, [name]: undefined }));
    setNotice(null);
  }

  // "Save these Targets": the Member accepts the suggestion as it is, or edits first. The
  // Targets go through the same validation and save as Targets by hand.
  async function handleSave(event) {
    event.preventDefault();
    setNotice(null);
    const merged = { ...rowToForm(targetsRow), ...targetForm };
    const result = validateTargets(merged);
    const problems = {};
    for (const [name] of TARGET_FIELDS)
      if (result.errors[name]) problems[name] = result.errors[name];
    setTargetErrors(problems);
    if (!result.ok) return;
    const read = readAnswers();
    if (!read.ok) {
      setErrors(read.errors);
      return;
    }

    setBusy(true);
    try {
      await saveTargets(supabase, state.memberId, result.values);
      await saveIntake(supabase, state.memberId, read.values);
      setTargetsRow({ ...(targetsRow ?? {}), ...result.values });
      setNotice('saved');
    } catch {
      setNotice('saveError');
    } finally {
      setBusy(false);
    }
  }

  if (actingIsDependent) {
    return (
      <section aria-labelledby="intake-heading">
        <h2 id="intake-heading">{t('intake.heading')}</h2>
        <p>{t('intake.dependent', { name: actingName })}</p>
      </section>
    );
  }
  if (state.status === 'loading') return <p>{t('intake.loading')}</p>;
  if (state.status === 'error') return <p role="alert">{t('intake.loadError')}</p>;

  const fieldError = (name) =>
    errors[name] ? (
      <p id={`intake-${name}-error`} role="alert" className="intake-error">
        {t(errors[name])}
      </p>
    ) : null;
  const describedBy = (name) => (errors[name] ? `intake-${name}-error` : undefined);

  const textField = (name, labelKey, extra = {}) => (
    <div className="intake-field">
      <label>
        {t(labelKey, extra.params)}
        <input
          type="text"
          inputMode={extra.inputMode ?? 'text'}
          value={answers[name]}
          aria-invalid={errors[name] ? 'true' : 'false'}
          aria-describedby={describedBy(name)}
          onChange={(event) => setAnswer(name, event.target.value)}
        />
      </label>
      {fieldError(name)}
    </div>
  );

  const heightError = errors.height ? (
    <p id="intake-height-error" role="alert" className="intake-error">
      {t(errors.height)}
    </p>
  ) : null;

  const floorNow =
    suggestion && suggestion.ok
      ? suggestion.floor
      : floorFor({ sex: answers.sex, floorOn: answers.floorOn });

  return (
    <section aria-labelledby="intake-heading" className="intake">
      <h2 id="intake-heading">{t('intake.heading')}</h2>
      <p>{t('intake.intro')}</p>
      <UnitsSetting />

      <form onSubmit={handleSuggest} noValidate aria-label={t('intake.formLabel')}>
        <div className="intake-field">
          <label>
            {t('intake.sex.label')}
            <select
              value={answers.sex}
              aria-invalid={errors.sex ? 'true' : 'false'}
              aria-describedby={describedBy('sex')}
              onChange={(event) => setAnswer('sex', event.target.value)}
            >
              <option value="">{t('intake.choose')}</option>
              <option value="female">{t('intake.sex.female')}</option>
              <option value="male">{t('intake.sex.male')}</option>
            </select>
          </label>
          <p className="intake-hint">{t('intake.sex.hint')}</p>
          {fieldError('sex')}
        </div>

        <div className="intake-field">
          <label>
            {t('intake.birthDate')}
            <input
              type="date"
              value={answers.birthDate}
              aria-invalid={errors.birthDate ? 'true' : 'false'}
              aria-describedby={describedBy('birthDate')}
              onChange={(event) => setAnswer('birthDate', event.target.value)}
            />
          </label>
          {fieldError('birthDate')}
        </div>

        {system === 'metric' ? (
          textField('cm', 'intake.height.cm', { inputMode: 'decimal' })
        ) : (
          <div className="intake-row">
            {textField('feet', 'intake.height.feet', { inputMode: 'numeric' })}
            {textField('inches', 'intake.height.inches', { inputMode: 'decimal' })}
          </div>
        )}
        {heightError}

        {textField('weight', 'intake.weight', {
          inputMode: 'decimal',
          params: { unit: units.weightUnit },
        })}

        <div className="intake-field">
          <label>
            {t('intake.work.label')}
            <select
              value={answers.work}
              onChange={(event) => setAnswer('work', event.target.value)}
            >
              <option value="sitting">{t('intake.work.sitting')}</option>
              <option value="on_feet">{t('intake.work.on_feet')}</option>
              <option value="heavy">{t('intake.work.heavy')}</option>
            </select>
          </label>
        </div>

        <fieldset className="intake-fieldset">
          <legend>{t('intake.exercise.legend')}</legend>
          <p className="intake-hint">{t('intake.exercise.hint')}</p>
          <div className="intake-row">
            {textField('sessions', 'intake.exercise.sessions', { inputMode: 'numeric' })}
            {textField('minutes', 'intake.exercise.minutes', { inputMode: 'numeric' })}
          </div>
        </fieldset>

        <div className="intake-field">
          <label>
            {t('intake.goal.label')}
            <select
              value={answers.goal}
              aria-invalid={errors.goal ? 'true' : 'false'}
              aria-describedby={describedBy('goal')}
              onChange={(event) => setAnswer('goal', event.target.value)}
            >
              <option value="">{t('intake.choose')}</option>
              <option value="lose">{t('intake.goal.lose')}</option>
              <option value="maintain">{t('intake.goal.maintain')}</option>
              <option value="hand">{t('intake.goal.hand')}</option>
            </select>
          </label>
          {fieldError('goal')}
        </div>

        {answers.goal === 'lose' && (
          <div className="intake-field">
            <label>
              {t('intake.pace.label')}
              <select
                value={answers.pace}
                onChange={(event) => setAnswer('pace', event.target.value)}
              >
                {PACES.map((pace) => (
                  <option key={pace} value={String(pace)}>
                    {t('intake.pace.option', { kcal: formatNumber(pace, locale) })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="intake-field">
          <label className="intake-check">
            <input
              type="checkbox"
              checked={answers.pregnant}
              onChange={(event) => setAnswer('pregnant', event.target.checked)}
            />
            {t('intake.pregnant')}
          </label>
        </div>

        <fieldset className="intake-fieldset">
          <legend>{t('intake.floor.legend')}</legend>
          <p className="intake-hint">{t('intake.floor.hint')}</p>
          <label className="intake-check">
            <input
              type="checkbox"
              checked={answers.floorOn}
              onChange={(event) => setAnswer('floorOn', event.target.checked)}
            />
            {t('intake.floor.on')}
          </label>
          {answers.floorOn && (
            <>
              {textField('floorKcal', 'intake.floor.kcal', { inputMode: 'numeric' })}
              {answers.floorKcal.trim() === '' && floorNow !== null && (
                <p className="intake-hint">
                  {t('intake.floor.default', { kcal: formatNumber(floorNow, locale) })}
                </p>
              )}
            </>
          )}
        </fieldset>

        <button type="submit">{t('intake.suggestButton')}</button>
      </form>

      {suggestion && !suggestion.ok && (
        <p role="status">{t(`intake.noSuggestion.${suggestion.reason}`)}</p>
      )}

      {suggestion && suggestion.ok && targetForm && (
        <form onSubmit={handleSave} noValidate aria-label={t('intake.targets.formLabel')}>
          <h3>{t('intake.targets.heading')}</h3>
          <p>
            {t('intake.targets.explain', {
              rmr: formatNumber(suggestion.rmr, locale),
              tdee: formatNumber(suggestion.tdee, locale),
              deficit: formatNumber(suggestion.deficit, locale),
            })}
          </p>
          <p className="intake-hint">{t('intake.targets.notSaved')}</p>
          {TARGET_FIELDS.map(([name, labelKey]) => (
            <div className="intake-field" key={name}>
              <label>
                {t(labelKey)}
                <input
                  type="text"
                  inputMode="numeric"
                  value={targetForm[name]}
                  aria-invalid={targetErrors[name] ? 'true' : 'false'}
                  onChange={(event) => updateTarget(name, event.target.value)}
                />
              </label>
              {targetErrors[name] && (
                <p role="alert" className="intake-error">
                  {t(targetErrors[name])}
                </p>
              )}
            </div>
          ))}
          <button type="submit" disabled={busy}>
            {busy ? t('intake.targets.saving') : t('intake.targets.saveButton')}
          </button>
          {notice === 'saved' && <p role="status">{t('intake.targets.saved')}</p>}
          {notice === 'saveError' && <p role="alert">{t('intake.targets.saveError')}</p>}
        </form>
      )}
    </section>
  );
}

import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { lookupGtin } from '../lib/foods.js';
import { libraryFoodFor } from '../lib/today.js';
import { normalizeTime } from '../lib/mealTimesLogic.js';
import {
  amountToGrams,
  defaultMealTimeId,
  entryNutrition,
  MAX_LOG_GRAMS,
  OTHER_TIME,
} from '../lib/todayLogic.js';
import {
  addOnePackage,
  addPackageWithWeight,
  canActOnScan,
  defaultEatenAmount,
  eatenRow,
  eatFood,
  packageToAdd,
} from '../lib/todayScan.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import ScanPanel from './ScanPanel.jsx';

// Scan on Today (ticket #27). A scanned food is shown with two buttons: Add to Pantry adds one
// package at its label weight (asking once for the weight when it is unknown), and Eaten logs
// it at a Meal Time with an amount picker and takes that amount off the Pantry. onEaten gets
// the stored entry and its undo, so the Today page can show one toast with Undo for both.
// Open Food Facts results are shown with both buttons disabled (ticket #85).
//
// State: scan is null (closed) or { phase, code, food, attempt }. Phases: camera, looking,
// notFound, error, found, offOnly, askWeight. `run` counts opens and lookups, so a late answer
// from a closed or replaced scan is dropped.
export default function TodayScan({
  memberId,
  logDate,
  todayKey,
  meals,
  weekday,
  online,
  onEaten,
}) {
  const { t, formatNumber } = useI18n();
  const number = (value, digits = 0) => formatNumber(value, { maximumFractionDigits: digits });
  const [scan, setScan] = useState(null);
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState('servings');
  const [mealChoice, setMealChoice] = useState(OTHER_TIME);
  const [weightText, setWeightText] = useState('');
  const [weightError, setWeightError] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  function close() {
    run.current += 1;
    setScan(null);
    setStatus(null);
    setWeightText('');
    setWeightError(null);
    setBusy(false);
  }

  function openCamera() {
    run.current += 1;
    setStatus(null);
    setWeightError(null);
    setScan({ phase: 'camera', attempt: run.current });
  }

  // Shows a found food with the Eaten picker set to one serving and the nearest Meal Time.
  function showFood(food, code) {
    const start = defaultEatenAmount(food);
    const nearest = defaultMealTimeId(meals, weekday, new Date());
    setAmount(start.amount);
    setUnit(start.unit);
    setMealChoice(nearest == null ? OTHER_TIME : String(nearest));
    setScan({ phase: 'found', code, food });
  }

  // Looks the code up: the Food Library first, then USDA (inside usda_lookup_gtin), then
  // Open Food Facts. A USDA food is saved to the Food Library on the way, as Log food does.
  async function lookUp(code) {
    run.current += 1;
    const token = run.current;
    setStatus(null);
    setScan({ phase: 'looking', code });

    let outcome;
    try {
      outcome = await lookupGtin(supabase, code);
    } catch {
      if (token === run.current) setScan({ phase: 'error', code });
      return;
    }
    if (token !== run.current) return;
    if (outcome.status !== 'found') {
      setScan({ phase: 'notFound', code });
      return;
    }
    if (!canActOnScan(outcome)) {
      setScan({ phase: 'offOnly', code, name: outcome.result.name });
      return;
    }

    let food;
    try {
      food = await libraryFoodFor(supabase, outcome.result);
    } catch {
      if (token === run.current) setScan({ phase: 'error', code });
      return;
    }
    if (token !== run.current) return;
    showFood(food, code);
  }

  async function handleAddToPantry() {
    if (busy || scan?.phase !== 'found') return;
    const { food, code } = scan;
    const token = run.current;
    setBusy(true);
    setStatus(null);
    try {
      const pkg = await packageToAdd(supabase, food.id);
      if (token !== run.current) return;
      if (pkg.grams === null) {
        setWeightText('');
        setWeightError(null);
        setScan({ phase: 'askWeight', code, food });
        return;
      }
      const grams = await addOnePackage(supabase, food.id, pkg.grams);
      setStatus({
        kind: 'ok',
        text: t('today.scan.pantryAdded', { name: food.name, grams: number(grams, 1) }),
      });
    } catch {
      if (token === run.current) setStatus({ kind: 'error', text: t('today.scan.pantryError') });
    } finally {
      if (token === run.current) setBusy(false);
    }
  }

  // The weight the Household types once for a food with no known package weight. It is saved
  // on the food, so the next scan adds without asking.
  async function handleSaveWeight(event) {
    event.preventDefault();
    if (busy || scan?.phase !== 'askWeight') return;
    const { food, code } = scan;
    const token = run.current;
    setBusy(true);
    try {
      const saved = await addPackageWithWeight(supabase, food.id, weightText);
      if (token !== run.current) return;
      if (!saved.ok) {
        setWeightError(saved.error);
        return;
      }
      setStatus({
        kind: 'ok',
        text: t('today.scan.pantryAdded', { name: food.name, grams: number(saved.grams, 1) }),
      });
      setScan({ phase: 'found', code, food });
    } catch {
      if (token === run.current) setStatus({ kind: 'error', text: t('today.scan.pantryError') });
    } finally {
      if (token === run.current) setBusy(false);
    }
  }

  async function handleEaten(event) {
    event.preventDefault();
    if (busy || scan?.phase !== 'found') return;
    const { food } = scan;
    const built = eatenRow({
      memberId,
      logDate,
      todayKey,
      food,
      amount,
      unit,
      mealChoice,
      now: new Date(),
    });
    if (!built.ok) {
      setStatus({ kind: 'error', text: t(built.error, { max: MAX_LOG_GRAMS }) });
      return;
    }
    const token = run.current;
    setBusy(true);
    setStatus(null);
    try {
      const eaten = await eatFood(supabase, {
        row: built.row,
        foodId: food.id,
        grams: built.grams,
      });
      const meal = meals.find(
        (candidate) => Number(candidate.id) === Number(built.row.meal_time_id)
      );
      onEaten({
        entry: eaten.entry,
        undo: eaten.undo,
        taken: eaten.taken,
        pantryFailed: eaten.pantryFailed,
        meal: meal ? meal.name : null,
      });
      close();
    } catch {
      if (token === run.current) setStatus({ kind: 'error', text: t('today.scan.eatError') });
    } finally {
      if (token === run.current) setBusy(false);
    }
  }

  // A found food: its name, Add to Pantry, and the Eaten form (amount, unit, Meal Time).
  function renderFound(food) {
    const parsed = amountToGrams({ amount, unit, servingGrams: food.servingGrams });
    const nutrition = parsed.ok ? entryNutrition(food, parsed.grams) : null;
    return (
      <>
        <p>{t('today.log.selected', { name: food.name })}</p>
        <div>
          <button type="button" disabled={busy || !online} onClick={handleAddToPantry}>
            {busy ? t('today.scan.adding') : t('today.scan.addToPantry')}
          </button>
        </div>
        <form onSubmit={handleEaten}>
          <label>
            {t('today.log.amount')}{' '}
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>{' '}
          {food.servingGrams > 0 ? (
            <label>
              {t('today.log.unit')}{' '}
              <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                <option value="grams">{t('today.log.unitGrams')}</option>
                <option value="servings">{t('today.log.unitServings')}</option>
              </select>
            </label>
          ) : null}
          <p>
            <label>
              {t('today.log.mealTime')}{' '}
              <select value={mealChoice} onChange={(event) => setMealChoice(event.target.value)}>
                {meals.map((meal) => (
                  <option key={meal.id} value={String(meal.id)}>
                    {t('today.log.mealOption', {
                      name: meal.name,
                      time: normalizeTime(meal.time_of_day),
                    })}
                  </option>
                ))}
                <option value={OTHER_TIME}>{t('today.otherTime')}</option>
              </select>
            </label>
          </p>
          {nutrition && nutrition.kcal != null ? (
            <p>{t('today.log.preview', { kcal: number(nutrition.kcal) })}</p>
          ) : null}
          <button type="submit" disabled={busy || !online}>
            {busy ? t('today.scan.saving') : t('today.scan.eatenButton')}
          </button>
        </form>
        <ScanActions onAgain={openCamera} onClose={close} />
      </>
    );
  }

  // The scan area: the camera, then the state of the lookup, each with a way out.
  function renderScan() {
    if (scan.phase === 'camera') {
      return <ScanPanel key={scan.attempt} onCode={lookUp} onCancel={close} onSearch={close} />;
    }
    if (scan.phase === 'looking') {
      return <p role="status">{t('today.scan.looking', { code: scan.code })}</p>;
    }
    if (scan.phase === 'notFound') {
      return (
        <>
          <p role="status">{t('today.scan.notFound', { code: scan.code })}</p>
          <ScanActions onAgain={openCamera} onClose={close} />
        </>
      );
    }
    if (scan.phase === 'error') {
      return (
        <>
          <p role="alert">{t('today.scan.error')}</p>
          <ScanActions onAgain={openCamera} onClose={close} />
        </>
      );
    }
    if (scan.phase === 'offOnly') {
      return (
        <>
          <p>{t('today.scan.offOnly', { name: scan.name })}</p>
          <button type="button" disabled>
            {t('today.scan.addToPantry')}
          </button>{' '}
          <button type="button" disabled>
            {t('today.scan.eatenButton')}
          </button>
          <ScanActions onAgain={openCamera} onClose={close} />
        </>
      );
    }
    if (scan.phase === 'askWeight') {
      return (
        <form onSubmit={handleSaveWeight}>
          <p role="status">{t('today.scan.askWeight', { name: scan.food.name })}</p>
          <label>
            {t('today.scan.weightLabel')}{' '}
            <input
              type="text"
              inputMode="decimal"
              value={weightText}
              onChange={(event) => setWeightText(event.target.value)}
            />
          </label>{' '}
          <button type="submit" disabled={busy}>
            {busy ? t('today.scan.saving') : t('today.scan.weightSave')}
          </button>{' '}
          <button type="button" disabled={busy} onClick={close}>
            {t('today.scan.close')}
          </button>
          {weightError ? <p role="alert">{t(weightError)}</p> : null}
        </form>
      );
    }
    return renderFound(scan.food);
  }

  return (
    <section aria-labelledby="today-scan-heading">
      <h3 id="today-scan-heading">{t('today.scan.heading')}</h3>
      {!online ? <p>{t('today.scan.needsConnection')}</p> : null}
      {scan === null ? (
        <button type="button" disabled={!online} onClick={openCamera}>
          {t('today.scan.button')}
        </button>
      ) : (
        renderScan()
      )}
      {status ? <p role={status.kind === 'error' ? 'alert' : 'status'}>{status.text}</p> : null}
    </section>
  );
}

// Scan again and Close, shown under the result of a lookup.
function ScanActions({ onAgain, onClose }) {
  const { t } = useI18n();
  return (
    <p>
      <button type="button" onClick={onAgain}>
        {t('today.scan.again')}
      </button>{' '}
      <button type="button" onClick={onClose}>
        {t('today.scan.close')}
      </button>
    </p>
  );
}

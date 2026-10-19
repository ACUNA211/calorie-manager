import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { lookupGtin } from '../lib/foods.js';
import { addToPantry, foodIdFor, loadFoodPackage, setPackageGrams } from '../lib/pantry.js';
import { packageGrams, validateAddAmount } from '../lib/pantryLogic.js';
import { scanPlan } from '../lib/shoppingScan.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';
import LabelForm from './LabelForm.jsx';
import OffCredit from './OffCredit.jsx';
import ScanPanel from './ScanPanel.jsx';

// Scan on the Shopping list (ticket #49). The barcode goes through the same lookups as the Foods
// screen (tickets 18 to 20). A food with an open line ticks it Bought with the real package weight
// instead of the planned amount (`onTick`, the page's one tick call). A food with no open line
// asks to be added to the Pantry, and is added with a note that it was not on the list. When the
// package weight is unknown, the app asks once and remembers it on the food (as ticket 26 does).
//
// `lines` is the list on screen; `onTick(line, grams)` ticks and resolves true when the tick was
// made or kept on the phone. State is null (closed) or { phase, ... }. Phases: camera, looking,
// notFound, label, offOnly, error, askWeight, savingWeight, offer, adding, ticking, done.
// `run` counts opens and closes, so a late answer from a closed scan is dropped.
export default function ShoppingScan({ lines, online = true, onTick }) {
  const { t } = useI18n();
  const units = useUnits();
  const [scan, setScan] = useState(null);
  const [weightText, setWeightText] = useState('');
  const [weightError, setWeightError] = useState(null);
  const run = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function reset() {
    setWeightText('');
    setWeightError(null);
  }

  function openCamera() {
    run.current += 1;
    reset();
    setScan((current) => ({ phase: 'camera', attempt: (current?.attempt ?? 0) + 1 }));
  }

  function closeScan() {
    run.current += 1;
    reset();
    setScan(null);
  }

  // Ticks the line with the real package weight.
  async function tickWith(token, line, name, grams) {
    setScan({ phase: 'ticking' });
    const ok = await onTick(line, grams);
    if (!alive.current || token !== run.current) return;
    setScan(
      ok ? { phase: 'done', text: 'ticked', name, grams } : { phase: 'error', tickError: true }
    );
  }

  // Adds one package to the Pantry; the confirmation notes that it was not on the list.
  async function addPackage(token, foodId, name, grams) {
    setScan({ phase: 'adding' });
    try {
      await addToPantry(supabase, foodId, grams);
    } catch {
      if (alive.current && token === run.current) setScan({ phase: 'error', addError: true });
      return;
    }
    if (!alive.current || token !== run.current) return;
    setScan({ phase: 'done', text: 'pantry', name, grams });
  }

  // With the weight known, do what the scan was for: tick the line or add to the Pantry.
  async function finish(token, step) {
    if (step.line) await tickWith(token, step.line, step.name, step.grams);
    else await addPackage(token, step.foodId, step.name, step.grams);
  }

  async function lookUp(code) {
    run.current += 1;
    const token = run.current;
    setScan({ phase: 'looking', code });

    let outcome;
    try {
      outcome = await lookupGtin(supabase, code);
    } catch {
      if (alive.current && token === run.current) setScan({ phase: 'error', code });
      return;
    }
    if (!alive.current || token !== run.current) return;
    if (outcome.status !== 'found') {
      setScan({ phase: 'notFound', code, offStatus: outcome.offStatus ?? null });
      return;
    }
    // An Open Food Facts food is not in the Food Library yet, so it can't be ticked or stored.
    if (outcome.result.source === 'off') {
      setScan({ phase: 'offOnly', code, name: outcome.result.name });
      return;
    }

    let food;
    try {
      food = await loadFoodPackage(supabase, await foodIdFor(supabase, outcome.result));
    } catch {
      if (alive.current && token === run.current) setScan({ phase: 'error', code });
      return;
    }
    if (!alive.current || token !== run.current) return;

    const plan = scanPlan(lines, food.id);
    const grams = packageGrams(food);
    const step = {
      line: plan.kind === 'tick' ? plan.line : null,
      foodId: food.id,
      name: food.name,
    };
    if (plan.kind === 'offer') {
      setScan({ phase: 'offer', step, grams, alreadyTicked: plan.alreadyTicked });
      return;
    }
    if (grams === null) {
      setScan({ phase: 'askWeight', step });
      return;
    }
    if (step.line) await tickWith(token, step.line, step.name, grams);
    else await addPackage(token, step.foodId, step.name, grams);
  }

  // A label typed in and saved (ticket 20): the code is looked up again, so the food now shows as a
  // Food Library food.
  function handleLabelSaved() {
    lookUp(scan.code);
  }

  // The user agrees to add an off-list product to the Pantry.
  async function acceptOffer() {
    const { step, grams } = scan;
    if (grams === null) {
      setScan({ phase: 'askWeight', step });
      return;
    }
    await finish(run.current, { ...step, grams });
  }

  // The weight typed once for a food with no known package weight; saved on the food.
  async function saveWeight(event) {
    event.preventDefault();
    const parsed = validateAddAmount(weightText, units.units);
    if (!parsed.ok) {
      setWeightError(parsed.error);
      return;
    }
    const token = run.current;
    const { step } = scan;
    setScan({ phase: 'savingWeight', step });
    try {
      await setPackageGrams(supabase, step.foodId, parsed.value);
    } catch {
      if (alive.current && token === run.current) {
        setScan({ phase: 'askWeight', step });
        setWeightError('shopping.scan.weightError');
      }
      return;
    }
    await finish(token, { ...step, grams: parsed.value });
  }

  function renderWeightForm() {
    const busy = scan.phase === 'savingWeight';
    const { name } = scan.step;
    return (
      <form onSubmit={saveWeight}>
        <p role="status">{t('shopping.scan.askWeight', { name })}</p>
        <label>
          {t('shopping.scan.weightLabel', { name, unit: units.massUnit })}
          <input
            type="text"
            inputMode="decimal"
            value={weightText}
            onChange={(event) => setWeightText(event.target.value)}
          />
        </label>
        <div className="actions">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? t('shopping.scan.weightSaving') : t('shopping.scan.weightSave')}
          </button>
          <button type="button" disabled={busy} onClick={closeScan}>
            {t('shopping.scan.cancel')}
          </button>
        </div>
        {weightError && <p role="alert">{t(weightError)}</p>}
      </form>
    );
  }

  function renderScan() {
    switch (scan.phase) {
      case 'camera':
        return (
          <ScanPanel key={scan.attempt} onCode={lookUp} onCancel={closeScan} onSearch={closeScan} />
        );
      case 'looking':
        return <p role="status">{t('shopping.scan.looking', { code: scan.code })}</p>;
      case 'ticking':
        return <p role="status">{t('shopping.scan.ticking')}</p>;
      case 'adding':
        return <p role="status">{t('shopping.scan.adding')}</p>;
      case 'askWeight':
      case 'savingWeight':
        return renderWeightForm();
      case 'offer':
        return (
          <>
            <p role="status">
              {t(scan.alreadyTicked ? 'shopping.scan.alreadyTicked' : 'shopping.scan.notOnList', {
                name: scan.step.name,
              })}
            </p>
            <button type="button" className="btn-primary" onClick={acceptOffer}>
              {t('shopping.scan.addToPantry')}
            </button>{' '}
            <button type="button" onClick={openCamera}>
              {t('shopping.scan.scanAgain')}
            </button>{' '}
            <button type="button" onClick={closeScan}>
              {t('shopping.scan.cancel')}
            </button>
          </>
        );
      case 'done':
        return (
          <>
            <p role="status">
              {t(scan.text === 'ticked' ? 'shopping.scan.ticked' : 'shopping.scan.pantryAdded', {
                name: scan.name,
                grams: units.formatMass(scan.grams),
              })}
            </p>
            <button type="button" onClick={openCamera}>
              {t('shopping.scan.scanAgain')}
            </button>{' '}
            <button type="button" onClick={closeScan}>
              {t('shopping.scan.cancel')}
            </button>
          </>
        );
      case 'label':
        return (
          <LabelForm
            code={scan.code}
            onSaved={handleLabelSaved}
            onCancel={() => setScan({ ...scan, phase: 'notFound' })}
          />
        );
      case 'offOnly':
        return (
          <>
            <p role="status">{t('shopping.scan.offOnly', { name: scan.name })}</p>
            <OffCredit />
            <button type="button" onClick={openCamera}>
              {t('shopping.scan.scanAgain')}
            </button>{' '}
            <button type="button" onClick={closeScan}>
              {t('shopping.scan.cancel')}
            </button>
          </>
        );
      default:
        return renderProblem();
    }
  }

  // notFound and error: never a dead end. Typing the label is offered only when no source knows
  // the code, not when Open Food Facts was busy or down (ticket 20).
  function renderProblem() {
    let message = t('shopping.scan.error');
    if (scan.phase === 'notFound') message = t('shopping.scan.notFound', { code: scan.code });
    if (scan.addError) message = t('shopping.scan.addError');
    if (scan.tickError) message = t('shopping.scan.tickError');
    let offMessage = null;
    if (scan.offStatus === 'rateLimited') offMessage = t('shopping.scan.offBusy');
    if (scan.offStatus === 'unavailable') offMessage = t('shopping.scan.offError');
    return (
      <>
        <p role={scan.phase === 'notFound' ? 'status' : 'alert'}>{message}</p>
        {offMessage && <p role="status">{offMessage}</p>}
        {scan.phase === 'notFound' && !scan.offStatus && (
          <>
            <button type="button" onClick={() => setScan({ ...scan, phase: 'label' })}>
              {t('shopping.scan.typeInLabel')}
            </button>{' '}
          </>
        )}
        <button type="button" onClick={openCamera}>
          {t('shopping.scan.scanAgain')}
        </button>{' '}
        <button type="button" onClick={closeScan}>
          {t('shopping.scan.cancel')}
        </button>
      </>
    );
  }

  return (
    <div>
      {scan === null ? (
        <>
          <button type="button" className="btn-block" disabled={!online} onClick={openCamera}>
            {t('shopping.scan.button')}
          </button>
          {online ? null : <p className="small mute">{t('shopping.scan.needsConnection')}</p>}
        </>
      ) : (
        renderScan()
      )}
    </div>
  );
}

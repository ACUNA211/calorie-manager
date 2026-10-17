import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { lookupGtin } from '../lib/foods.js';
import { addToPantry, foodIdFor, loadFoodPackage, setPackageGrams } from '../lib/pantry.js';
import { packageGrams, validateAddAmount } from '../lib/pantryLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';
import ScanPanel from './ScanPanel.jsx';

// Scan a package into the Pantry (ticket #26). The barcode goes through the same lookup as
// the Foods screen (ticket #18). One scan adds one package at its label weight. When that
// weight is not known, the app asks once and remembers it on the food.
//
// State is null (closed) or { phase, ... }. Phases: camera, looking, notFound, error,
// askWeight, savingWeight, adding, added. `run` counts opens and closes, so a lookup that
// finishes after the panel was closed is dropped.
export default function PantryScan({ onAdded }) {
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

  // Opens the camera; a new attempt remounts ScanPanel, which releases the old camera.
  function openCamera() {
    run.current += 1;
    setWeightText('');
    setWeightError(null);
    setScan((current) => ({ phase: 'camera', attempt: (current?.attempt ?? 0) + 1 }));
  }

  function closeScan() {
    run.current += 1;
    setWeightText('');
    setWeightError(null);
    setScan(null);
  }

  // Adds one package of a food at its label weight, then refreshes the Pantry list.
  async function addPackage(token, foodId, name, grams) {
    setScan({ phase: 'adding' });
    try {
      await addToPantry(supabase, foodId, grams);
    } catch {
      if (alive.current && token === run.current) setScan({ phase: 'error', addError: true });
      return;
    }
    if (!alive.current) return;
    setScan({ phase: 'added', name, grams });
    await onAdded();
  }

  // Looks a scanned code up: the Food Library first, then USDA (inside usda_lookup_gtin).
  // A USDA food is saved to the Food Library on the way, as adding it by search does.
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
      setScan({ phase: 'notFound', code });
      return;
    }

    let food;
    try {
      const foodId = await foodIdFor(supabase, outcome.result);
      food = await loadFoodPackage(supabase, foodId);
    } catch {
      if (alive.current && token === run.current) setScan({ phase: 'error', code });
      return;
    }
    if (!alive.current || token !== run.current) return;

    const grams = packageGrams(food);
    if (grams === null) {
      setScan({ phase: 'askWeight', code, foodId: food.id, name: food.name });
      return;
    }
    await addPackage(token, food.id, food.name, grams);
  }

  // The weight the Household types for a food with no known package weight. It is saved on
  // the food, so the next scan of this food adds without asking.
  async function saveWeight(event) {
    event.preventDefault();
    const parsed = validateAddAmount(weightText, units.units);
    if (!parsed.ok) {
      setWeightError(parsed.error);
      return;
    }
    const token = run.current;
    const { foodId, name } = scan;
    setScan({ ...scan, phase: 'savingWeight' });
    try {
      await setPackageGrams(supabase, foodId, parsed.value);
    } catch {
      if (alive.current && token === run.current) {
        setScan({ ...scan, phase: 'askWeight' });
        setWeightError('pantry.scan.weightError');
      }
      return;
    }
    await addPackage(token, foodId, name, parsed.value);
  }

  function renderWeightForm() {
    const busy = scan.phase === 'savingWeight';
    return (
      <form onSubmit={saveWeight}>
        <p role="status">{t('pantry.scan.askWeight', { name: scan.name })}</p>
        <label>
          {t('pantry.scan.weightLabel', { name: scan.name, unit: units.massUnit })}
          <input
            type="text"
            inputMode="decimal"
            value={weightText}
            onChange={(event) => setWeightText(event.target.value)}
          />
        </label>{' '}
        <button type="submit" disabled={busy}>
          {busy ? t('pantry.scan.weightSaving') : t('pantry.scan.weightSave')}
        </button>{' '}
        <button type="button" disabled={busy} onClick={closeScan}>
          {t('pantry.scan.cancel')}
        </button>
        {weightError && <p role="alert">{t(weightError)}</p>}
      </form>
    );
  }

  // The scan area: the camera, then the state of the lookup, with a way out of each.
  function renderScan() {
    if (scan.phase === 'camera') {
      return (
        <ScanPanel key={scan.attempt} onCode={lookUp} onCancel={closeScan} onSearch={closeScan} />
      );
    }
    if (scan.phase === 'looking') {
      return <p role="status">{t('pantry.scan.looking', { code: scan.code })}</p>;
    }
    if (scan.phase === 'adding') {
      return <p role="status">{t('pantry.scan.adding')}</p>;
    }
    if (scan.phase === 'askWeight' || scan.phase === 'savingWeight') {
      return renderWeightForm();
    }
    if (scan.phase === 'added') {
      return (
        <>
          <p role="status">
            {t('pantry.scan.added', {
              name: scan.name,
              grams: units.formatMass(scan.grams),
            })}
          </p>
          <button type="button" onClick={openCamera}>
            {t('pantry.scan.scanAgain')}
          </button>{' '}
          <button type="button" onClick={closeScan}>
            {t('pantry.scan.cancel')}
          </button>
        </>
      );
    }
    // notFound and error: never a dead end, so search and scan again are both offered.
    let message = t('pantry.scan.error');
    if (scan.phase === 'notFound') message = t('pantry.scan.notFound', { code: scan.code });
    if (scan.addError) message = t('pantry.scan.addError');
    return (
      <>
        <p role={scan.phase === 'notFound' ? 'status' : 'alert'}>{message}</p>
        <button type="button" onClick={closeScan}>
          {t('pantry.scan.searchInstead')}
        </button>{' '}
        <button type="button" onClick={openCamera}>
          {t('pantry.scan.scanAgain')}
        </button>
      </>
    );
  }

  return (
    <div>
      {scan === null ? (
        <button type="button" onClick={openCamera}>
          {t('pantry.scan.button')}
        </button>
      ) : (
        renderScan()
      )}
    </div>
  );
}

// The display units in use (ticket #11): the acting Member's setting, bound to the current
// language. Screens take every amount, typed or shown, through this hook, so no screen formats
// amounts on its own. Outside UnitsProvider (or before a Household loads) the units are US.
// The units prop on UnitsProvider overrides the setting; tests use it to pick metric.
import { createContext, useContext, useMemo } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useActingMember } from './actingMember.jsx';
import { parseWeight } from './weightLogic.js';
import * as unitsLib from './units.js';

// The bound functions for one unit system and language.
export function unitsFor(system, locale) {
  return {
    units: system,
    massUnit: unitsLib.massUnitName(system),
    macroUnit: 'g',
    weightUnit: unitsLib.weightUnitName(system),
    basisLabel: unitsLib.basisLabel(system),
    formatMacro: (grams) => unitsLib.formatMacro(grams, locale),
    formatMass: (grams) => unitsLib.formatMass(grams, system, locale),
    formatWeight: (kg) => unitsLib.formatWeight(kg, system, locale),
    perBasis: (per100g) => unitsLib.perBasis(per100g, system),
    toInputMass: (grams) => unitsLib.toInputMass(grams, system),
    toInputWeight: (kg) => unitsLib.toInputWeight(kg, system),
    parseMass: (text) => unitsLib.parseMass(text, system),
    parseWeight: (text) => parseWeight(text, system),
  };
}

const UnitsContext = createContext(null);

export function UnitsProvider({ children, units: override }) {
  const { locale } = useI18n();
  const { actingUnits } = useActingMember();
  const system = unitsLib.normalizeUnits(override ?? actingUnits);
  const value = useMemo(() => unitsFor(system, locale), [system, locale]);
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const context = useContext(UnitsContext);
  return context ?? unitsFor(unitsLib.DEFAULT_UNITS, 'en');
}

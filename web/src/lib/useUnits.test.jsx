import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { UnitsProvider, unitsFor, useUnits } from './useUnits.jsx';

vi.mock('./supabase.js', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

function Show() {
  const units = useUnits();
  return (
    <div>
      <p data-testid="system">{units.units}</p>
      <p data-testid="mass">{units.formatMass(150)}</p>
      <p data-testid="macro">{units.formatMacro(150)}</p>
      <p data-testid="macroUnit">{units.macroUnit}</p>
      <p data-testid="weight">{units.formatWeight(72.5)}</p>
      <p data-testid="input">{units.toInputMass(150)}</p>
      <p data-testid="parsed">{String(units.parseMass('5.5').grams)}</p>
      <p data-testid="massUnit">{units.massUnit}</p>
    </div>
  );
}

function renderWith(element) {
  return render(<I18nProvider>{element}</I18nProvider>);
}

describe('useUnits', () => {
  afterEach(() => cleanup());

  it('is US outside a provider', () => {
    renderWith(<Show />);
    expect(screen.getByTestId('system')).toHaveTextContent('us');
    expect(screen.getByTestId('mass')).toHaveTextContent('5.3 oz');
    expect(screen.getByTestId('massUnit')).toHaveTextContent('oz');
  });

  it('shows metric when the provider is set to metric', () => {
    renderWith(
      <UnitsProvider units="metric">
        <Show />
      </UnitsProvider>
    );
    expect(screen.getByTestId('system')).toHaveTextContent('metric');
    expect(screen.getByTestId('mass')).toHaveTextContent('150 g');
    expect(screen.getByTestId('weight')).toHaveTextContent('72.5 kg');
    expect(screen.getByTestId('input')).toHaveTextContent('150');
    expect(screen.getByTestId('parsed')).toHaveTextContent('5.5');
    expect(screen.getByTestId('massUnit')).toHaveTextContent('g');
  });

  it('shows US units when the provider is set to US', () => {
    renderWith(
      <UnitsProvider units="us">
        <Show />
      </UnitsProvider>
    );
    expect(screen.getByTestId('mass')).toHaveTextContent('5.3 oz');
    expect(screen.getByTestId('macro')).toHaveTextContent('150 g');
    expect(screen.getByTestId('macroUnit')).toHaveTextContent('g');
    expect(screen.getByTestId('weight')).toHaveTextContent('159.8 lb');
    expect(screen.getByTestId('input')).toHaveTextContent('5.29');
    expect(screen.getByTestId('parsed')).toHaveTextContent('155.9');
  });

  it('reads an unknown setting as US', () => {
    renderWith(
      <UnitsProvider units="furlongs">
        <Show />
      </UnitsProvider>
    );
    expect(screen.getByTestId('system')).toHaveTextContent('us');
  });

  it('binds the functions to a unit system and a language', () => {
    const units = unitsFor('metric', 'es');
    expect(units.formatMass(4.5)).toBe('4,5 g');
    expect(units.parseWeight('72.5').value).toBe(72.5);
    expect(units.parseWeight('2').error).toBe('weight.errors.range');
  });
});

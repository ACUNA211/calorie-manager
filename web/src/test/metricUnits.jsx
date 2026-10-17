// Test wrapper: the language provider plus metric display units (ticket #11). Component tests
// that check gram text render with this, so their expectations stay in grams. Units tests in
// units.test.js and useUnits.test.jsx cover US.
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { UnitsProvider } from '../lib/useUnits.jsx';

export function MetricProvider({ children }) {
  return (
    <I18nProvider>
      <UnitsProvider units="metric">{children}</UnitsProvider>
    </I18nProvider>
  );
}

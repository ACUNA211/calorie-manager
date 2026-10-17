import { Linter } from 'eslint';
import { describe, it, expect } from 'vitest';
import noHardcodedText from './no-hardcoded-text.js';

// Runs only the hard-coded text rule over a snippet of JSX.
function lint(code) {
  const linter = new Linter({ configType: 'flat' });
  const config = [
    {
      files: ['**/*.jsx'],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { local: { rules: { 'no-hardcoded-text': noHardcodedText } } },
      rules: { 'local/no-hardcoded-text': 'error' },
    },
  ];
  return linter.verify(code, config, 'Component.jsx');
}

const messages = (code) => lint(code).map((m) => m.message);

describe('no-hardcoded-text', () => {
  it('flags English written as JSX text', () => {
    expect(messages('const a = <p>Loading…</p>;')).toHaveLength(1);
  });

  it('flags text inside a ternary used as a child', () => {
    expect(messages("const a = <button>{busy ? 'Signing in…' : 'Sign in'}</button>;")).toHaveLength(
      2
    );
  });

  it('flags aria-label and placeholder written as plain strings', () => {
    expect(messages('const a = <aside aria-label="Install hint" />;')).toHaveLength(1);
    expect(messages("const a = <input placeholder={'Your name'} />;")).toHaveLength(1);
  });

  it('allows translated text, ids, types and values', () => {
    const code = `
      const a = (
        <section aria-labelledby="household-heading" aria-label={t('installHint.label')}>
          <input type="email" autoComplete="email" value={email} />
          <h1>{t('home.greeting', { email })}</h1>
          <span>({t('household.roles.owner')})</span>
          <p role="alert">{error && t('signIn.failed')}</p>
        </section>
      );
    `;
    expect(messages(code)).toEqual([]);
  });

  it('ignores plain JavaScript strings outside JSX', () => {
    expect(messages("const DISMISSED_KEY = 'calorieManager.installHintDismissed';")).toEqual([]);
  });
});

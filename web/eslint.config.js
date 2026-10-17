import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import noHardcodedText from './eslint-rules/no-hardcoded-text.js';

export default [
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^React$' }],
    },
  },
  {
    // Every visible string comes from src/locales/*.json. Tests may use literal text.
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/**/*.test.{js,jsx}', 'src/test/**'],
    plugins: { local: { rules: { 'no-hardcoded-text': noHardcodedText } } },
    rules: { 'local/no-hardcoded-text': 'error' },
  },
  prettier,
];

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'demo/dist', 'demo/node_modules'] },

  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      // CONTRIBUTING: no console.log / console.debug.
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      // The component's effect deps are hand-tuned on purpose, so this must
      // be loud enough that omitting one needs a written justification.
      'react-hooks/exhaustive-deps': 'error',
      // `const { a, b, ...rest } = obj` is the idiomatic way to omit keys;
      // the named bindings are the point, not dead code.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },

  {
    files: ['*.config.{js,ts}', 'demo/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off every rule Prettier already owns.
  prettier
);

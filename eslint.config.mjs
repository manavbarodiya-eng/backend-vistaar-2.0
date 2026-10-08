// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],

      // `any` defeats the reason this rewrite exists — the old backend's
      // `find({ email })` against an `agent_email` field returned [] forever
      // because nothing checked it. Keep these as errors.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-floating-promises': 'error',

      // A leading underscore marks something intentionally unused.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      // `expect(mock.method).toHaveBeenCalledWith(...)` passes a method
      // reference on purpose — that is the assertion, not a lost `this`.
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // ── Import boundaries ──────────────────────────────────────────────────
  // Dependencies point one way: modules → core → common → nothing.
  // These rules are here because that arrangement was broken once already —
  // moving the JWT strategy into modules/auth/ left core/ unable to compile
  // without a feature module, which is the foundation depending on a floor
  // above it. Convention did not catch it; a lint rule does.
  {
    files: ['src/core/**/*.ts', 'src/common/**/*.ts', 'src/config/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@modules/*', '**/modules/*'],
              message:
                'core/, common/ and config/ must not depend on a feature module. ' +
                'Move the shared piece down into common/, or the whole concern up into the module.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/common/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@modules/*', '**/modules/*', '@core/*', '**/core/*'],
              message:
                'common/ is the bottom layer — it is a toolbox, and a toolbox cannot ' +
                'reach up into the machinery that uses it.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Reach for another module's *service*, never its data layer.
              // Two modules writing the same collection through two
              // repositories is how their rules drift apart.
              group: [
                '@modules/*/repositories/*',
                '@modules/*/schemas/*',
                '**/modules/*/repositories/*',
                '**/modules/*/schemas/*',
              ],
              message:
                "Import another module's service, not its repository or schema. " +
                '(Your own module stays on relative `./` imports, which this rule ignores.)',
            },
          ],
        },
      ],
    },
  },
);

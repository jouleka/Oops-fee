// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'android/*', 'ios/*'],
  },
  {
    // TypeScript strict rules (no type-info required)
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Prevent explicit any usage
      '@typescript-eslint/no-explicit-any': 'error',
      
      // Prefer type imports
      '@typescript-eslint/consistent-type-imports': ['error', { 
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports'
      }],
      
      // No unused variables (with underscore exception)
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      
      // Consistent type assertions
      '@typescript-eslint/consistent-type-assertions': ['error', {
        assertionStyle: 'as',
        objectLiteralTypeAssertions: 'allow-as-parameter'
      }],
    },
  },
]);

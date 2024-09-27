const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: ['.next/**', 'node_modules/**'], // Ignore Next.js build and node_modules
  },
  {
    files: ['**/*.ts', '**/*.tsx'], // TypeScript file extensions
    languageOptions: {
      parser: tsParser, // Set TypeScript parser
    },
    plugins: {
      '@typescript-eslint': tsPlugin, // Use TypeScript plugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules, // Use recommended TypeScript rules
    }
  },
];

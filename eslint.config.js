import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'data/**'] },
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['server/**/*.js', 'test/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    files: ['**/*.js'],
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-dupe-class-members': 'error',
      'no-self-assign': 'error',
      'no-redeclare': 'error',
    },
  },
];

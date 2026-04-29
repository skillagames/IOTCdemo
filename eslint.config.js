import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', '*.rules', 'firestore.rules']
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    // Standard JS/TS rules would go here
    rules: {
      'no-unused-vars': 'warn',
    }
  }
];

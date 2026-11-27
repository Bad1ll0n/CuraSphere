/* eslint-disable */
// QA-20 — testes de integração: a app real (AppModule) contra uma BD real, por HTTP.
// Correr: pnpm exec nx run @org/api:test-integracao  (DATABASE_URL_INTEGRACAO para outra BD)
const base = require('./jest.config.js');

module.exports = {
  ...base,
  displayName: '@org/api:integracao',
  testMatch: ['<rootDir>/test/integracao/**/*.int-spec.ts'],
  setupFiles: [...base.setupFiles, '<rootDir>/test/integracao/ambiente.ts'],
  globalSetup: '<rootDir>/test/integracao/preparar-bd.ts',
  testTimeout: 90_000,
  maxWorkers: 1,
  // A app deixa ligações a tentar o Redis (inexistente de propósito) e crons agendados.
  forceExit: true,
  coverageDirectory: 'test-output/jest/coverage-integracao',
  coverageThreshold: undefined,
};

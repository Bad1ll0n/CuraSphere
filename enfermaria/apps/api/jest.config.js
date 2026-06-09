/* eslint-disable */
// Alternativa ao jest.config.cts para execução directa com jest (sem Nx)
// Necessário porque Jest 30 + ts-node falha a parsear .cts com moduleResolution:NodeNext
const { readFileSync } = require('fs');

const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@org/api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // otplib e deps (@noble/hashes, @scure/base) são pacotes ESM — precisam de transformação
  transformIgnorePatterns: [
    '/node_modules/.pnpm/(?!@scure\\+base|@noble\\+hashes|otplib@|@otplib\\+)[^/]+/',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  collectCoverageFrom: [
    'src/app/**/*.service.ts',
    '!src/app/**/index.ts',
    '!src/generated/**',
  ],
  coverageThreshold: {
    global: { statements: 50, branches: 28, functions: 45, lines: 52 },
  },
};

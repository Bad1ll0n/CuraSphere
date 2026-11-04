/* eslint-disable */
// Harness de testes unitários para a lógica de `src/lib` (MB-02/MB-12).
//
// A app não tinha alvo de testes nem configuração de Jest — daí os zero ficheiros de
// teste que a auditoria encontrou. Isto cobre deliberadamente só a lógica pura de
// `src/lib`, com os módulos nativos substituídos por duplos: montar o transform completo
// do React Native para renderizar ecrãs é um trabalho à parte, e não era preciso para
// testar a fila offline, que é onde está o risco clínico.
const { readFileSync } = require('fs');

const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@org/mobile',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\.[tj]sx?$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['<rootDir>/src/lib/**/*.spec.ts'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/test-doubles/async-storage.ts',
    '^@react-native-community/netinfo$': '<rootDir>/src/test-doubles/netinfo.ts',
    '^\./api$': '<rootDir>/src/test-doubles/api.ts',
  },
  coverageDirectory: 'test-output/jest/coverage',
};

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
  // QA-25: nenhum teste unitário sai para a rede.
  setupFiles: ['<rootDir>/test/sem-rede.ts'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // otplib e deps (@noble/hashes, @scure/base) são pacotes ESM — precisam de transformação
  transformIgnorePatterns: [
    '/node_modules/.pnpm/(?!@scure\\+base|@noble\\+hashes|otplib@|@otplib\\+)[^/]+/',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // QA-21: a métrica media só serviços — os guards, interceptors e controllers (onde vivem as
  // verificações de acesso) nem entravam nela.
  collectCoverageFrom: [
    'src/app/**/*.service.ts',
    'src/app/**/*.controller.ts',
    'src/app/**/*.guard.ts',
    'src/app/**/*.interceptor.ts',
    'src/app/**/*.strategy.ts',
    'src/app/**/*.filter.ts',
    'src/app/**/*.middleware.ts',
    'src/app/common/*.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/*.dto.ts',
    '!src/app/**/index.ts',
    '!src/generated/**',
    // Infra do cliente de BD (adapter pg + encriptação + plumbing de transação/GUC). Só é
    // testável com uma BD real — validado por testes de integração/provas, não por unit.
    '!src/app/prisma/prisma.service.ts',
  ],
  // QA-21: mínimos GLOBAIS medidos com a métrica alargada (serviços + controllers, guards,
  // interceptors, strategies, filtros, middleware e common/), e mínimos POR FICHEIRO nos módulos
  // críticos (acesso, autenticação, medicação, alergias, transfusão, auditoria, RGPD), fixados
  // ao nível actual: é uma catraca — não pode descer; sobe quando se acrescentam testes.
  // Objectivo do plano: +5 p.p. de ramos por trimestre até 80 % nos críticos.
  coverageThreshold: {
    // O global exclui os ficheiros com mínimo próprio (regra do Jest): é o "resto do código".
    global: { statements: 47, branches: 30, functions: 37, lines: 48 },
    './src/app/medicacao/medicacao.service.ts': { statements: 57, branches: 51, functions: 45, lines: 60 },
    './src/app/alergias/alergias.service.ts': { statements: 95, branches: 85, functions: 100, lines: 100 },
    './src/app/transfusao/transfusao.service.ts': { statements: 74, branches: 64, functions: 68, lines: 81 },
    './src/app/sinais-vitais/sinais-vitais.service.ts': { statements: 58, branches: 34, functions: 62, lines: 62 },
    './src/app/break-glass/break-glass.service.ts': { statements: 90, branches: 45, functions: 62, lines: 93 },
    './src/app/auth/auth.service.ts': { statements: 89, branches: 77, functions: 74, lines: 91 },
    './src/app/auth/jwt.strategy.ts': { statements: 90, branches: 63, functions: 80, lines: 90 },
    './src/app/auth/jwt-auth.guard.ts': { statements: 100, branches: 91, functions: 100, lines: 100 },
    './src/app/auth/roles.guard.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
    './src/app/auth/sso/sso.service.ts': { statements: 87, branches: 72, functions: 60, lines: 86 },
    './src/app/auth/webauthn/webauthn.service.ts': { statements: 69, branches: 53, functions: 61, lines: 68 },
    './src/app/doentes/acesso-doente.interceptor.ts': { statements: 97, branches: 82, functions: 100, lines: 100 },
    './src/app/prisma/contexto-pedido.interceptor.ts': { statements: 100, branches: 75, functions: 100, lines: 100 },
    './src/app/common/correlacao.ts': { statements: 100, branches: 90, functions: 100, lines: 100 },
    './src/app/common/consentimento-tratamento.ts': { statements: 90, branches: 81, functions: 91, lines: 96 },
    './src/app/common/funcoes-ia.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
    './src/app/common/jitsi.ts': { statements: 97, branches: 100, functions: 100, lines: 97 },
    './src/app/consentimentos-tratamento/consentimentos-tratamento.service.ts': { statements: 98, branches: 92, functions: 100, lines: 97 },
  },
};

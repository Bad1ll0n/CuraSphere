import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import baseConfig from '../../eslint.config.mjs';

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  jsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.tsx'],
    // Regras de a11y cuja correção altera COMPORTAMENTO de UI (teclado em <div onClick>,
    // autofocus) em ~40 sítios — decisão de equipa: `warn` (ficam registadas/visíveis, não
    // bloqueiam o gate) enquanto são migradas caso-a-caso com verificação. Ver WCAG-AUDIT.md #2.
    rules: {
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
    },
  },
  {
    // Zonas já limpas: a regra volta a ser bloqueante para não regredirem. Ficaram em `warn`
    // apenas os caminhos com dívida por saldar — (administrativo), (gestao), (suporte) e as
    // páginas soltas de (dashboard). Quando esses 13 locais forem corrigidos, este bloco
    // passa a poder cobrir `src/**` e o override de `warn` acima desaparece.
    files: [
      '**/src/components/**/*.tsx',
      '**/src/lib/**/*.tsx',
      '**/src/app/(dashboard)/(clinico)/**/*.tsx',
      '**/src/app/(portal)/**/*.tsx',
      '**/src/app/(auth)/**/*.tsx',
      '**/src/app/(print)/**/*.tsx',
    ],
    rules: {
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
    },
  },
  {
    ignores: ['.next/**/*', '**/out-tsc'],
  },
];

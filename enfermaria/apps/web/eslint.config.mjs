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
    ignores: ['.next/**/*', '**/out-tsc'],
  },
];

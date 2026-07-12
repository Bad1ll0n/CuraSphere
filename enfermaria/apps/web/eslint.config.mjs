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
    ignores: ['.next/**/*', '**/out-tsc'],
  },
];

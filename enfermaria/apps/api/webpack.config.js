const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const webpack = require('webpack');

// Optional peer dependencies of libraries this app actually uses (pg, ws,
// resend) that are conditionally required by those libraries themselves for
// driver/feature paths this app never exercises (native pg binding, native ws
// perf addons, resend's optional React-email renderer). None of these are
// installed, none of them need to be — each is guarded by a try/catch or
// conditional require in its own library, so ignoring them here just stops
// webpack from treating the absence as a hard build error. (@nestjs/terminus
// used to need entries here too — removed entirely instead, see app.controller.ts.)
const OPTIONAL_UNUSED_PEERS = [
  /^pg-native$/,
  /^bufferutil$/,
  /^utf-8-validate$/,
  /^@react-email\/render$/,
];

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  // Explicit, safe resolution order — third-party packages in node_modules
  // (e.g. @nestjs/terminus) ship .d.ts/.js.map files alongside their real
  // .js output; without this, module resolution has picked the .d.ts file
  // instead of the .js one for some bare (no-extension) requires.
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: false,
      externalDependencies: 'all',
    }),
    ...OPTIONAL_UNUSED_PEERS.map((resourceRegExp) => new webpack.IgnorePlugin({ resourceRegExp })),
  ],
};

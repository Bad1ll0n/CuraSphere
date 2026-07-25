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
      // Copiar o cliente Prisma gerado para o dist (é externalizado acima, não empacotado).
      assets: ['./src/assets', { input: './src/generated/prisma', glob: '**/*', output: 'generated/prisma' }],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: false,
      externalDependencies: 'all',
    }),
    ...OPTIONAL_UNUSED_PEERS.map((resourceRegExp) => new webpack.IgnorePlugin({ resourceRegExp })),
    // Externalizar o cliente Prisma GERADO (não o empacotar). Empacotar o runtime pré-minificado do
    // Prisma faz o webpack reordenar `this`/`super` das suas classes de erro → em runtime rebenta com
    // "Must call super constructor in derived class…", pelo que P2002/P2025 nunca são instâncias de
    // PrismaClientKnownRequestError e o exception.filter não os mapeia (409/404 viram 500). É
    // require()d em runtime de dist/generated/prisma (copiado via `assets`), onde funciona como no
    // node direto. Corre DEPOIS do NxAppWebpackPlugin e faz prepend para combinar (não substituir) a
    // externalização de node_modules feita por `externalDependencies:'all'`.
    {
      apply(compiler) {
        const anterior = compiler.options.externals;
        const externaisExtra = function ({ request }, callback) {
          // Cliente Prisma gerado → require em runtime de dist/generated/prisma (ver acima).
          if (request && /(^|[\\/])generated[\\/]prisma($|[\\/])/.test(request)) {
            return callback(null, 'commonjs ./generated/prisma');
          }
          // @node-rs/bcrypt (napi + binário .node por plataforma) NÃO pode ser empacotado — o
          // webpack tentaria fazer parse do binário nativo. Externalizar → require do node_modules
          // em runtime (o binário certo é resolvido pelo próprio pacote, como o pg/ioredis).
          if (request && /^@node-rs\/bcrypt/.test(request)) {
            return callback(null, 'commonjs ' + request);
          }
          return callback();
        };
        compiler.options.externals = [externaisExtra].concat(anterior ?? []);
      },
    },
  ],
};

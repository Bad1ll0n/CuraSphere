//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withSentryConfig } = require('@sentry/nextjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createNextIntlPlugin = require('next-intl/plugin');
// next-intl exige um caminho relativo (não suporta caminhos absolutos com
// Turbopack) e resolve-o em relação ao process.cwd() de quem invoca este
// ficheiro — não ao diretório deste ficheiro. O `next` CLI já corre com
// cwd = apps/web, mas o Nx computa o project graph a partir da raiz do
// workspace, o que faz a resolução falhar aí. Ver uso de `withCwd` abaixo.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isMainThread } = require('worker_threads');

/** Corre `fn` com process.cwd() temporariamente definido para __dirname. */
function withCwd(fn) {
  // OPS-02: o Next 16 carrega esta configuração num worker durante o `next build`, e num
  // worker `process.chdir` é proibido — a imagem de produção não construía. Nesse caso o
  // `next` já corre com cwd = apps/web, que é exactamente o que o next-intl precisa.
  if (!isMainThread || process.cwd() === __dirname) return fn();
  const originalCwd = process.cwd();
  process.chdir(__dirname);
  try {
    return fn();
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  productionBrowserSourceMaps: false,
  transpilePackages: ['@org/shared', '@org/ui'],
  // CSP e Permissions-Policy são por pedido (nonce) e vivem no middleware — ver src/lib/csp.ts.
  // Aqui ficam os cabeçalhos estáticos, que também têm de chegar aos ficheiros de _next/static.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

const plugins = [withNx];

const sentryOpcoes = {
  silent: true,
  // Desactivar upload de source maps se não houver auth token configurado
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
};

// O `composePlugins(withNx)` devolve uma função `(phase, context) => Promise<config>`, não um
// objecto. Passava-se essa função directamente ao `withNextIntl`, que a espalhava como se fosse
// objecto: a configuração final saía só com `turbopack` e `webpack` — sem `output: 'standalone'`
// (a imagem Docker não tinha servidor), sem `transpilePackages` e sem `headers()`, portanto sem
// um único cabeçalho de segurança. Resolve-se primeiro a fase do Nx e só depois se embrulha.
module.exports = async (phase, context) => {
  const baseConfig = await composePlugins(...plugins)(nextConfig)(phase, context);
  const configWithIntl = withCwd(() => withNextIntl(baseConfig));
  return withSentryConfig(configWithIntl, sentryOpcoes);
};

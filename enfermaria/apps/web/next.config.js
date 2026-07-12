//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withSentryConfig } = require('@sentry/nextjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  productionBrowserSourceMaps: false,
  transpilePackages: ['@org/shared', '@org/ui'],
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    const wsOrigins = apiUrl
      ? `${apiUrl.replace(/^http/, 'ws')} ${apiUrl}`
      : 'ws://localhost:3333 http://localhost:3333';
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              `connect-src 'self' ${wsOrigins} https:`,
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              `report-uri ${apiUrl || 'http://localhost:3333'}/v1/csp-report`,
            ].join('; '),
          },
        ],
      },
    ];
  },
};

const plugins = [withNx];

const baseConfig = composePlugins(...plugins)(nextConfig);

module.exports = withSentryConfig(withNextIntl(baseConfig), {
  silent: true,
  // Desactivar upload de source maps se não houver auth token configurado
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});

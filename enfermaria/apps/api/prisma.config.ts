import { defineConfig } from 'prisma/config';
import path from 'path';

// Prisma 7: load .env since config runs before NestJS env loading
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // .env may not exist in CI/production — rely on actual env vars
}

export default defineConfig({
  datasource: {
    provider: 'postgresql',
    url: process.env['DATABASE_URL'] as string,
  },
});

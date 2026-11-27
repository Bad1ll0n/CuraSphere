import { execSync } from 'child_process';
import { join } from 'path';
import { Client } from 'pg';

/**
 * QA-20 — globalSetup: BD nova a cada corrida, com o MESMO caminho de produção.
 *   1. DROP/CREATE da base de integração (descartável);
 *   2. `prisma migrate deploy` (as migrações versionadas, não `db push`);
 *   3. triggers de auditoria (scripts/apply-audit-triggers.mjs, como no deploy);
 *   4. seed das personas de teste (00001…00017, password Teste1234!, TOTP fixo).
 */
export default async function prepararBd(): Promise<void> {
  const url = process.env['DATABASE_URL_INTEGRACAO'] ?? 'postgresql://postgres:postgres@localhost:5432/enfermaria_integracao';
  const alvo = new URL(url);
  const nome = alvo.pathname.slice(1);
  if (!/integracao|teste|test/.test(nome)) {
    throw new Error(`QA-20: recuso apagar "${nome}" — o nome da BD de integração tem de conter "integracao" ou "teste".`);
  }
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
  await c.query(`CREATE DATABASE "${nome}"`);
  await c.end();

  const raizApi = join(__dirname, '..', '..');
  const env = { ...process.env, DATABASE_URL: url };
  const correr = (cmd: string) => execSync(cmd, { cwd: raizApi, env, stdio: 'pipe' });
  correr('npx prisma migrate deploy');
  correr('node scripts/apply-audit-triggers.mjs');
  correr('npx ts-node --transpile-only src/prisma/seed-test-users.ts');
}

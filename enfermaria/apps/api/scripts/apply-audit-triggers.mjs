#!/usr/bin/env node
// Aplica a auditoria por triggers a TODAS as tabelas base (menos a deny-list de infra).
// Idempotente — re-executar após cada `prisma db push`. Uso:
//   DATABASE_URL=postgresql://... node apps/api/scripts/apply-audit-triggers.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const dir = dirname(fileURLToPath(import.meta.url));
const DB = process.env.DATABASE_URL;
if (!DB) { console.error('DATABASE_URL em falta'); process.exit(1); }

// Nunca auditar as próprias tabelas de auditoria (recursão) nem o trilho de leituras.
const DENY = new Set(['audit_logs', 'audit_checkpoints', 'acessos_leitura']);

async function main() {
  const pool = new pg.Pool({ connectionString: DB });

  // 1) Função de auditoria (idempotente: CREATE OR REPLACE).
  await pool.query(readFileSync(join(dir, '..', 'prisma', 'audit-triggers.sql'), 'utf8'));

  // 2) Tabelas base do schema public (exclui vistas e a deny-list).
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
  );
  const tabelas = rows.map((r) => r.table_name).filter((t) => !DENY.has(t));

  let aplicadas = 0;
  for (const t of tabelas) {
    // Idempotente: DROP IF EXISTS + CREATE.
    await pool.query(`DROP TRIGGER IF EXISTS curasphere_audit ON "${t}"`);
    await pool.query(
      `CREATE TRIGGER curasphere_audit AFTER INSERT OR UPDATE OR DELETE ON "${t}" FOR EACH ROW EXECUTE FUNCTION curasphere_fn_audit()`,
    );
    aplicadas++;
  }

  const total = (await pool.query("SELECT count(*) FROM information_schema.triggers WHERE trigger_name='curasphere_audit'")).rows[0].count;
  console.log(`Triggers de auditoria aplicados a ${aplicadas} tabelas (deny-list: ${[...DENY].join(', ')}).`);
  console.log(`Total de triggers curasphere_audit na BD: ${total}`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

/**
 * OPS-20 — rotação da ENCRYPTION_KEY: recifra com a chave ATUAL tudo o que ainda está cifrado com
 * uma das chaves de `ENCRYPTION_KEYS_ANTERIORES`, e recalcula os índices cegos (nome, NIF).
 *
 * Procedimento (docs/SEGREDOS.md):
 *   1. ENCRYPTION_KEY=<nova>  ENCRYPTION_KEYS_ANTERIORES=<antiga>  → reiniciar a API (lê as duas);
 *   2. cd apps/api && npx ts-node --transpile-only src/prisma/rodar-chave-cifragem.ts --simular
 *   3. o mesmo sem --simular; repetir até dizer 0 por recifrar;
 *   4. retirar ENCRYPTION_KEYS_ANTERIORES e reiniciar.
 * Idempotente e retomável: o que já está com a chave atual fica como está.
 */
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

try { process.loadEnvFile(); } catch { /* sem .env: usa o ambiente */ }

const SIMULAR = process.argv.includes('--simular');
const LOTE = 500;

/** Campos cifrados por delegate (os de ENCRYPTED_FIELDS e os segredos de cifrarSegredo). */
export const ALVOS: Record<string, string[]> = {
  doente: ['nome'],
  contactoEmergencia: ['nome', 'telefone'],
  ficheiroPessoalDoente: ['morada', 'telefone', 'email', 'nif'],
  utilizador: ['mfaSecret', 'mfaSecretPendente'],
  webhook: ['secret'],
};

/** O que gravar numa linha: os campos recifrados e, se mudaram, os índices cegos. */
export function recifrarLinha(
  delegate: string,
  linha: Record<string, any>,
  m: { claroSeChaveAntiga: (v: unknown) => string | null; cifrarSegredo: (v: string) => string; tokensDeBuscaNome: (n: string) => string | null; indiceNif: (n: string) => string | null },
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  for (const campo of ALVOS[delegate] ?? []) {
    const claro = m.claroSeChaveAntiga(linha[campo]);
    if (claro === null) continue;
    patch[campo] = m.cifrarSegredo(claro);
    if (delegate === 'doente' && campo === 'nome') patch['nomeBusca'] = m.tokensDeBuscaNome(claro);
    if (delegate === 'ficheiroPessoalDoente' && campo === 'nif') patch['nifBusca'] = m.indiceNif(claro);
  }
  return Object.keys(patch).length ? patch : null;
}

async function main() {
  // Depois do .env: o módulo lê as chaves ao ser importado.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('../app/prisma/encryption.middleware');
  if (!process.env['ENCRYPTION_KEYS_ANTERIORES']) {
    console.log('ENCRYPTION_KEYS_ANTERIORES vazia — não há chaves antigas para rodar.');
    return;
  }
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  // Cliente CRU: lê o que está na BD e grava o texto cifrado tal e qual (sem voltar a cifrar).
  const cru: any = new PrismaClient({ adapter: new PrismaPg(pool) });
  let total = 0;
  for (const [delegate, campos] of Object.entries(ALVOS)) {
    let cursor: string | undefined;
    let porRecifrar = 0;
    for (;;) {
      const linhas: any[] = await cru[delegate].findMany({
        select: { id: true, ...Object.fromEntries(campos.map((c) => [c, true])) },
        orderBy: { id: 'asc' },
        take: LOTE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (linhas.length === 0) break;
      cursor = linhas[linhas.length - 1].id;
      for (const linha of linhas) {
        const patch = recifrarLinha(delegate, linha, m);
        if (!patch) continue;
        porRecifrar++;
        if (!SIMULAR) await cru[delegate].update({ where: { id: linha.id }, data: patch });
      }
    }
    console.log(`${delegate.padEnd(24)} ${String(porRecifrar).padStart(6)} ${SIMULAR ? 'por recifrar' : 'recifrados'}`);
    total += porRecifrar;
  }
  console.log(SIMULAR ? `\n${total} registos com chaves antigas. Nada foi alterado — repetir sem --simular.` : `\nConcluído: ${total} registos recifrados com a chave atual.`);
  await cru.$disconnect();
  await pool.end();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

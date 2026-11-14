/**
 * PROD-05 — importa o catálogo nacional de medicamentos (INFARMED: Infomed / CHNM) a partir de
 * um ficheiro CSV/TSV exportado. Idempotente: pelo código CHNM quando existe; senão por
 * DCI + forma + dosagem + via.
 *
 *   cd apps/api
 *   DATABASE_URL=... npx ts-node --transpile-only src/prisma/importar-catalogo.ts <ficheiro.csv> [versão]
 *   DATABASE_URL=... npx ts-node --transpile-only src/prisma/importar-catalogo.ts --amostra
 *
 * O ficheiro tem de ter, pelo menos, as colunas da DCI (substância activa) e da forma
 * farmacêutica; as restantes (dosagem, via, ATC, CHNM, embalagem, nome) são opcionais. Os
 * nomes das colunas aceitam os sinónimos em `catalogo-nacional.ts`.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { gravarItensCatalogo, lerCsvCatalogo, ItemCatalogo } from '../app/catalogo/catalogo-nacional';
import amostra from '../app/catalogo/catalogo-amostra.json';

async function main() {
  const [arg, versaoArg] = process.argv.slice(2);
  if (!arg) {
    console.error('Uso: importar-catalogo.ts <ficheiro.csv> [versão] | --amostra');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    if (arg === '--amostra') {
      const r = await gravarItensCatalogo(prisma, amostra.itens as ItemCatalogo[], 'amostra', amostra.versao);
      console.log(`Amostra ${amostra.versao}: ${r.criados} criados, ${r.atualizados} actualizados.`);
      return;
    }
    const { itens, rejeitadas, colunas } = lerCsvCatalogo(readFileSync(arg, 'utf8'));
    console.log('Colunas reconhecidas:', colunas);
    const versao = versaoArg ?? basename(arg);
    const r = await gravarItensCatalogo(prisma, itens, 'infarmed', versao);
    console.log(`INFARMED ${versao}: ${r.criados} criados, ${r.atualizados} actualizados, ${rejeitadas.length} linhas rejeitadas.`);
    for (const x of rejeitadas.slice(0, 20)) console.log(`  linha ${x.linha}: ${x.motivo}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

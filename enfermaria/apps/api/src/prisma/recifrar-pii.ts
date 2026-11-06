/**
 * Recifragem dos dados pessoais gravados em claro (ARQ-01 / QA-03) — correr UMA vez por
 * ambiente, depois de instalar a versão que liga a cifragem a todos os modelos.
 *
 * Até essa versão, `ContactoEmergencia` e `FicheiroPessoalDoente` escritos fora de uma
 * transação ficavam em claro, e nenhum doente tinha o índice cego do nome (`nomeBusca`).
 * Este script:
 *   - cifra todos os campos de ENCRYPTED_FIELDS que ainda não começam por `enc:`;
 *   - calcula `nomeBusca` para os doentes que não o têm.
 * É idempotente: valores já cifrados ficam como estão, por isso pode voltar a correr-se.
 *
 * Executar: cd apps/api && npx ts-node src/prisma/recifrar-pii.ts [--simular]
 * (requer DATABASE_URL e ENCRYPTION_KEY no ambiente ou no .env)
 */
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

try { process.loadEnvFile(); } catch { /* sem .env: usa o ambiente */ }

const SIMULAR = process.argv.includes('--simular');

const CAMPOS: Record<string, string[]> = {
  contactoEmergencia: ['nome', 'telefone'],
  ficheiroPessoalDoente: ['morada', 'telefone', 'email'],
  doente: ['nome'],
};

async function main() {
  // Carregado só aqui: o módulo lê a ENCRYPTION_KEY ao ser importado, e o `.env` acima
  // só fica carregado depois dos imports estáticos.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { criarClienteComEncriptacao } = require('../app/prisma/encryption.middleware');
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const cru = new PrismaClient({ adapter: new PrismaPg(pool) });
  // O cliente estendido cifra ao escrever e decifra ao ler.
  const cifrado: any = criarClienteComEncriptacao(cru);

  for (const [delegate, campos] of Object.entries(CAMPOS)) {
    // Ler pelo cliente CRU, para ver o que está realmente na BD.
    const linhas: any[] = await (cru as any)[delegate].findMany({
      select: { id: true, ...Object.fromEntries(campos.map((c) => [c, true])), ...(delegate === 'doente' ? { nomeBusca: true } : {}) },
    });
    let alteradas = 0;
    for (const linha of linhas) {
      const emClaro = campos.filter((c) => typeof linha[c] === 'string' && linha[c] && !linha[c].startsWith('enc:'));
      const semIndice = delegate === 'doente' && !linha.nomeBusca;
      if (emClaro.length === 0 && !semIndice) continue;
      alteradas++;
      if (SIMULAR) continue;
      if (emClaro.length > 0) {
        // Escrever pelo cliente cifrado: cifra os campos em claro e, no doente, calcula o índice.
        await cifrado[delegate].update({ where: { id: linha.id }, data: Object.fromEntries(emClaro.map((c) => [c, linha[c]])) });
      } else {
        // Já cifrado mas sem índice: decifrar pelo cliente cifrado e regravar o nome em claro
        // (que volta a ser cifrado, agora com o índice).
        const doente = await cifrado.doente.findUnique({ where: { id: linha.id }, select: { nome: true } });
        await cifrado.doente.update({ where: { id: linha.id }, data: { nome: doente.nome } });
      }
    }
    console.log(`${delegate}: ${linhas.length} linhas, ${alteradas} ${SIMULAR ? 'a recifrar (simulação)' : 'recifradas'}`);
  }

  await cru.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

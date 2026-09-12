#!/usr/bin/env node
/**
 * Cifra em repouso os registos que ficaram em claro (S-14).
 *
 * A configuração de cifragem apontava para modelos e campos que não existem no schema, e
 * como falhava em silêncio protegia apenas `Doente.nome`. Depois de corrigida, os registos
 * NOVOS ficam cifrados — mas os que já existem em base continuam em claro, porque a
 * cifragem só acontece na escrita.
 *
 * Este script percorre-os e reescreve-os. É idempotente: um valor já cifrado começa por
 * `enc:` e é deixado como está, portanto correr duas vezes não faz mal e uma execução
 * interrompida retoma-se sem perder nada.
 *
 * Uso:
 *   DATABASE_URL=... ENCRYPTION_KEY=<64 hex> node scripts/cifrar-dados-existentes.mjs [--aplicar]
 *
 * Sem `--aplicar` faz apenas a contagem — corre-se sempre primeiro assim.
 */
import { createCipheriv, randomBytes } from 'crypto';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const APLICAR = process.argv.includes('--aplicar');

const KEY_HEX = process.env.ENCRYPTION_KEY ?? '';
if (KEY_HEX.length !== 64) {
  console.error('ENCRYPTION_KEY em falta ou inválida (esperados 64 caracteres hexadecimais).');
  process.exit(1);
}
const KEY = Buffer.from(KEY_HEX, 'hex');

/** Tem de coincidir com `encryption.middleware.ts` — mesmo formato, mesma chave. */
function cifrar(texto) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${Buffer.concat([iv, tag, enc]).toString('base64')}`;
}

/** Modelos e campos, na mesma ordem em que o middleware os declara. */
const ALVOS = [
  { delegate: 'doente', campos: ['nome'] },
  { delegate: 'contactoEmergencia', campos: ['nome', 'telefone'] },
  { delegate: 'ficheiroPessoalDoente', campos: ['morada', 'telefone', 'email'] },
];

// Cliente SEM a extensão de cifragem: aqui é preciso ler o valor em bruto e escrever já
// cifrado. Passar pela extensão cifraria duas vezes.
//
// O adaptador é obrigatório no Prisma 7 e tem de ser o mesmo que a aplicação usa, senão
// o cliente nem chega a construir-se.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let totalPorCifrar = 0;
let totalCifrado = 0;

for (const { delegate, campos } of ALVOS) {
  const seleccao = Object.fromEntries([['id', true], ...campos.map((c) => [c, true])]);
  const registos = await prisma[delegate].findMany({ select: seleccao });

  let porCifrar = 0;
  for (const registo of registos) {
    const patch = {};
    for (const campo of campos) {
      const valor = registo[campo];
      if (typeof valor === 'string' && valor.length > 0 && !valor.startsWith('enc:')) {
        patch[campo] = cifrar(valor);
      }
    }
    if (Object.keys(patch).length === 0) continue;

    porCifrar++;
    if (APLICAR) {
      await prisma[delegate].update({ where: { id: registo.id }, data: patch });
      totalCifrado++;
    }
  }

  console.log(
    `${delegate.padEnd(24)} ${String(registos.length).padStart(6)} registos · ` +
      `${String(porCifrar).padStart(5)} por cifrar`,
  );
  totalPorCifrar += porCifrar;
}

console.log('');
if (APLICAR) {
  console.log(`Concluído: ${totalCifrado} registos cifrados.`);
} else {
  console.log(
    `${totalPorCifrar} registos em claro. Nada foi alterado — repetir com --aplicar para cifrar.`,
  );
}

await prisma.$disconnect();
await pool.end();

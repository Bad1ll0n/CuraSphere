/**
 * Seed de utilizadores de teste — CuraSphere
 * Apaga TODOS os utilizadores existentes e cria um por cada função/role.
 *
 * Executar: cd apps/api && npx ts-node src/prisma/seed-test-users.ts
 * (requer DATABASE_URL no ambiente ou .env)
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

try { process.loadEnvFile(); } catch {}
const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PASSWORD = 'Teste1234!';
const PASS_HASH = bcrypt.hashSync(PASSWORD, 12);
// 1 ano no futuro — sem avisos de password expirada
const EXPIRES = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

// Um utilizador por cada role da aplicação
const UTILIZADORES = [
  // ── Roles NÃO clínicos — login directo (sem MFA obrigatório) ──────────────
  {
    num: '00001',
    nome: 'Direção (Teste)',
    role: 'direcao',
    subRole: 'ceo_hospitalar',
    servico: 'internamento',
  },
  {
    num: '00007',
    nome: 'Administrativo (Teste)',
    role: 'administrativo',
    subRole: 'front_desk',
    servico: 'administrativo',
  },
  {
    num: '00008',
    nome: 'Operacional (Teste)',
    role: 'operacional',
    subRole: 'facilities',
    servico: 'internamento',
  },
  {
    num: '00009',
    nome: 'TI (Teste)',
    role: 'ti',
    subRole: 'it_admin',
    servico: 'internamento',
  },
  {
    num: '00010',
    nome: 'Qualidade (Teste)',
    role: 'qualidade',
    subRole: 'quality_manager',
    servico: 'internamento',
  },
  // ── Roles clínicos — 1.º login requer configurar MFA (TOTP) ──────────────
  {
    num: '00002',
    nome: 'Médico (Teste)',
    role: 'medico',
    subRole: 'clinico_geral',
    servico: 'internamento',
  },
  {
    num: '00003',
    nome: 'Enfermeiro (Teste)',
    role: 'enfermeiro',
    subRole: 'generalista',
    servico: 'internamento',
  },
  {
    num: '00004',
    nome: 'Auxiliar (Teste)',
    role: 'auxiliar',
    subRole: 'apoio_geral',
    servico: 'internamento',
  },
  {
    num: '00005',
    nome: 'Técnico de Saúde (Teste)',
    role: 'tecnico_saude',
    subRole: 'reabilitacao_fisica',
    servico: 'internamento',
  },
  {
    num: '00006',
    nome: 'Farmacêutico (Teste)',
    role: 'farmaceutico',
    subRole: 'farmaceutico_hospitalar',
    servico: 'farmacia',
  },
];

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' CuraSphere — Seed de Utilizadores de Teste');
  console.log('══════════════════════════════════════════════════\n');

  // ── 1. Apagar todos os utilizadores (CASCADE elimina registos dependentes) ─
  console.log('► Apagar utilizadores existentes...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "utilizadores" CASCADE');
  console.log('  ✓ Utilizadores e dados dependentes eliminados.\n');

  // ── 2. Criar os 10 utilizadores de teste ───────────────────────────────────
  console.log('► Criar utilizadores de teste...\n');
  for (const u of UTILIZADORES) {
    await prisma.utilizador.create({
      data: {
        numeroFuncionario: u.num,
        nome: u.nome,
        passwordHash: PASS_HASH,
        role: u.role,
        subRole: u.subRole,
        servico: u.servico as any,
        passwordExpiresAt: EXPIRES,
        mfaAtivo: false,
        ativo: true,
      },
    });
    console.log(`  ✓  ${u.num}  ${u.role.padEnd(14)}  ${u.nome}`);
  }

  // ── 3. Resumo final ────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(` Password de todos: ${PASSWORD}`);
  console.log('══════════════════════════════════════════════════');
  console.log('\n  ROLES SEM MFA (login directo):');
  console.log('  00001  direcao        — acesso total (oversight)');
  console.log('  00007  administrativo — recepção, faturação');
  console.log('  00008  operacional    — logística, transporte');
  console.log('  00009  ti             — incidentes TI, configurações');
  console.log('  00010  qualidade      — auditoria, conformidade');
  console.log('\n  ROLES CLÍNICOS (1.º login pede configurar MFA / app TOTP):');
  console.log('  00002  medico         — prescrições, consultas, alta');
  console.log('  00003  enfermeiro     — notas turno, medicação, sinais vitais');
  console.log('  00004  auxiliar       — apoio geral');
  console.log('  00005  tecnico_saude  — fisioterapia, reabilitação');
  console.log('  00006  farmaceutico   — farmácia, stock, MAR');
  console.log('\n  Dica: usa uma app TOTP (Google Authenticator / Authy)');
  console.log('  para configurar MFA nos roles clínicos.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

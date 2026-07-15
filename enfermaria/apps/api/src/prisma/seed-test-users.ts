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

// Segredo TOTP fixo para todos os utilizadores clínicos de teste — permite calcular
// o código MFA programaticamente (otplib `generate({ secret })`) em vez de exigir
// scan de QR code. APENAS para ambientes de teste — nunca usar em produção.
const TOTP_SECRET_TESTE = 'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV';
const ROLES_CLINICOS = ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'farmaceutico'];

// Um utilizador por cada role da aplicação, mais os sub-roles privilegiados que
// mudam guards/permissões reais na API (ver apps/api/src/app/common/enums.ts SUBROLES)
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
  // ── Sub-roles privilegiados — mudam guards/permissões reais na API ────────
  {
    num: '00011',
    nome: 'Médico Gestor (Teste)',
    role: 'medico',
    subRole: 'medico_gestor',
    servico: 'internamento',
  },
  {
    num: '00012',
    nome: 'Cardiologista (Teste)',
    role: 'medico',
    subRole: 'cardiologista',
    servico: 'internamento',
  },
  {
    num: '00013',
    nome: 'Neurologista (Teste)',
    role: 'medico',
    subRole: 'neurologista',
    servico: 'internamento',
  },
  {
    num: '00014',
    nome: 'Supervisor Enfermagem (Teste)',
    role: 'enfermeiro',
    subRole: 'supervisor_enfermagem',
    servico: 'internamento',
  },
  {
    num: '00015',
    nome: 'Chefe Enfermeiros (Teste)',
    role: 'enfermeiro',
    subRole: 'chefe_enfermeiros',
    servico: 'internamento',
  },
  {
    num: '00016',
    nome: 'TAE (Teste)',
    role: 'tecnico_saude',
    subRole: 'tae',
    servico: 'transporte',
  },
  {
    num: '00017',
    nome: 'Técnico Radiologia (Teste)',
    role: 'tecnico_saude',
    subRole: 'tec_rad',
    servico: 'internamento',
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

  // ── 2. Criar os utilizadores de teste ──────────────────────────────────────
  console.log('► Criar utilizadores de teste...\n');
  let direcaoId = '';
  for (const u of UTILIZADORES) {
    const isClinico = ROLES_CLINICOS.includes(u.role);
    const criado = await prisma.utilizador.create({
      data: {
        numeroFuncionario: u.num,
        nome: u.nome,
        passwordHash: PASS_HASH,
        role: u.role,
        subRole: u.subRole,
        servico: u.servico as any,
        passwordExpiresAt: EXPIRES,
        // Roles clínicas ficam com MFA já activo e um segredo TOTP conhecido —
        // evita ter de fazer scan de QR code manualmente em cada teste automatizado.
        mfaAtivo: isClinico,
        mfaSecret: isClinico ? TOTP_SECRET_TESTE : null,
        ativo: true,
      },
    });
    if (u.role === 'direcao') direcaoId = criado.id;
    console.log(`  ✓  ${u.num}  ${u.role.padEnd(14)}  ${(u.subRole ?? '').padEnd(24)}  ${u.nome}`);
  }

  // ── 2.5. Doente de teste + acesso portal + acesso família ──────────────────
  console.log('\n► Criar doente de teste + acessos portal/família...\n');
  const doenteTeste = await prisma.doente.upsert({
    where: { numeroProcesso: 'TESTE-PORTAL-001' },
    update: {},
    create: {
      nome: 'Doente de Teste (Persona)',
      numeroProcesso: 'TESTE-PORTAL-001',
      dataNascimento: new Date('1980-01-01'),
      estado: 'estavel' as any,
      estadoRegisto: 'internado',
      ativo: true,
    },
  });
  console.log(`  ✓  Doente de teste: ${doenteTeste.nome} (${doenteTeste.numeroProcesso})`);

  const PORTAL_EMAIL = 'doente.teste@curasphere.local';
  await prisma.portalDoente.upsert({
    where: { doenteId: doenteTeste.id },
    update: { email: PORTAL_EMAIL, passwordHash: PASS_HASH },
    create: {
      doenteId: doenteTeste.id,
      email: PORTAL_EMAIL,
      passwordHash: PASS_HASH,
      criadoPorId: direcaoId,
    },
  });
  console.log(`  ✓  Portal do doente: ${PORTAL_EMAIL} / ${PASSWORD}`);

  let acessoFamiliar = await prisma.acessoFamiliar.findFirst({
    where: { doenteId: doenteTeste.id, ativo: true, accessTokenExpiry: { gt: new Date() } },
  });
  if (!acessoFamiliar) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    acessoFamiliar = await prisma.acessoFamiliar.create({
      data: {
        doenteId: doenteTeste.id,
        criadoPorId: direcaoId,
        nomeContacto: 'Familiar de Teste (Persona)',
        email: 'familia.teste@curasphere.local',
        accessTokenExpiry: expiry,
      },
    });
  }
  console.log(`  ✓  Acesso família: token=${acessoFamiliar.accessToken} (expira ${acessoFamiliar.accessTokenExpiry.toISOString().slice(0, 10)})`);

  // ── 3. Resumo final ────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(` Password de todos (staff + portal): ${PASSWORD}`);
  console.log('══════════════════════════════════════════════════');
  console.log('\n  ROLES SEM MFA (login directo):');
  console.log('  00001  direcao        ceo_hospitalar          — acesso total (oversight)');
  console.log('  00007  administrativo front_desk              — recepção, faturação');
  console.log('  00008  operacional    facilities               — logística, transporte');
  console.log('  00009  ti             it_admin                 — incidentes TI, configurações');
  console.log('  00010  qualidade      quality_manager          — auditoria, conformidade');
  console.log('\n  ROLES CLÍNICOS — MFA já activo, segredo TOTP conhecido (ver abaixo):');
  console.log('  00002  medico         clinico_geral            — prescrições, consultas, alta');
  console.log('  00003  enfermeiro     generalista              — notas turno, medicação, sinais vitais');
  console.log('  00004  auxiliar       apoio_geral              — apoio geral');
  console.log('  00005  tecnico_saude  reabilitacao_fisica      — fisioterapia, reabilitação');
  console.log('  00006  farmaceutico   farmaceutico_hospitalar  — farmácia, stock, MAR');
  console.log('\n  SUB-ROLES PRIVILEGIADOS (permissões diferenciadas nos guards da API):');
  console.log('  00011  medico         medico_gestor            — gestão de serviço clínico');
  console.log('  00012  medico         cardiologista            — especialidade cardiologia');
  console.log('  00013  medico         neurologista             — especialidade neurologia');
  console.log('  00014  enfermeiro     supervisor_enfermagem    — supervisão de enfermagem');
  console.log('  00015  enfermeiro     chefe_enfermeiros        — chefia de enfermagem');
  console.log('  00016  tecnico_saude  tae                      — técnico ambulância emergência');
  console.log('  00017  tecnico_saude  tec_rad                  — técnico radiologia');
  console.log('\n  MFA (todas as roles clínicas acima) — segredo TOTP fixo de teste:');
  console.log(`  Secret: ${TOTP_SECRET_TESTE}`);
  console.log('  Gerar código válido: cd apps/api && node -e "require(\'otplib\').generate({secret:\'' + TOTP_SECRET_TESTE + '\'}).then(c=>console.log(c))"');
  console.log('\n  PORTAL DO DOENTE:');
  console.log(`  Email: doente.teste@curasphere.local  /  Password: ${PASSWORD}`);
  console.log('\n  ACESSO FAMÍLIA (link directo, sem login):');
  console.log(`  /familia/${acessoFamiliar.accessToken}`);
  console.log(`  (expira ${acessoFamiliar.accessTokenExpiry.toISOString().slice(0, 10)} — reexecutar este script gera um novo se expirado)\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

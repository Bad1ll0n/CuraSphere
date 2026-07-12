/**
 * Seed de dados de demonstração — Hospital CuraSphere
 * Executar: cd apps/api && npx ts-node src/prisma/seed-demo.ts
 *
 * Cria utilizadores, camas, doentes, tarefas, turnos, stock e incidentes TI.
 * É idempotente: re-executar atualiza sem duplicar.
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

try { process.loadEnvFile(); } catch {}
const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const PASS = bcrypt.hashSync('demo1234', 10);

// ─────────────────────────── UTILIZADORES ───────────────────────────
const UTILIZADORES = [
  // Médicos
  { num: 'MD001', nome: 'Dr. Miguel Fernandes',     role: 'medico',        subRole: 'clinico_geral',    servico: 'internamento', ordem: 1 },
  { num: 'MD002', nome: 'Dra. Inês Rodrigues',      role: 'medico',        subRole: 'cardiologista',    servico: 'internamento', ordem: 2 },
  { num: 'MD003', nome: 'Dr. Pedro Gonçalves',      role: 'medico',        subRole: 'cirurgiao_geral',  servico: 'bloco_operatorio', ordem: 3 },
  { num: 'MD004', nome: 'Dra. Sofia Martins',       role: 'medico',        subRole: 'clinico_geral',    servico: 'urgencia',     ordem: 4 },
  // Enfermeiros
  { num: 'EN001', nome: 'Enf. Ana Costa',           role: 'enfermeiro',    subRole: 'generalista',      servico: 'internamento', ordem: 1 },
  { num: 'EN002', nome: 'Enf. João Silva',          role: 'enfermeiro',    subRole: 'generalista',      servico: 'internamento', ordem: 2 },
  { num: 'EN003', nome: 'Enf. Marta Pereira',       role: 'enfermeiro',    subRole: 'triador',          servico: 'urgencia',     ordem: 3 },
  { num: 'EN004', nome: 'Enf. Carlos Lopes',        role: 'enfermeiro',    subRole: 'supervisor_enfermagem', servico: 'internamento', ordem: 4 },
  // Auxiliares
  { num: 'AX001', nome: 'Aux. Maria Santos',        role: 'auxiliar',      subRole: 'apoio_geral',      servico: 'internamento', ordem: 1 },
  { num: 'AX002', nome: 'Aux. Rui Alves',           role: 'auxiliar',      subRole: 'apoio_geral',      servico: 'internamento', ordem: 2 },
  // Técnico de Saúde
  { num: 'TS001', nome: 'Tec. Luísa Carvalho',      role: 'tecnico_saude', subRole: 'reabilitacao_fisica', servico: 'internamento', ordem: 1 },
  // Farmacêutico
  { num: 'FM001', nome: 'Farm. António Neves',      role: 'farmaceutico',  subRole: 'farmaceutico_hospitalar', servico: 'internamento', ordem: 1 },
  // Administrativo
  { num: 'AD001', nome: 'Rec. Beatriz Moreira',     role: 'administrativo', subRole: 'front_desk',      servico: 'urgencia',     ordem: 1 },
  { num: 'AD002', nome: 'Sec. Filipe Araújo',       role: 'administrativo', subRole: 'secretariado',    servico: 'internamento', ordem: 2 },
  // TI
  { num: 'TI001', nome: 'IT Admin Paulo Rocha',     role: 'ti',            subRole: 'it_admin',         servico: 'internamento', ordem: 1 },
  // Qualidade
  { num: 'QA001', nome: 'Qual. Teresa Monteiro',    role: 'qualidade',     subRole: 'quality_manager',  servico: 'internamento', ordem: 1 },
  // Direção
  { num: 'DR001', nome: 'Dir. Manuel Azevedo',      role: 'direcao',       subRole: 'ceo_hospitalar',   servico: 'internamento', ordem: 1 },
  // Operacional
  { num: 'OP001', nome: 'Op. Bruno Figueiredo',     role: 'operacional',   subRole: 'facilities',       servico: 'internamento', ordem: 1 },
];

// ─────────────────────────── CAMAS ───────────────────────────
const CAMAS = [
  // Quarto A
  { numero: 'A1', quarto: 'A', servico: 'internamento' },
  { numero: 'A2', quarto: 'A', servico: 'internamento' },
  { numero: 'A3', quarto: 'A', servico: 'internamento' },
  { numero: 'A4', quarto: 'A', servico: 'internamento' },
  // Quarto B
  { numero: 'B1', quarto: 'B', servico: 'internamento' },
  { numero: 'B2', quarto: 'B', servico: 'internamento' },
  { numero: 'B3', quarto: 'B', servico: 'internamento' },
  { numero: 'B4', quarto: 'B', servico: 'internamento' },
  // UCI
  { numero: 'UCI1', quarto: 'UCI', servico: 'uci' },
  { numero: 'UCI2', quarto: 'UCI', servico: 'uci' },
  // Urgência
  { numero: 'U1', quarto: 'URG', servico: 'urgencia' },
  { numero: 'U2', quarto: 'URG', servico: 'urgencia' },
  { numero: 'U3', quarto: 'URG', servico: 'urgencia' },
];

// ─────────────────────────── DOENTES ───────────────────────────
const DOENTES = [
  { nome: 'Francisco Melo',    dataNascimento: '1945-03-12', diagnostico: 'Insuficiência Cardíaca Congestiva', estado: 'grave',   cama: 'A1' },
  { nome: 'Helena Carvalho',   dataNascimento: '1958-07-22', diagnostico: 'DPOC Exacerbada',                   estado: 'estavel', cama: 'A2' },
  { nome: 'António Ferreira',  dataNascimento: '1962-11-05', diagnostico: 'AVC Isquémico',                     estado: 'grave',   cama: 'A3' },
  { nome: 'Rosa Pinheiro',     dataNascimento: '1975-04-18', diagnostico: 'Pneumonia Adquirida na Comunidade',  estado: 'estavel', cama: 'A4' },
  { nome: 'Joaquim Oliveira',  dataNascimento: '1940-09-30', diagnostico: 'Neoplasia do Cólon — Pós-cirurgia', estado: 'estavel', cama: 'B1' },
  { nome: 'Lurdes Teixeira',   dataNascimento: '1983-02-14', diagnostico: 'Diabete Mellitus Descompensada',    estado: 'estavel', cama: 'B2' },
  { nome: 'Manuel Sousa',      dataNascimento: '1950-06-28', diagnostico: 'Sepsis — Origem Urinária',         estado: 'critico', cama: 'UCI1' },
  { nome: 'Graça Mendes',      dataNascimento: '1967-12-03', diagnostico: 'Tromboembolismo Pulmonar',          estado: 'grave',   cama: 'B3' },
];

// ─────────────────────────── STOCK FARMÁCIA ───────────────────────────
const STOCK = [
  { nome: 'Paracetamol 1g IV', tipo: 'medicamento', quantidade: 240, unidade: 'amp', minimo: 50, servico: 'internamento' },
  { nome: 'Amoxicilina 1g IV', tipo: 'medicamento', quantidade: 80, unidade: 'frs', minimo: 30, servico: 'internamento' },
  { nome: 'Heparina 5000 UI/ml', tipo: 'medicamento', quantidade: 120, unidade: 'amp', minimo: 40, servico: 'internamento' },
  { nome: 'Metoclopramida 10mg', tipo: 'medicamento', quantidade: 200, unidade: 'amp', minimo: 60, servico: 'internamento' },
  { nome: 'Omeprazol 40mg IV', tipo: 'medicamento', quantidade: 18, unidade: 'frs', minimo: 20, servico: 'internamento' },
  { nome: 'Furosemida 20mg IV', tipo: 'medicamento', quantidade: 150, unidade: 'amp', minimo: 40, servico: 'internamento' },
  { nome: 'Insulina Regular', tipo: 'medicamento', quantidade: 12, unidade: 'frs', minimo: 15, servico: 'internamento' },
  { nome: 'NaCl 0,9% 500ml', tipo: 'material', quantidade: 95, unidade: 'saco', minimo: 50, servico: 'internamento' },
  { nome: 'Midazolam 5mg/ml', tipo: 'medicamento', quantidade: 35, unidade: 'amp', minimo: 20, servico: 'uci' },
  { nome: 'Adrenalina 1mg/ml', tipo: 'medicamento', quantidade: 8, unidade: 'amp', minimo: 10, servico: 'urgencia' },
];

// ─────────────────────────── INCIDENTES TI ───────────────────────────
const INCIDENTES_TI = [
  { tipo: 'infraestrutura', titulo: 'Monitor UCI1 sem imagem', descricao: 'Monitor de monitorização da cama UCI1 apresenta ecrã preto desde as 06h00.', prioridade: 'critica', estado: 'aberto' },
  { tipo: 'his_erp', titulo: 'HIS lento no módulo de prescrição', descricao: 'Médicos reportam que o módulo de prescrição demora >10s a carregar.', prioridade: 'alta', estado: 'aberto' },
  { tipo: 'rede', titulo: 'WiFi intermitente no Quarto B', descricao: 'Tablets de enfermagem no Quarto B perdem conectividade esporadicamente.', prioridade: 'media', estado: 'aberto' },
  { tipo: 'seguranca', titulo: 'Conta bloqueada — Enf. João Silva', descricao: 'Utilizador EN002 não consegue fazer login após troca de turno.', prioridade: 'alta', estado: 'resolvido' },
];

// ─────────────────────────── ANÚNCIOS ───────────────────────────
const ANUNCIOS = [
  { titulo: 'Simulacro de Emergência — 5 de Maio', texto: 'Recorda-se que no próximo dia 5 de maio decorrerá o simulacro anual de emergência. A participação de todos os profissionais é obrigatória.' },
  { titulo: 'Atualização do HIS — Janela de Manutenção', texto: 'O sistema HIS estará em manutenção programada este sábado entre as 02h00 e as 04h00. Prevê-se interrupção do acesso ao módulo de prescrição.' },
  { titulo: 'Boas Práticas de Higienização das Mãos', texto: 'Semana da Higiene das Mãos: lembre-se dos 5 momentos. Estações de gel disponíveis em todos os corredores.' },
];

// ─────────────────────────── MAIN ───────────────────────────
const ROLES_CONFIG = [
  { chave: 'medico', label: 'Médico', categoria: 'clinico', ordem: 1,
    subRoles: [
      { chave: 'clinico_geral',         label: 'Clínico Geral',         ordem: 1 },
      { chave: 'cardiologista',         label: 'Cardiologista',          ordem: 2 },
      { chave: 'neurologista',          label: 'Neurologista',           ordem: 3 },
      { chave: 'ortopedista',           label: 'Ortopedista',            ordem: 4 },
      { chave: 'pediatra',              label: 'Pediatra',               ordem: 5 },
      { chave: 'oncologista',           label: 'Oncologista',            ordem: 6 },
      { chave: 'pneumologista',         label: 'Pneumologista',          ordem: 7 },
      { chave: 'gastroenterologista',   label: 'Gastroenterologista',    ordem: 8 },
      { chave: 'nefrologista',          label: 'Nefrologista',           ordem: 9 },
      { chave: 'dermatologista',        label: 'Dermatologista',         ordem: 10 },
      { chave: 'psiquiatra',            label: 'Psiquiatra',             ordem: 11 },
      { chave: 'endocrinologista',      label: 'Endocrinologista',       ordem: 12 },
      { chave: 'reumatologista',        label: 'Reumatologista',         ordem: 13 },
      { chave: 'cirurgiao_geral',       label: 'Cirurgião Geral',        ordem: 14 },
      { chave: 'cirurgiao_vascular',    label: 'Cirurgião Vascular',     ordem: 15 },
      { chave: 'cirurgiao_toracico',    label: 'Cirurgião Torácico',     ordem: 16 },
      { chave: 'neurocirurgiao',        label: 'Neurocirurgião',         ordem: 17 },
      { chave: 'cirurgiao_pediatrico',  label: 'Cirurgião Pediátrico',   ordem: 18 },
      { chave: 'medico_anestesia',      label: 'Anestesista',            ordem: 19 },
      { chave: 'medico_imagem',         label: 'Médico de Imagem',       ordem: 20 },
      { chave: 'anatomia_patologica',   label: 'Anatomia Patológica',    ordem: 21 },
      { chave: 'medico_gestor',         label: 'Médico Gestor',          ordem: 22 },
      { chave: 'diretor_medico',        label: 'Diretor Médico',         ordem: 23 },
    ]},
  { chave: 'enfermeiro', label: 'Enfermeiro', categoria: 'clinico', ordem: 2,
    subRoles: [
      { chave: 'generalista',           label: 'Generalista',            ordem: 1 },
      { chave: 'enf_bloco',             label: 'Enf. Bloco',             ordem: 2 },
      { chave: 'enf_uci',               label: 'Enf. UCI',               ordem: 3 },
      { chave: 'enf_urgencia',          label: 'Enf. Urgência',          ordem: 4 },
      { chave: 'enf_pediatria',         label: 'Enf. Pediatria',         ordem: 5 },
      { chave: 'enf_oncologia',         label: 'Enf. Oncologia',         ordem: 6 },
      { chave: 'enf_saude_mental',      label: 'Enf. Saúde Mental',      ordem: 7 },
      { chave: 'enf_geriatria',         label: 'Enf. Geriatria',         ordem: 8 },
      { chave: 'enf_neonatologia',      label: 'Enf. Neonatologia',      ordem: 9 },
      { chave: 'supervisor_enfermagem', label: 'Supervisor de Enfermagem', ordem: 10 },
      { chave: 'triador',               label: 'Triador',                ordem: 11 },
      { chave: 'instrumentista',        label: 'Instrumentista',         ordem: 12 },
      { chave: 'head_nurse',            label: 'Head Nurse',             ordem: 13 },
    ]},
  { chave: 'auxiliar', label: 'Auxiliar', categoria: 'clinico', ordem: 3,
    subRoles: [
      { chave: 'apoio_geral', label: 'Apoio Geral', ordem: 1 },
    ]},
  { chave: 'tecnico_saude', label: 'Técnico de Saúde', categoria: 'clinico', ordem: 4,
    subRoles: [
      { chave: 'tae',                label: 'TAE',                   ordem: 1 },
      { chave: 'reabilitacao_fisica', label: 'Reabilitação Física',  ordem: 2 },
      { chave: 'reabilitacao_fala',  label: 'Reabilitação da Fala',  ordem: 3 },
      { chave: 'nutricao_clinica',   label: 'Nutrição Clínica',       ordem: 4 },
      { chave: 'psicologia_clinica', label: 'Psicologia Clínica',     ordem: 5 },
      { chave: 'medico_trabalho',    label: 'Médico do Trabalho',     ordem: 6 },
    ]},
  { chave: 'farmaceutico', label: 'Farmacêutico', categoria: 'clinico', ordem: 5,
    subRoles: [
      { chave: 'farmaceutico_hospitalar', label: 'Farmacêutico Hospitalar', ordem: 1 },
      { chave: 'farmaceutico_oncologico', label: 'Farmacêutico Oncológico', ordem: 2 },
      { chave: 'tecnico_farmacia_assist', label: 'Técnico de Farmácia',     ordem: 3 },
    ]},
  { chave: 'administrativo', label: 'Administrativo', categoria: 'gestao', ordem: 6,
    subRoles: [
      { chave: 'front_desk',     label: 'Front Desk',     ordem: 1 },
      { chave: 'secretariado',   label: 'Secretariado',   ordem: 2 },
      { chave: 'backoffice',     label: 'Backoffice',     ordem: 3 },
      { chave: 'scheduling',     label: 'Scheduling',     ordem: 4 },
      { chave: 'billing_officer',label: 'Billing Officer', ordem: 5 },
      { chave: 'hr_specialist',  label: 'HR Specialist',  ordem: 6 },
      { chave: 'procurement',    label: 'Procurement',    ordem: 7 },
      { chave: 'cfo',            label: 'CFO',            ordem: 8 },
      { chave: 'coo',            label: 'COO',            ordem: 9 },
      { chave: 'hr_director',    label: 'HR Director',    ordem: 10 },
    ]},
  { chave: 'operacional', label: 'Operacional', categoria: 'suporte', ordem: 7,
    subRoles: [
      { chave: 'transporte_interno',   label: 'Transporte Interno',   ordem: 1 },
      { chave: 'cssd',                 label: 'CSSD',                 ordem: 2 },
      { chave: 'higiene_hospitalar',   label: 'Higiene Hospitalar',   ordem: 3 },
      { chave: 'gestao_textil',        label: 'Gestão Têxtil',        ordem: 4 },
      { chave: 'equipamentos_medicos', label: 'Equipamentos Médicos', ordem: 5 },
      { chave: 'facilities',           label: 'Facilities',           ordem: 6 },
      { chave: 'vigilancia',           label: 'Vigilância',           ordem: 7 },
      { chave: 'seguranca_trabalho',   label: 'Segurança no Trabalho', ordem: 8 },
    ]},
  { chave: 'ti', label: 'Tecnologias de Informação', categoria: 'ti', ordem: 8,
    subRoles: [
      { chave: 'it_admin',         label: 'IT Admin',         ordem: 1 },
      { chave: 'cio',              label: 'CIO',              ordem: 2 },
      { chave: 'his_erp',          label: 'HIS/ERP',          ordem: 3 },
      { chave: 'database_admin',   label: 'Database Admin',   ordem: 4 },
      { chave: 'security_officer', label: 'Security Officer', ordem: 5 },
      { chave: 'dados_clinicos',   label: 'Dados Clínicos',   ordem: 6 },
    ]},
  { chave: 'qualidade', label: 'Qualidade', categoria: 'gestao', ordem: 9,
    subRoles: [
      { chave: 'quality_manager',    label: 'Quality Manager',    ordem: 1 },
      { chave: 'compliance',         label: 'Compliance',         ordem: 2 },
      { chave: 'infection_control',  label: 'Infection Control',  ordem: 3 },
      { chave: 'internal_audit',     label: 'Internal Audit',     ordem: 4 },
      { chave: 'dpo_role',           label: 'DPO',                ordem: 5 },
      { chave: 'compliance_director',label: 'Compliance Director', ordem: 6 },
    ]},
  { chave: 'direcao', label: 'Direção', categoria: 'gestao', ordem: 10,
    subRoles: [
      { chave: 'ceo_hospitalar', label: 'CEO Hospitalar', ordem: 1 },
      // diretor_medico → medico; head_nurse → enfermeiro; cfo/coo/hr_director → administrativo
    ]},
];

async function main() {
  console.log('🏥  Seed de demo CuraSphere...\n');

  // 0. Roles e SubRoles
  console.log('🔑  Roles e SubRoles...');
  for (const r of ROLES_CONFIG) {
    await prisma.roleConfig.upsert({
      where: { chave: r.chave },
      update: { label: r.label, categoria: r.categoria, ordem: r.ordem },
      create: { chave: r.chave, label: r.label, categoria: r.categoria, ordem: r.ordem },
    });
    for (const sr of r.subRoles) {
      await prisma.subRoleConfig.upsert({
        where: { chave: sr.chave },
        update: { label: sr.label, ordem: sr.ordem, roleChave: r.chave },
        create: { chave: sr.chave, label: sr.label, roleChave: r.chave, ordem: sr.ordem },
      });
    }
  }
  console.log(`   ✓ ${ROLES_CONFIG.length} roles + sub-roles`);

  // 1. Utilizadores
  console.log('👤  Utilizadores...');
  const utilizadorMap: Record<string, string> = {};
  for (const u of UTILIZADORES) {
    const criado = await prisma.utilizador.upsert({
      where: { numeroFuncionario: u.num },
      update: { nome: u.nome, role: u.role, subRole: u.subRole, servico: u.servico as any, ordemExperiencia: u.ordem },
      create: {
        numeroFuncionario: u.num,
        nome: u.nome,
        passwordHash: PASS,
        role: u.role,
        subRole: u.subRole,
        servico: u.servico as any,
        ordemExperiencia: u.ordem,
      },
    });
    utilizadorMap[u.num] = criado.id;
  }
  console.log(`   ✓ ${UTILIZADORES.length} utilizadores`);

  // 2. Camas
  console.log('🛏️   Camas...');
  const camaMap: Record<string, string> = {};
  for (const c of CAMAS) {
    const cama = await prisma.cama.upsert({
      where: { numero: c.numero },
      update: { quarto: c.quarto },
      create: { numero: c.numero, quarto: c.quarto, estado: 'livre' },
    });
    camaMap[c.numero] = cama.id;
  }
  console.log(`   ✓ ${CAMAS.length} camas`);

  // 3. Doentes
  console.log('🧑‍⚕️  Doentes...');
  const doenteMap: Record<string, string> = {};
  const admissaoId = utilizadorMap['AD001'] ?? utilizadorMap['EN001'];
  for (const d of DOENTES) {
    const camaId = camaMap[d.cama];
    if (!camaId) { console.warn(`   ⚠ Cama ${d.cama} não encontrada para ${d.nome}`); continue; }

    const existente = await prisma.doente.findFirst({ where: { nome: d.nome, ativo: true } });
    let doenteId: string;
    if (existente) {
      doenteId = existente.id;
    } else {
      const doente = await prisma.doente.create({
        data: {
          nome: d.nome,
          dataNascimento: new Date(d.dataNascimento),
          numeroProcesso: `P${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`,
          diagnosticoPrincipal: d.diagnostico,
          estado: d.estado as any,
          estadoRegisto: 'internado',
          camaId,
          administrativoAdmissaoId: admissaoId,
          dataAltaPrevista: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        },
      });
      doenteId = doente.id;
      // Marcar cama como ocupada
      await prisma.cama.update({ where: { id: camaId }, data: { estado: 'ocupada' } });
    }
    doenteMap[d.nome] = doenteId;
  }
  console.log(`   ✓ ${Object.keys(doenteMap).length} doentes`);

  // 4. Sinais Vitais para cada doente
  console.log('📊  Sinais vitais...');
  let svCount = 0;
  for (const [, doenteId] of Object.entries(doenteMap)) {
    const existente = await prisma.sinalVital.findFirst({ where: { doenteId } });
    if (existente) continue;
    await prisma.sinalVital.create({
      data: {
        doenteId,
        temperatura: 36.8 + Math.random() * 2,
        pressaoSistolica: 110 + Math.floor(Math.random() * 50),
        pressaoDiastolica: 65 + Math.floor(Math.random() * 30),
        pulso: 70 + Math.floor(Math.random() * 30),
        frequenciaRespiratoria: 16 + Math.floor(Math.random() * 6),
        saturacaoO2: 94 + Math.floor(Math.random() * 6),
        registadoPorId: utilizadorMap['EN001'],
      },
    });
    svCount++;
  }
  console.log(`   ✓ ${svCount} registos de sinais vitais`);

  // 5. Tarefas clínicas
  console.log('✅  Tarefas...');
  const tarefasPorCriar = [
    { doente: 'Francisco Melo',   tipo: 'clinica',   descricao: 'Verificar peso e balanço hídrico — diurético EV iniciado',   prioridade: 'urgente', grupo: 'enfermeiro' },
    { doente: 'António Ferreira', tipo: 'clinica',   descricao: 'Avaliação neurológica — escala NIHSS às 14h',                 prioridade: 'alta',    grupo: 'medico' },
    { doente: 'Manuel Sousa',     tipo: 'clinica',   descricao: 'Colheita de hemoculturas — repico por febre 39.2°C',          prioridade: 'urgente', grupo: 'enfermeiro' },
    { doente: 'Graça Mendes',     tipo: 'clinica',   descricao: 'Administrar anticoagulação EV — ajuste de dose prescrito',    prioridade: 'alta',    grupo: 'enfermeiro' },
    { doente: 'Lurdes Teixeira',  tipo: 'clinica',   descricao: 'Controlo glicémico às 08h, 12h e 18h',                       prioridade: 'media',   grupo: 'enfermeiro' },
    { doente: 'Helena Carvalho',  tipo: 'logistica', descricao: 'Solicitar transporte para TAC — urgente',                    prioridade: 'alta',    grupo: 'auxiliar' },
    { doente: 'Rosa Pinheiro',    tipo: 'logistica', descricao: 'Entregar relatório de alta para assinatura',                 prioridade: 'baixa',   grupo: 'administrativo' },
  ];

  let tarefasCount = 0;
  for (const t of tarefasPorCriar) {
    const doenteId = doenteMap[t.doente];
    if (!doenteId) continue;
    const existente = await prisma.tarefa.findFirst({ where: { doenteId, descricao: t.descricao } });
    if (existente) continue;
    await prisma.tarefa.create({
      data: {
        doenteId,
        tipo: t.tipo as any,
        descricao: t.descricao,
        prioridade: t.prioridade as any,
        grupoResponsavel: t.grupo,
        criadoPorId: utilizadorMap['MD001'],
      },
    });
    tarefasCount++;
  }
  console.log(`   ✓ ${tarefasCount} tarefas`);

  // 6. Alertas clínicos
  console.log('🚨  Alertas clínicos...');
  const alertasPorCriar = [
    { doente: 'Manuel Sousa',     tipo: 'sepsis',          mensagem: 'Critérios de sépsis: febre 39.2°C, FC 118, FR 24, Lactato 3.2 mmol/L' },
    { doente: 'Francisco Melo',   tipo: 'pressao_alta',    mensagem: 'TA 178/105 mmHg — reavaliação em 30 minutos' },
    { doente: 'António Ferreira', tipo: 'neurologico',     mensagem: 'NIHSS 14 — deterioração neurológica vs. baseline 10' },
  ];
  let alertasCount = 0;
  for (const a of alertasPorCriar) {
    const doenteId = doenteMap[a.doente];
    if (!doenteId) continue;
    const existente = await prisma.alertaClinico.findFirst({ where: { doenteId, tipo: a.tipo } });
    if (existente) continue;
    await prisma.alertaClinico.create({ data: { doenteId, tipo: a.tipo, mensagem: a.mensagem } });
    alertasCount++;
  }
  console.log(`   ✓ ${alertasCount} alertas`);

  // 7. Stock Farmácia
  console.log('💊  Stock farmácia...');
  let stockCount = 0;
  for (const s of STOCK) {
    const existente = await prisma.stockItem.findFirst({ where: { nome: s.nome } });
    if (existente) { await prisma.stockItem.update({ where: { id: existente.id }, data: { quantidade: s.quantidade } }); continue; }
    await prisma.stockItem.create({ data: { nome: s.nome, tipo: s.tipo as any, quantidade: s.quantidade, unidade: s.unidade, quantidadeMinima: s.minimo, servico: s.servico } });
    stockCount++;
  }
  console.log(`   ✓ ${stockCount} itens de stock (${STOCK.filter(s => s.quantidade <= s.minimo).length} abaixo do mínimo)`);

  // 8. Incidentes TI
  console.log('🖥️   Incidentes TI...');
  const tiId = utilizadorMap['TI001'];
  let incidentesCount = 0;
  for (const i of INCIDENTES_TI) {
    const existente = await prisma.incidenteTI.findFirst({ where: { titulo: i.titulo } });
    if (existente) continue;
    await prisma.incidenteTI.create({
      data: {
        tipo: i.tipo as any,
        titulo: i.titulo,
        descricao: i.descricao,
        prioridade: i.prioridade as any,
        estado: i.estado as any,
        criadoPorId: tiId,
      },
    });
    incidentesCount++;
  }
  console.log(`   ✓ ${incidentesCount} incidentes TI`);

  // 9. Anúncios
  console.log('📢  Anúncios...');
  const autorAnuncio = utilizadorMap['TI001'];
  let anunciosCount = 0;
  for (const a of ANUNCIOS) {
    const existente = await prisma.anuncio.findFirst({ where: { titulo: a.titulo } });
    if (existente) continue;
    await prisma.anuncio.create({
      data: { titulo: a.titulo, texto: a.texto, autorId: autorAnuncio },
    });
    anunciosCount++;
  }
  console.log(`   ✓ ${anunciosCount} anúncios`);

  // Nota: agendas dos médicos são configuradas através da UI (Utilizadores → Editar → Agenda)

  console.log('\n✅  Seed de demo concluído!');
  console.log('\n🔑  Credenciais de acesso (password: demo1234):');
  for (const u of UTILIZADORES.slice(0, 6)) {
    console.log(`   ${u.num.padEnd(8)} ${u.nome.padEnd(30)} ${u.role}/${u.subRole}`);
  }
  console.log('   ...');
}

main()
  .catch((e) => { console.error('❌  Erro no seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

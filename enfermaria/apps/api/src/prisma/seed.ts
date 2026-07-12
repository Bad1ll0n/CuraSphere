import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

try { process.loadEnvFile(); } catch {}
const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ROLES = [
  { chave: 'medico',         label: 'Médico',          categoria: 'clinico', ordem: 1 },
  { chave: 'enfermeiro',     label: 'Enfermeiro',       categoria: 'clinico', ordem: 2 },
  { chave: 'auxiliar',       label: 'Auxiliar',         categoria: 'clinico', ordem: 3 },
  { chave: 'tecnico_saude',  label: 'Técnico de Saúde', categoria: 'clinico', ordem: 4 },
  { chave: 'farmaceutico',   label: 'Farmacêutico',     categoria: 'clinico', ordem: 5 },
  { chave: 'administrativo', label: 'Administrativo',   categoria: 'suporte', ordem: 6 },
  { chave: 'operacional',    label: 'Operacional',      categoria: 'suporte', ordem: 7 },
  { chave: 'ti',             label: 'Tecnologias de Informação', categoria: 'ti', ordem: 8 },
  { chave: 'qualidade',      label: 'Qualidade',        categoria: 'gestao', ordem: 9 },
  { chave: 'direcao',        label: 'Direção',          categoria: 'gestao', ordem: 10 },
];

const SUBROLES: Array<{ chave: string; label: string; roleChave: string; ordem: number }> = [
  // medico
  { chave: 'clinico_geral',       label: 'Clínico Geral',        roleChave: 'medico',         ordem: 1 },
  { chave: 'cirurgiao_geral',     label: 'Cirurgião Geral',      roleChave: 'medico',         ordem: 2 },
  { chave: 'medico_anestesia',    label: 'Anestesiologista',     roleChave: 'medico',         ordem: 3 },
  { chave: 'medico_imagem',       label: 'Radiologista',         roleChave: 'medico',         ordem: 4 },
  { chave: 'anatomia_patologica', label: 'Patologista',          roleChave: 'medico',         ordem: 5 },
  { chave: 'medico_gestor',       label: 'Médico Gestor',        roleChave: 'medico',         ordem: 6 },
  // enfermeiro
  { chave: 'generalista',             label: 'Generalista',             roleChave: 'enfermeiro', ordem: 1 },
  { chave: 'supervisor_enfermagem',   label: 'Supervisor de Enfermagem', roleChave: 'enfermeiro', ordem: 2 },
  { chave: 'triador',                 label: 'Triador',                 roleChave: 'enfermeiro', ordem: 3 },
  { chave: 'instrumentista',          label: 'Instrumentista',          roleChave: 'enfermeiro', ordem: 4 },
  // auxiliar
  { chave: 'apoio_geral', label: 'Apoio Geral', roleChave: 'auxiliar', ordem: 1 },
  // tecnico_saude
  { chave: 'tae',                label: 'TAE',                  roleChave: 'tecnico_saude', ordem: 1 },
  { chave: 'reabilitacao_fisica', label: 'Fisioterapeuta',      roleChave: 'tecnico_saude', ordem: 2 },
  { chave: 'reabilitacao_fala',  label: 'Terapeuta da Fala',   roleChave: 'tecnico_saude', ordem: 3 },
  { chave: 'nutricao_clinica',   label: 'Nutricionista',        roleChave: 'tecnico_saude', ordem: 4 },
  { chave: 'psicologia_clinica', label: 'Psicólogo Clínico',   roleChave: 'tecnico_saude', ordem: 5 },
  // farmaceutico
  { chave: 'farmaceutico_hospitalar',  label: 'Farmacêutico Hospitalar',  roleChave: 'farmaceutico', ordem: 1 },
  { chave: 'farmaceutico_oncologico',  label: 'Farmacêutico Oncológico',  roleChave: 'farmaceutico', ordem: 2 },
  { chave: 'tecnico_farmacia_assist',  label: 'Técnico de Farmácia',      roleChave: 'farmaceutico', ordem: 3 },
  // administrativo
  { chave: 'front_desk',   label: 'Rececionista',       roleChave: 'administrativo', ordem: 1 },
  { chave: 'secretariado', label: 'Secretário Clínico', roleChave: 'administrativo', ordem: 2 },
  { chave: 'backoffice',   label: 'Backoffice',         roleChave: 'administrativo', ordem: 3 },
  { chave: 'scheduling',   label: 'Gestão de Agenda',   roleChave: 'administrativo', ordem: 4 },
  { chave: 'billing_officer', label: 'Faturação',       roleChave: 'administrativo', ordem: 5 },
  { chave: 'hr_specialist',   label: 'RH Especialista', roleChave: 'administrativo', ordem: 6 },
  { chave: 'procurement',     label: 'Compras',          roleChave: 'administrativo', ordem: 7 },
  // operacional
  { chave: 'transporte_interno',  label: 'Maqueiro',              roleChave: 'operacional', ordem: 1 },
  { chave: 'cssd',                label: 'Esterilização (CSSD)',  roleChave: 'operacional', ordem: 2 },
  { chave: 'higiene_hospitalar',  label: 'Higiene Hospitalar',   roleChave: 'operacional', ordem: 3 },
  { chave: 'gestao_textil',       label: 'Lavandaria',           roleChave: 'operacional', ordem: 4 },
  { chave: 'equipamentos_medicos',label: 'Engenheiro Biomédico', roleChave: 'operacional', ordem: 5 },
  { chave: 'facilities',          label: 'Técnico de Manutenção',roleChave: 'operacional', ordem: 6 },
  { chave: 'vigilancia',          label: 'Segurança',            roleChave: 'operacional', ordem: 7 },
  { chave: 'seguranca_trabalho',  label: 'SST',                  roleChave: 'operacional', ordem: 8 },
  // ti
  { chave: 'it_admin',       label: 'IT Admin',            roleChave: 'ti', ordem: 1 },
  { chave: 'cio',            label: 'CIO',                 roleChave: 'ti', ordem: 2 },
  { chave: 'his_erp',        label: 'Analista de Sistemas',roleChave: 'ti', ordem: 3 },
  { chave: 'database_admin', label: 'DBA',                 roleChave: 'ti', ordem: 4 },
  { chave: 'security_officer',label: 'Cibersegurança',    roleChave: 'ti', ordem: 5 },
  { chave: 'dados_clinicos', label: 'BI / Dados Clínicos', roleChave: 'ti', ordem: 6 },
  // qualidade
  { chave: 'quality_manager',     label: 'Gestor de Qualidade',  roleChave: 'qualidade', ordem: 1 },
  { chave: 'compliance',          label: 'Compliance Officer',   roleChave: 'qualidade', ordem: 2 },
  { chave: 'infection_control',   label: 'Controlo de Infeção',  roleChave: 'qualidade', ordem: 3 },
  { chave: 'internal_audit',      label: 'Auditor Interno',      roleChave: 'qualidade', ordem: 4 },
  { chave: 'dpo_role',            label: 'DPO',                  roleChave: 'qualidade', ordem: 5 },
  { chave: 'compliance_director', label: 'Diretor de Qualidade', roleChave: 'qualidade', ordem: 6 },
  // direcao
  { chave: 'ceo_hospitalar', label: 'Diretor Geral',     roleChave: 'direcao', ordem: 1 },
  { chave: 'diretor_medico', label: 'Diretor Clínico',   roleChave: 'direcao', ordem: 2 },
  { chave: 'head_nurse',     label: 'Diretora de Enfermagem', roleChave: 'direcao', ordem: 3 },
  { chave: 'cfo',            label: 'Diretor Financeiro', roleChave: 'direcao', ordem: 4 },
  { chave: 'coo',            label: 'Diretor Operacional', roleChave: 'direcao', ordem: 5 },
  { chave: 'hr_director',    label: 'Diretor de RH',     roleChave: 'direcao', ordem: 6 },
];

async function main() {
  console.log('Seeding RoleConfig...');
  for (const r of ROLES) {
    await prisma.roleConfig.upsert({
      where: { chave: r.chave },
      update: { label: r.label, categoria: r.categoria, ordem: r.ordem },
      create: r,
    });
  }

  console.log('Seeding SubRoleConfig...');
  for (const s of SUBROLES) {
    await prisma.subRoleConfig.upsert({
      where: { chave: s.chave },
      update: { label: s.label, roleChave: s.roleChave, ordem: s.ordem },
      create: s,
    });
  }

  console.log('Seed concluído.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

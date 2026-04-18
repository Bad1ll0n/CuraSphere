'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../lib/auth-context';
import api from '../../lib/api';

// servicos: quais serviços vêem este item | roles: opcional, filtra dentro do serviço
const navItems = [
  // — Universal / Administrativo
  {
    href: '/dashboard',
    label: 'Dashboard',
    servicos: ['internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia', 'transporte', 'administrativo'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  // — Internamento
  {
    href: '/doentes',
    label: 'Doentes',
    servicos: ['internamento', 'administrativo'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/camas',
    label: 'Camas',
    servicos: ['internamento', 'administrativo'],
    roles: ['administrativo', 'chefe_enfermeiros', 'chefe_turno', 'chefe_medicos'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    href: '/horarios',
    label: 'Horários',
    servicos: ['internamento', 'administrativo'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/tarefas',
    label: 'Tarefas',
    servicos: ['internamento', 'urgencia', 'bloco_operatorio'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h.01M9 16h.01m6-4h-3" />
      </svg>
    ),
  },
  {
    href: '/trocas',
    label: 'Trocas de Turno',
    servicos: ['internamento'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    href: '/atribuicoes',
    label: 'Atribuições',
    servicos: ['internamento'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  // — Urgência
  {
    href: '/urgencia',
    label: 'Urgência',
    servicos: ['urgencia'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  // — Bloco Operatório
  {
    href: '/bloco',
    label: 'Bloco Operatório',
    servicos: ['bloco_operatorio'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
    ),
  },
  // — Consultas Externas
  {
    href: '/consultas',
    label: 'Consultas',
    servicos: ['consultas_externas'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  // — Farmácia
  {
    href: '/farmacia',
    label: 'Farmácia',
    servicos: ['farmacia'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  // — Fisioterapia
  {
    href: '/fisioterapia',
    label: 'Fisioterapia',
    servicos: ['fisioterapia'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  // — MAR (Medication Administration Record)
  {
    href: '/mar',
    label: 'MAR',
    servicos: ['internamento', 'urgencia'],
    roles: ['enfermeiro', 'enfermeiro_especialista', 'enfermeiro_gestor', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar_saude'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8l2 2 4-4" />
      </svg>
    ),
  },
  // — IACS
  {
    href: '/iacs',
    label: 'IACS',
    servicos: ['internamento', 'urgencia'],
    roles: ['medico', 'medico_especialista', 'chefe_medicos', 'enfermeiro', 'enfermeiro_especialista', 'chefe_enfermeiros', 'chefe_turno', 'enf_uci'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  // — Worklist Imagiologia
  {
    href: '/worklist',
    label: 'Worklist',
    servicos: ['internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia', 'transporte', 'administrativo'],
    roles: ['radiologista', 'patologista', 'tecnico', 'medico', 'medico_especialista', 'chefe_medicos', 'enfermeiro', 'enfermeiro_especialista', 'chefe_enfermeiros'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  // — Sala de Espera
  {
    href: '/sala-espera',
    label: 'Sala de Espera',
    servicos: ['consultas_externas', 'urgencia', 'internamento'],
    roles: ['administrativo', 'rececionista', 'chefe_turno', 'auxiliar_saude', 'medico', 'medico_especialista', 'enfermeiro', 'enfermeiro_especialista'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  // — Dashboard TI
  {
    href: '/dashboard-ti',
    label: 'Dashboard TI',
    servicos: ['internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia', 'transporte', 'administrativo'],
    roles: ['diretor_ti', 'administrativo', 'chefe_medicos', 'chefe_enfermeiros'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
    ),
  },
  // — Comunicação (todos os serviços)
  {
    href: '/comunicacao',
    label: 'Comunicação',
    servicos: ['internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia', 'transporte', 'administrativo'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  // — Pedidos Internos (transporte + administrativo)
  {
    href: '/pedidos-internos',
    label: 'Pedidos Internos',
    servicos: ['transporte', 'administrativo', 'internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia'],
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  // — TI
  {
    href: '/utilizadores',
    label: 'Utilizadores',
    servicos: null,
    roles: ['it_admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/auditoria',
    label: 'Auditoria',
    servicos: ['administrativo'],
    roles: ['administrativo'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const roleLabel: Record<string, string> = {
  // Direção
  diretor_geral:             'Diretor Geral',
  diretor_clinico:           'Diretor Clínico',
  diretor_enfermagem:        'Diretor de Enfermagem',
  diretor_financeiro:        'Diretor Financeiro',
  diretor_operacional:       'Diretor Operacional',
  diretor_rh:                'Diretor de RH',
  diretor_ti:                'Diretor de TI',
  diretor_qualidade:         'Diretor de Qualidade',
  // Clínico — Médicos
  medico:                    'Médico',
  medico_especialista:       'Médico Especialista',
  cirurgiao:                 'Cirurgião',
  anestesiologista:          'Anestesiologista',
  radiologista:              'Radiologista',
  patologista:               'Patologista',
  // Clínico — Enfermagem
  enfermeiro:                'Enfermeiro',
  enfermeiro_especialista:   'Enfermeiro Especialista',
  enfermeiro_gestor:         'Enfermeiro Gestor',
  // Clínico — Outros
  auxiliar_saude:            'Auxiliar de Saúde',
  tecnico:                   'Técnico',
  fisioterapeuta:            'Fisioterapeuta',
  terapeuta_fala:            'Terapeuta da Fala',
  nutricionista:             'Nutricionista',
  psicologo:                 'Psicólogo',
  // Farmácia
  farmaceutico:              'Farmacêutico',
  farmaceutico_clinico:      'Farmacêutico Clínico',
  tecnico_farmacia:          'Técnico de Farmácia',
  // Administrativo
  rececionista:              'Rececionista',
  secretario_clinico:        'Secretário Clínico',
  assistente_administrativo: 'Assistente Administrativo',
  gestor_agendamento:        'Gestor de Agendamento',
  faturacao:                 'Faturação',
  rh:                        'RH',
  compras:                   'Compras',
  // Operacional
  maqueiro:                  'Maqueiro',
  assistente_operacional:    'Assistente Operacional',
  esterilizacao:             'Esterilização',
  limpeza:                   'Limpeza',
  lavandaria:                'Lavandaria',
  // Engenharia / TI / Compliance
  engenheiro_biomedico:      'Engenheiro Biomédico',
  tecnico_manutencao:        'Técnico de Manutenção',
  seguranca:                 'Segurança',
  sst:                       'SST',
  it_admin:                  'IT Admin',
  analista_sistemas:         'Analista de Sistemas',
  dba:                       'DBA',
  ciberseguranca:            'Cibersegurança',
  bi_analyst:                'BI Analyst',
  dpo:                       'DPO',
  gestor_qualidade:          'Gestor de Qualidade',
  compliance_officer:        'Compliance Officer',
  controlo_infecao:          'Controlo de Infeção',
  auditor_interno:           'Auditor Interno',
  // Legado
  auxiliar:          'Auxiliar',
  administrativo:    'Administrativo',
  chefe_turno:       'Chefe de Turno',
  chefe_enfermeiros: 'Chefe de Enfermeiros',
  chefe_medicos:     'Chefe de Médicos',
  triador:           'Triador',
  anestesista:       'Anestesista',
  instrumentista:    'Instrumentista',
  secretaria:        'Secretária',
};

const subRoleLabel: Record<string, string> = {
  ceo_hospitalar: 'CEO Hospitalar', diretor_medico: 'Diretor Médico', head_nurse: 'Head Nurse',
  cfo: 'CFO', coo: 'COO', hr_director: 'HR Director', cio: 'CIO', compliance_director: 'Compliance Director',
  clinico_geral: 'Clínico Geral',
  cardiologista: 'Cardiologista', urologista: 'Urologista', ortopedista: 'Ortopedista',
  neurologista: 'Neurologista', ginecologista: 'Ginecologista', pediatra: 'Pediatra', oncologista: 'Oncologista',
  cirurgiao_geral: 'Cirurgião Geral', medico_anestesia: 'Médico Anestesia',
  medico_imagem: 'Médico Imagem', anatomia_patologica: 'Anatomia Patológica',
  generalista: 'Generalista',
  enf_uci: 'UCI', enf_bloco: 'Bloco Operatório', enf_obstetricia: 'Obstetrícia', enf_pediatria: 'Pediatria',
  supervisor_enfermagem: 'Supervisor',
  tae: 'TAE',
  tecnico_radiologia: 'Radiologia', tecnico_tac_rm: 'TAC/RM',
  tecnico_analises_clinicas: 'Análises Clínicas', tecnico_cardiopneumologia: 'Cardiopneumologia',
  reabilitacao_fisica: 'Reabilitação Física', reabilitacao_fala: 'Reabilitação Fala',
  nutricao_clinica: 'Nutrição Clínica', psicologia_clinica: 'Psicologia Clínica',
  farmaceutico_hospitalar: 'Hospitalar', farmaceutico_oncologico: 'Oncológico', tecnico_farmacia_assist: 'Assistente',
  front_desk: 'Front Desk', secretariado: 'Secretariado', backoffice: 'Backoffice',
  scheduling: 'Scheduling', billing_officer: 'Billing Officer', hr_specialist: 'HR Specialist', procurement: 'Procurement',
  transporte_interno: 'Transporte Interno', apoio_geral: 'Apoio Geral', cssd: 'CSSD',
  higiene_hospitalar: 'Higiene Hospitalar', gestao_textil: 'Gestão Têxtil',
  equipamentos_medicos: 'Equipamentos Médicos', facilities: 'Facilities',
  vigilancia: 'Vigilância', seguranca_trabalho: 'Segurança Trabalho',
  sysadmin: 'SysAdmin', his_erp: 'HIS/ERP', database_admin: 'Database Admin',
  security_officer: 'Security Officer', dados_clinicos: 'Dados Clínicos',
  dpo_role: 'DPO', quality_manager: 'Quality Manager', compliance: 'Compliance',
  infection_control: 'Infection Control', internal_audit: 'Internal Audit',
};

const servicoLabel: Record<string, string> = {
  internamento:        'Internamento',
  urgencia:            'Urgência',
  bloco_operatorio:    'Bloco Operatório',
  consultas_externas:  'Consultas Externas',
  farmacia:            'Farmácia',
  fisioterapia:        'Fisioterapia',
  transporte:          'Transporte',
  administrativo:      'Administrativo',
};

const roleColor: Record<string, string> = {
  // Direção
  diretor_geral: 'bg-yellow-500/15 text-yellow-400', diretor_clinico: 'bg-violet-500/15 text-violet-400',
  diretor_enfermagem: 'bg-teal-500/15 text-teal-400', diretor_financeiro: 'bg-emerald-500/15 text-emerald-400',
  diretor_operacional: 'bg-orange-500/15 text-orange-400', diretor_rh: 'bg-pink-500/15 text-pink-400',
  diretor_ti: 'bg-cyan-500/15 text-cyan-400', diretor_qualidade: 'bg-indigo-500/15 text-indigo-400',
  // Médicos
  medico: 'bg-violet-500/15 text-violet-400', medico_especialista: 'bg-purple-500/15 text-purple-400',
  cirurgiao: 'bg-red-500/15 text-red-400', anestesiologista: 'bg-indigo-500/15 text-indigo-400',
  radiologista: 'bg-blue-500/15 text-blue-400', patologista: 'bg-slate-500/15 text-slate-400',
  // Enfermagem
  enfermeiro: 'bg-teal-500/15 text-teal-400', enfermeiro_especialista: 'bg-cyan-500/15 text-cyan-400',
  enfermeiro_gestor: 'bg-blue-500/15 text-blue-400',
  // Outros clínicos
  auxiliar_saude: 'bg-slate-500/15 text-slate-400', tecnico: 'bg-sky-500/15 text-sky-400',
  fisioterapeuta: 'bg-lime-500/15 text-lime-400', terapeuta_fala: 'bg-green-500/15 text-green-400',
  nutricionista: 'bg-emerald-500/15 text-emerald-400', psicologo: 'bg-rose-500/15 text-rose-400',
  // Farmácia
  farmaceutico: 'bg-emerald-500/15 text-emerald-400', farmaceutico_clinico: 'bg-green-500/15 text-green-400',
  tecnico_farmacia: 'bg-teal-500/15 text-teal-400',
  // Administrativo
  rececionista: 'bg-pink-500/15 text-pink-400', secretario_clinico: 'bg-rose-500/15 text-rose-400',
  assistente_administrativo: 'bg-pink-500/15 text-pink-400', gestor_agendamento: 'bg-fuchsia-500/15 text-fuchsia-400',
  faturacao: 'bg-amber-500/15 text-amber-400', rh: 'bg-orange-500/15 text-orange-400',
  compras: 'bg-yellow-500/15 text-yellow-400',
  // Operacional
  maqueiro: 'bg-slate-500/15 text-slate-400', assistente_operacional: 'bg-slate-500/15 text-slate-400',
  esterilizacao: 'bg-blue-500/15 text-blue-400', limpeza: 'bg-sky-500/15 text-sky-400',
  lavandaria: 'bg-cyan-500/15 text-cyan-400',
  // TI / Compliance
  engenheiro_biomedico: 'bg-violet-500/15 text-violet-400', tecnico_manutencao: 'bg-slate-500/15 text-slate-400',
  seguranca: 'bg-red-500/15 text-red-400', sst: 'bg-orange-500/15 text-orange-400',
  it_admin: 'bg-cyan-500/15 text-cyan-400', analista_sistemas: 'bg-blue-500/15 text-blue-400',
  dba: 'bg-indigo-500/15 text-indigo-400', ciberseguranca: 'bg-red-500/15 text-red-400',
  bi_analyst: 'bg-purple-500/15 text-purple-400', dpo: 'bg-slate-500/15 text-slate-400',
  gestor_qualidade: 'bg-emerald-500/15 text-emerald-400', compliance_officer: 'bg-indigo-500/15 text-indigo-400',
  controlo_infecao: 'bg-orange-500/15 text-orange-400', auditor_interno: 'bg-amber-500/15 text-amber-400',
  // Legado
  auxiliar: 'bg-slate-500/15 text-slate-400', administrativo: 'bg-pink-500/15 text-pink-400',
  chefe_turno: 'bg-amber-500/15 text-amber-400', chefe_enfermeiros: 'bg-blue-500/15 text-blue-400',
  chefe_medicos: 'bg-purple-500/15 text-purple-400', triador: 'bg-orange-500/15 text-orange-400',
  anestesista: 'bg-indigo-500/15 text-indigo-400', instrumentista: 'bg-cyan-500/15 text-cyan-400',
  secretaria: 'bg-rose-500/15 text-rose-400',
};

function Avatar({ nome }: { nome: string }) {
  const initials = nome.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
      {initials}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { utilizador, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [modalPwd, setModalPwd] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoPwd, setSalvandoPwd] = useState(false);
  const [pwdErro, setPwdErro] = useState('');

  const alterarPassword = async () => {
    if (novaSenha !== confirmarSenha) { setPwdErro('As passwords não coincidem'); return; }
    if (novaSenha.length < 6) { setPwdErro('A nova password deve ter pelo menos 6 caracteres'); return; }
    setSalvandoPwd(true); setPwdErro('');
    try {
      await api.patch('/auth/alterar-password', { senhaAtual, novaSenha });
      setModalPwd(false); setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
      alert('Password alterada com sucesso!');
    } catch (e: any) {
      setPwdErro(e.response?.data?.message ?? 'Erro ao alterar password');
    } finally { setSalvandoPwd(false); }
  };

  useEffect(() => {
    if (!loading && !utilizador) router.push('/login');
  }, [utilizador, loading, router]);

  if (loading || !utilizador) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 text-slate-400">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">A carregar...</span>
      </div>
    </div>
  );

  const itemsVisiveis = navItems.filter((item) => {
    const servicoOk = item.servicos.includes(utilizador.servico ?? 'internamento');
    const roleOk = !item.roles || item.roles.includes(utilizador.role);
    return servicoOk && roleOk;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside aria-label="Navegação principal" className="w-64 shrink-0 bg-[#0f172a] flex flex-col border-r border-white/5">
        {/* Logo */}
        <div className="border-b border-white/5 flex items-center justify-center" style={{ paddingTop: '28px', paddingBottom: '24px' }}>
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="CuraSphere" width={36} height={36} />
            <div>
              <p className="text-white font-bold text-base leading-none tracking-tight">CuraSphere</p>
              <p className="text-slate-500 text-[10px] mt-1">Gestão Hospitalar</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ paddingTop: '28px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px' }}>
          <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest" style={{ marginBottom: '12px', paddingLeft: '12px' }}>Menu</p>
          {itemsVisiveis.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{ marginBottom: '8px', display: 'flex' }}
                className={`group items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`transition-colors ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                {item.label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Perfil */}
        <div className="border-t border-white/5" style={{ padding: '16px 20px' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1">
            <Avatar nome={utilizador.nome} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate leading-tight">{utilizador.nome}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${roleColor[utilizador.role] ?? 'bg-slate-500/15 text-slate-400'}`}>
                  {roleLabel[utilizador.role] ?? utilizador.role}
                </span>
                {utilizador.subRole && (
                  <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/8 text-slate-300">
                    {subRoleLabel[utilizador.subRole] ?? utilizador.subRole}
                  </span>
                )}
                {utilizador.servico && (
                  <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-500">
                    {servicoLabel[utilizador.servico] ?? utilizador.servico}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); setPwdErro(''); setModalPwd(true); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/5 rounded-xl text-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Alterar Password
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl text-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Terminar sessão
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Modal: Alterar Password */}
      {modalPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Alterar Password</h2>
              <button onClick={() => setModalPwd(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {(['Password Atual', 'Nova Password', 'Confirmar Nova Password'] as const).map((label, i) => {
              const val = i === 0 ? senhaAtual : i === 1 ? novaSenha : confirmarSenha;
              const setter = i === 0 ? setSenhaAtual : i === 1 ? setNovaSenha : setConfirmarSenha;
              return (
                <div key={label} style={{ marginBottom: '14px' }}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                  <input type="password" value={val} onChange={(e) => setter(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 14px' }} />
                </div>
              );
            })}
            {pwdErro && <p className="text-red-600 text-sm" style={{ marginBottom: '12px' }}>{pwdErro}</p>}
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setModalPwd(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={alterarPassword} disabled={salvandoPwd || !senhaAtual || !novaSenha || !confirmarSenha}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoPwd ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

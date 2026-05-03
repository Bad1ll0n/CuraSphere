'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../lib/auth-context';
import api from '../../lib/api';

// 10 roles-categoria fixas
const ROLES_MEDICO     = ['medico'];
const ROLES_ENFERMAGEM = ['enfermeiro', 'auxiliar'];
const ROLES_SAUDE      = ['tecnico_saude'];
const ROLES_FARMACIA   = ['farmaceutico'];
const ROLES_ADMIN      = ['administrativo'];
const ROLES_OPERACIONAL= ['operacional'];
const ROLES_TI         = ['ti'];
const ROLES_QUALIDADE  = ['qualidade'];
const ROLES_DIRECAO    = ['direcao'];
const ROLES_CLINICO    = [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_SAUDE, ...ROLES_FARMACIA];

const navItems = [
  // 1 — Dashboard
  {
    href: '/dashboard',
    label: 'Dashboard',
    servicos: null,
    roles: [...ROLES_CLINICO, ...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  // 2 — Doentes (clínico)
  {
    href: '/doentes',
    label: 'Doentes',
    servicos: null,
    roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_SAUDE],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  // 3 — Doentes (vista administrativa)
  {
    href: '/doentes-admin',
    label: 'Doentes',
    servicos: null,
    roles: [...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  // 4 — Urgência
  {
    href: '/urgencia',
    label: 'Urgência',
    servicos: ['urgencia'],
    roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  // 5 — MAR
  {
    href: '/mar',
    label: 'MAR',
    servicos: null,
    roles: [...ROLES_ENFERMAGEM],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8l2 2 4-4" />
      </svg>
    ),
  },
  // 6 — Atribuições
  {
    href: '/atribuicoes',
    label: 'Atribuições',
    servicos: null,
    roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  // 7 — Consultas Externas
  {
    href: '/consultas',
    label: 'Consultas',
    servicos: ['consultas_externas'],
    roles: [...ROLES_MEDICO, ...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  // 8 — Bloco Operatório
  {
    href: '/bloco',
    label: 'Bloco Operatório',
    servicos: ['bloco_operatorio'],
    roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
    ),
  },
  // 9 — Sala de Espera
  {
    href: '/sala-espera',
    label: 'Sala de Espera',
    servicos: ['urgencia'],
    roles: [...ROLES_ENFERMAGEM, ...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  // 10 — Camas
  {
    href: '/camas',
    label: 'Camas',
    servicos: ['internamento', 'urgencia'],
    roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  // 11 — Worklist Imagiologia
  {
    href: '/worklist',
    label: 'Worklist',
    servicos: null,
    roles: [...ROLES_SAUDE, ...ROLES_MEDICO],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  // 12 — IACS
  {
    href: '/iacs',
    label: 'IACS',
    servicos: null,
    roles: [...ROLES_MEDICO, ...ROLES_QUALIDADE, 'enfermeiro'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  // 13 — Tarefas
  {
    href: '/tarefas',
    label: 'Tarefas',
    servicos: null,
    roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_SAUDE, ...ROLES_OPERACIONAL],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h.01M9 16h.01m6-4h-3" />
      </svg>
    ),
  },
  // 14 — Trocas de Turno
  {
    href: '/trocas',
    label: 'Trocas de Turno',
    servicos: null,
    roles: [...ROLES_CLINICO],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  // 16 — Farmácia
  {
    href: '/farmacia',
    label: 'Farmácia',
    servicos: null,
    roles: [...ROLES_FARMACIA],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  // 17 — Fisioterapia
  {
    href: '/fisioterapia',
    label: 'Fisioterapia',
    servicos: null,
    roles: [...ROLES_SAUDE],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  // 18 — Receção / Filas
  {
    href: '/recepcao',
    label: 'Receção',
    servicos: null,
    excludeServicos: ['urgencia'],
    roles: [...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  // 19 — Registos Administrativos
  {
    href: '/registos-administrativos',
    label: 'Registos Admin.',
    servicos: null,
    excludeServicos: ['urgencia'],
    roles: [...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
      </svg>
    ),
  },
  // 20 — Faturação
  {
    href: '/faturacao',
    label: 'Faturação',
    servicos: null,
    roles: [...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  // 21 — Comunicação (universal)
  {
    href: '/comunicacao',
    label: 'Comunicação',
    servicos: null,
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  // 22 — Pedidos Internos
  {
    href: '/pedidos-internos',
    label: 'Pedidos Internos',
    servicos: null,
    roles: [...ROLES_CLINICO, ...ROLES_ADMIN, ...ROLES_OPERACIONAL],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  // 23 — Equipamentos
  {
    href: '/equipamentos',
    label: 'Equipamentos',
    servicos: null,
    roles: [...ROLES_OPERACIONAL, ...ROLES_TI, ...ROLES_DIRECAO],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
    ),
  },
  // 24 — Dashboard TI
  {
    href: '/dashboard-ti',
    label: 'Dashboard TI',
    servicos: null,
    roles: [...ROLES_TI, ...ROLES_DIRECAO],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
    ),
  },
  // 25 — Dashboard Qualidade
  {
    href: '/dashboard-qualidade',
    label: 'Dashboard Qualidade',
    servicos: null,
    roles: [...ROLES_QUALIDADE, ...ROLES_DIRECAO, ...ROLES_MEDICO, 'enfermeiro'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  // 26 — Pedidos TI
  {
    href: '/pedidos-ti',
    label: 'Pedidos TI',
    servicos: null,
    roles: [...ROLES_TI],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  // 27 — Incidentes TI
  {
    href: '/incidentes-ti',
    label: 'Incidentes TI',
    servicos: null,
    roles: [...ROLES_TI],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  // 28 — Auditoria
  {
    href: '/auditoria',
    label: 'Auditoria',
    servicos: null,
    roles: [...ROLES_TI, ...ROLES_QUALIDADE],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  // 29 — Utilizadores (it_admin)
  {
    href: '/utilizadores',
    label: 'Utilizadores',
    servicos: null,
    roles: [...ROLES_TI],
    subRoles: ['it_admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  // Horários (último — visível a todos)
  {
    href: '/horarios',
    label: 'Horários',
    servicos: null,
    roles: [...ROLES_CLINICO, ...ROLES_ADMIN],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  // 30 — Configurações (it_admin)
  {
    href: '/configuracoes',
    label: 'Configurações',
    servicos: null,
    roles: [...ROLES_TI],
    subRoles: ['it_admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const roleLabel: Record<string, string> = {
  medico:         'Médico',
  enfermeiro:     'Enfermeiro',
  auxiliar:       'Auxiliar',
  tecnico_saude:  'Técnico de Saúde',
  farmaceutico:   'Farmacêutico',
  administrativo: 'Administrativo',
  operacional:    'Operacional',
  ti:             'TI',
  qualidade:      'Qualidade',
  direcao:        'Direção',
};

const subRoleLabel: Record<string, string> = {
  // medico
  clinico_geral: 'Clínico Geral', cirurgiao_geral: 'Cirurgião Geral',
  medico_anestesia: 'Anestesiologista', medico_imagem: 'Radiologista',
  anatomia_patologica: 'Patologista', medico_gestor: 'Médico Gestor',
  // enfermeiro
  generalista: 'Generalista', supervisor_enfermagem: 'Supervisor',
  triador: 'Triador', instrumentista: 'Instrumentista',
  // auxiliar
  apoio_geral: 'Apoio Geral',
  // tecnico_saude
  tae: 'TAE', reabilitacao_fisica: 'Fisioterapeuta',
  reabilitacao_fala: 'Terapeuta da Fala', nutricao_clinica: 'Nutricionista',
  psicologia_clinica: 'Psicólogo',
  // farmaceutico
  farmaceutico_hospitalar: 'Hospitalar', farmaceutico_oncologico: 'Oncológico',
  tecnico_farmacia_assist: 'Técnico',
  // administrativo
  front_desk: 'Rececionista', secretariado: 'Secretário', backoffice: 'Backoffice',
  scheduling: 'Agenda', billing_officer: 'Faturação', hr_specialist: 'RH', procurement: 'Compras',
  // operacional
  transporte_interno: 'Maqueiro', cssd: 'Esterilização',
  higiene_hospitalar: 'Limpeza', gestao_textil: 'Lavandaria',
  equipamentos_medicos: 'Eng. Biomédico', facilities: 'Manutenção',
  vigilancia: 'Segurança', seguranca_trabalho: 'SST',
  // ti
  it_admin: 'IT Admin', cio: 'CIO', his_erp: 'HIS/ERP',
  database_admin: 'DBA', security_officer: 'Cibersegurança', dados_clinicos: 'BI/Dados',
  // qualidade
  quality_manager: 'Gestor Qualidade', compliance: 'Compliance',
  infection_control: 'Controlo Infeção', internal_audit: 'Auditoria', dpo_role: 'DPO',
  compliance_director: 'Dir. Qualidade',
  // direcao
  ceo_hospitalar: 'Diretor Geral', diretor_medico: 'Dir. Clínico',
  head_nurse: 'Dir. Enfermagem', cfo: 'Dir. Financeiro',
  coo: 'Dir. Operacional', hr_director: 'Dir. RH',
};

const servicoLabel: Record<string, string> = {
  internamento:       'Internamento',
  urgencia:           'Urgência',
  bloco_operatorio:   'Bloco Operatório',
  consultas_externas: 'Consultas Externas',
  farmacia:           'Farmácia',
  fisioterapia:       'Fisioterapia',
  transporte:         'Transporte',
  administrativo:     'Administrativo',
};

const roleColor: Record<string, string> = {
  medico:         'bg-violet-500/15 text-violet-400',
  enfermeiro:     'bg-teal-500/15 text-teal-400',
  auxiliar:       'bg-slate-500/15 text-slate-400',
  tecnico_saude:  'bg-sky-500/15 text-sky-400',
  farmaceutico:   'bg-emerald-500/15 text-emerald-400',
  administrativo: 'bg-pink-500/15 text-pink-400',
  operacional:    'bg-orange-500/15 text-orange-400',
  ti:             'bg-cyan-500/15 text-cyan-400',
  qualidade:      'bg-indigo-500/15 text-indigo-400',
  direcao:        'bg-yellow-500/15 text-yellow-400',
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

  const [modalConfig, setModalConfig] = useState(false);
  const [tema, setTema] = useState<'light'|'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('curasphere-theme') as 'light'|'dark'|null;
    if (saved) setTema(saved);
  }, []);

  const aplicarTema = (t: 'light'|'dark') => {
    setTema(t);
    localStorage.setItem('curasphere-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

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
    if (!loading && !utilizador) { router.push('/login'); return; }
    if (!loading && utilizador && pathname === '/dashboard') {
      if (utilizador.role === 'ti') router.replace('/dashboard-ti');
    }
  }, [utilizador, loading, router, pathname]);

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
    const servicoOk   = !item.servicos || item.servicos.includes(utilizador.servico ?? 'internamento');
    const roleOk      = !item.roles    || item.roles.includes(utilizador.role);
    const subRoleOk   = !(item as any).subRoles        || (item as any).subRoles.includes(utilizador.subRole);
    const notExcluded        = !(item as any).excludeSubRoles  || !(item as any).excludeSubRoles.includes(utilizador.subRole);
    const notExcludedServico = !(item as any).excludeServicos  || !(item as any).excludeServicos.includes(utilizador.servico ?? 'internamento');
    return servicoOk && roleOk && subRoleOk && notExcluded && notExcludedServico;
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
            onClick={() => setModalConfig(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/5 rounded-xl text-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configurações
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

      {/* Modal: Configurações */}
      {modalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalConfig(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '380px', padding: '28px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Configurações</h2>
              <button onClick={() => setModalConfig(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            {/* Tema */}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '12px' }}>Tema</p>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '28px' }}>
              <button
                onClick={() => aplicarTema('light')}
                className={`flex flex-col items-center gap-2 border-2 rounded-xl transition-all ${tema === 'light' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                style={{ padding: '16px 12px' }}
              >
                <svg className={`w-6 h-6 ${tema === 'light' ? 'text-blue-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
                <span className={`text-sm font-semibold ${tema === 'light' ? 'text-blue-600' : 'text-slate-500'}`}>Claro</span>
              </button>
              <button
                onClick={() => aplicarTema('dark')}
                className={`flex flex-col items-center gap-2 border-2 rounded-xl transition-all ${tema === 'dark' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                style={{ padding: '16px 12px' }}
              >
                <svg className={`w-6 h-6 ${tema === 'dark' ? 'text-blue-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className={`text-sm font-semibold ${tema === 'dark' ? 'text-blue-600' : 'text-slate-500'}`}>Escuro</span>
              </button>
            </div>

            {/* Conta */}
            <div className="border-t border-slate-100" style={{ paddingTop: '20px' }}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '12px' }}>Conta</p>
              <button
                onClick={() => { setModalConfig(false); setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); setPwdErro(''); setModalPwd(true); }}
                className="w-full flex items-center gap-3 text-sm text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                style={{ padding: '10px 14px' }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Alterar Password
                <svg className="w-4 h-4 ml-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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

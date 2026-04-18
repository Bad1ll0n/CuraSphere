'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../../../lib/auth-context';
import api from '../../../../lib/api';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  dataNascimento: string;
  estado: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  dataAlta?: string;
  ativo: boolean;
  cama: { numero: string; quarto: string };
  atribuicoes: { enfermeiro: { id: string; nome: string; role: string } }[];
  atribuicoesHorario: { utilizador: { id: string; nome: string; role: string }; horarioTurno: { tipo: string; data: string } }[];
  tarefas: Tarefa[];
  medicacoes: Medicacao[];
  notasTurno: NotaTurno[];
}

interface Tarefa {
  id: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  estado: string;
  prazo?: string;
  criadaEm: string;
  concluidaEm?: string;
  grupoResponsavel?: string;
  responsavel?: { id: string; nome: string; role: string };
  criadoPor?: { id: string; nome: string; role: string };
}

interface Medicacao {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  iniciadoEm: string;
  terminadoEm?: string;
  ativo: boolean;
  prescritoPor?: { id: string; nome: string };
}

interface NotaTurno {
  id: string;
  texto: string;
  criadaEm: string;
  autor: { id: string; nome: string; role: string };
}


const estadoCor: Record<string, { badge: string; dot: string }> = {
  estavel:       { badge: 'bg-green-50 text-green-700 border border-green-200',    dot: 'bg-green-500' },
  grave:         { badge: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  critico:       { badge: 'bg-red-50 text-red-700 border border-red-200',           dot: 'bg-red-500' },
  alta_prevista: { badge: 'bg-blue-50 text-blue-700 border border-blue-200',        dot: 'bg-blue-500' },
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const prioridadeCor: Record<string, string> = {
  baixa:   'bg-slate-100 text-slate-500',
  media:   'bg-blue-50 text-blue-600',
  alta:    'bg-orange-50 text-orange-600',
  urgente: 'bg-red-50 text-red-600',
};
const prioridadeLabel: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
};

const roleLabel: Record<string, string> = {
  enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar', medico: 'Médico',
  chefe_turno: 'Chefe Turno', chefe_enfermeiros: 'Chefe Enfermeiros', administrativo: 'Administrativo',
};

// Escalas clínicas — configuração de itens, cálculo e classificação
const ESCALA_CONFIG: Record<string, {
  label: string; cor: string;
  itens: { key: string; label: string; opcoes: { v: number | string; l: string }[] }[];
  calcularPontuacao: (v: Record<string, any>) => number;
  classificar: (p: number) => string;
}> = {
  RASS: {
    label: 'RASS', cor: 'violet',
    itens: [{ key: 'nivel', label: 'Nível de Sedação/Agitação', opcoes: [
      { v: 4, l: '+4 — Combativo' }, { v: 3, l: '+3 — Muito agitado' }, { v: 2, l: '+2 — Agitado' },
      { v: 1, l: '+1 — Inquieto' }, { v: 0, l: '0 — Alerta e calmo' }, { v: -1, l: '-1 — Sonolento' },
      { v: -2, l: '-2 — Sedação leve' }, { v: -3, l: '-3 — Sedação moderada' },
      { v: -4, l: '-4 — Sedação profunda' }, { v: -5, l: '-5 — Não despertável' },
    ]}],
    calcularPontuacao: (v) => v.nivel as number ?? 0,
    classificar: (p) => p >= 1 ? 'Agitação' : p === 0 ? 'Alerta e calmo' : p >= -2 ? 'Sedação leve' : p >= -4 ? 'Sedação profunda' : 'Não despertável',
  },
  CPOT: {
    label: 'CPOT', cor: 'rose',
    itens: [
      { key: 'expressao', label: 'Expressão Facial', opcoes: [{ v: 0, l: '0 — Relaxada' }, { v: 1, l: '1 — Tensa' }, { v: 2, l: '2 — Franzida/Crispada' }] },
      { key: 'movimento', label: 'Movimentos Corporais', opcoes: [{ v: 0, l: '0 — Ausência de movimentos' }, { v: 1, l: '1 — Proteção' }, { v: 2, l: '2 — Agitação' }] },
      { key: 'ventilacao', label: 'Compliância Ventilatória', opcoes: [{ v: 0, l: '0 — Tolerante' }, { v: 1, l: '1 — Tosse, mas tolerante' }, { v: 2, l: '2 — Luta com o ventilador' }] },
      { key: 'tensao', label: 'Tensão Muscular', opcoes: [{ v: 0, l: '0 — Relaxada' }, { v: 1, l: '1 — Tensa/Rígida' }, { v: 2, l: '2 — Muito tensa/Rígida' }] },
    ],
    calcularPontuacao: (v) => (['expressao', 'movimento', 'ventilacao', 'tensao'] as const).reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p === 0 ? 'Sem dor' : p <= 2 ? 'Dor leve' : p <= 4 ? 'Dor moderada' : 'Dor intensa',
  },
  SOFA: {
    label: 'SOFA', cor: 'red',
    itens: [
      { key: 'respiratorio', label: 'Respiratório (PaO₂/FiO₂)', opcoes: [{ v: 0, l: '0 — ≥400' }, { v: 1, l: '1 — 300-399' }, { v: 2, l: '2 — 200-299' }, { v: 3, l: '3 — 100-199' }, { v: 4, l: '4 — <100' }] },
      { key: 'coagulacao', label: 'Coagulação (Plaquetas ×10³)', opcoes: [{ v: 0, l: '0 — ≥150' }, { v: 1, l: '1 — 100-149' }, { v: 2, l: '2 — 50-99' }, { v: 3, l: '3 — 20-49' }, { v: 4, l: '4 — <20' }] },
      { key: 'hepatico', label: 'Hepático (Bilirrubina mg/dL)', opcoes: [{ v: 0, l: '0 — <1,2' }, { v: 1, l: '1 — 1,2-1,9' }, { v: 2, l: '2 — 2,0-5,9' }, { v: 3, l: '3 — 6,0-11,9' }, { v: 4, l: '4 — ≥12' }] },
      { key: 'cardiovascular', label: 'Cardiovascular (PAM/Vasopressores)', opcoes: [{ v: 0, l: '0 — PAM ≥70' }, { v: 1, l: '1 — PAM <70' }, { v: 2, l: '2 — Dopamina ≤5' }, { v: 3, l: '3 — Dopamina >5' }, { v: 4, l: '4 — Adrenalina >0,1' }] },
      { key: 'neurologico', label: 'Neurológico (GCS)', opcoes: [{ v: 0, l: '0 — GCS 15' }, { v: 1, l: '1 — GCS 13-14' }, { v: 2, l: '2 — GCS 10-12' }, { v: 3, l: '3 — GCS 6-9' }, { v: 4, l: '4 — GCS <6' }] },
      { key: 'renal', label: 'Renal (Creatinina mg/dL)', opcoes: [{ v: 0, l: '0 — <1,2' }, { v: 1, l: '1 — 1,2-1,9' }, { v: 2, l: '2 — 2,0-3,4' }, { v: 3, l: '3 — 3,5-4,9' }, { v: 4, l: '4 — >5' }] },
    ],
    calcularPontuacao: (v) => (['respiratorio', 'coagulacao', 'hepatico', 'cardiovascular', 'neurologico', 'renal'] as const).reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p <= 6 ? 'Baixo risco' : p <= 9 ? 'Risco moderado' : p <= 12 ? 'Risco alto' : 'Risco muito alto',
  },
  Apgar: {
    label: 'Apgar', cor: 'blue',
    itens: [
      { key: 'cor', label: 'Cor da Pele', opcoes: [{ v: 0, l: '0 — Cianose total' }, { v: 1, l: '1 — Cianose periférica' }, { v: 2, l: '2 — Rosada' }] },
      { key: 'frequencia', label: 'Frequência Cardíaca', opcoes: [{ v: 0, l: '0 — Ausente' }, { v: 1, l: '1 — <100 bpm' }, { v: 2, l: '2 — ≥100 bpm' }] },
      { key: 'reflexo', label: 'Reflexo de Irritabilidade', opcoes: [{ v: 0, l: '0 — Ausente' }, { v: 1, l: '1 — Esgar' }, { v: 2, l: '2 — Choro' }] },
      { key: 'tono', label: 'Tónus Muscular', opcoes: [{ v: 0, l: '0 — Flácido' }, { v: 1, l: '1 — Alguma flexão' }, { v: 2, l: '2 — Movimentos ativos' }] },
      { key: 'respiracao', label: 'Respiração', opcoes: [{ v: 0, l: '0 — Ausente' }, { v: 1, l: '1 — Irregular/fraca' }, { v: 2, l: '2 — Vigorosa/choro' }] },
    ],
    calcularPontuacao: (v) => (['cor', 'frequencia', 'reflexo', 'tono', 'respiracao'] as const).reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p >= 7 ? 'Normal' : p >= 4 ? 'Depressão moderada' : 'Depressão grave',
  },
  PEWS: {
    label: 'PEWS', cor: 'amber',
    itens: [
      { key: 'comportamento', label: 'Comportamento', opcoes: [{ v: 0, l: '0 — Brincando/Adequado' }, { v: 1, l: '1 — Dormindo' }, { v: 2, l: '2 — Irritável' }, { v: 3, l: '3 — Reduzido/Letárgico' }] },
      { key: 'cardiovascular', label: 'Cardiovascular', opcoes: [{ v: 0, l: '0 — Rosado/Recapilar 1-2s' }, { v: 1, l: '1 — Pálido/Recapilar 3s' }, { v: 2, l: '2 — Cinzento/Recapilar 4s' }, { v: 3, l: '3 — Cinzento/Recapilar ≥5s' }] },
      { key: 'respiratorio', label: 'Respiratório', opcoes: [{ v: 0, l: '0 — Normal' }, { v: 1, l: '1 — >10 acima do normal' }, { v: 2, l: '2 — >20 acima + uso de músculos' }, { v: 3, l: '3 — 5 abaixo com retração' }] },
    ],
    calcularPontuacao: (v) => (['comportamento', 'cardiovascular', 'respiratorio'] as const).reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p <= 2 ? 'Baixo risco' : p <= 4 ? 'Médio risco' : 'Alto risco — Avisar médico',
  },
  FLACC: {
    label: 'FLACC', cor: 'orange',
    itens: [
      { key: 'face', label: 'Face', opcoes: [{ v: 0, l: '0 — Sem expressão particular' }, { v: 1, l: '1 — Careta ocasional' }, { v: 2, l: '2 — Maxilar tenso/mandíbula' }] },
      { key: 'pernas', label: 'Pernas', opcoes: [{ v: 0, l: '0 — Relaxadas/normais' }, { v: 1, l: '1 — Desconfortáveis/agitadas' }, { v: 2, l: '2 — Chutando/contraídas' }] },
      { key: 'atividade', label: 'Atividade', opcoes: [{ v: 0, l: '0 — Deitado tranquilamente' }, { v: 1, l: '1 — Contraída/tensa' }, { v: 2, l: '2 — Arquejando/curvada' }] },
      { key: 'choro', label: 'Choro', opcoes: [{ v: 0, l: '0 — Sem choro' }, { v: 1, l: '1 — Gemidos/queixas' }, { v: 2, l: '2 — Choro constante' }] },
      { key: 'consolabilidade', label: 'Consolabilidade', opcoes: [{ v: 0, l: '0 — Contente/relaxado' }, { v: 1, l: '1 — Distrai com toque' }, { v: 2, l: '2 — Difícil de consolar' }] },
    ],
    calcularPontuacao: (v) => (['face', 'pernas', 'atividade', 'choro', 'consolabilidade'] as const).reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p === 0 ? 'Sem dor' : p <= 3 ? 'Dor leve' : p <= 6 ? 'Dor moderada' : 'Dor intensa',
  },
  CTG: {
    label: 'CTG', cor: 'pink',
    itens: [
      { key: 'linha_base', label: 'Linha de Base (bpm)', opcoes: [{ v: 'normal', l: 'Normal (110-160)' }, { v: 'taquicardia', l: 'Taquicardia (>160)' }, { v: 'bradicardia', l: 'Bradicardia (<110)' }] },
      { key: 'variabilidade', label: 'Variabilidade', opcoes: [{ v: 'normal', l: 'Normal (6-25)' }, { v: 'reduzida', l: 'Reduzida (<6)' }, { v: 'saltatorio', l: 'Saltatório (>25)' }] },
      { key: 'aceleracoes', label: 'Acelerações', opcoes: [{ v: 'presentes', l: 'Presentes' }, { v: 'ausentes', l: 'Ausentes' }] },
      { key: 'desaceleracoes', label: 'Desacelerações', opcoes: [{ v: 'ausentes', l: 'Ausentes' }, { v: 'precoces', l: 'Precoces (DIP I)' }, { v: 'tardias', l: 'Tardias (DIP II)' }, { v: 'variaveis', l: 'Variáveis' }] },
    ],
    calcularPontuacao: (_v) => 0,
    classificar: (v: any) => {
      if (typeof v === 'object') return 'Ver avaliação';
      return v === 0 ? 'Normal' : 'Patológico';
    },
  },
  Barthel: {
    label: 'Barthel', cor: 'green',
    itens: [
      { key: 'alimentacao', label: 'Alimentação', opcoes: [{ v: 0, l: '0 — Dependente' }, { v: 5, l: '5 — Precisa de ajuda' }, { v: 10, l: '10 — Independente' }] },
      { key: 'banho', label: 'Banho', opcoes: [{ v: 0, l: '0 — Dependente' }, { v: 5, l: '5 — Independente' }] },
      { key: 'toalete', label: 'Toalete', opcoes: [{ v: 0, l: '0 — Dependente' }, { v: 5, l: '5 — Independente' }] },
      { key: 'vestir', label: 'Vestir', opcoes: [{ v: 0, l: '0 — Dependente' }, { v: 5, l: '5 — Precisa de ajuda' }, { v: 10, l: '10 — Independente' }] },
      { key: 'intestino', label: 'Intestino', opcoes: [{ v: 0, l: '0 — Incontinente' }, { v: 5, l: '5 — Acidente ocasional' }, { v: 10, l: '10 — Continente' }] },
      { key: 'bexiga', label: 'Bexiga', opcoes: [{ v: 0, l: '0 — Incontinente' }, { v: 5, l: '5 — Acidente ocasional' }, { v: 10, l: '10 — Continente' }] },
      { key: 'wc', label: 'Uso WC', opcoes: [{ v: 0, l: '0 — Dependente' }, { v: 5, l: '5 — Precisa de ajuda' }, { v: 10, l: '10 — Independente' }] },
      { key: 'transferencia', label: 'Transferência', opcoes: [{ v: 0, l: '0 — Incapaz' }, { v: 5, l: '5 — Grande ajuda' }, { v: 10, l: '10 — Pequena ajuda' }, { v: 15, l: '15 — Independente' }] },
      { key: 'mobilidade', label: 'Mobilidade', opcoes: [{ v: 0, l: '0 — Imóvel' }, { v: 5, l: '5 — Cadeira de rodas' }, { v: 10, l: '10 — Anda com ajuda' }, { v: 15, l: '15 — Independente' }] },
      { key: 'escadas', label: 'Escadas', opcoes: [{ v: 0, l: '0 — Dependente' }, { v: 5, l: '5 — Precisa de ajuda' }, { v: 10, l: '10 — Independente' }] },
    ],
    calcularPontuacao: (v) => ['alimentacao','banho','toalete','vestir','intestino','bexiga','wc','transferencia','mobilidade','escadas'].reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p <= 20 ? 'Dependência total' : p <= 35 ? 'Dependência grave' : p <= 55 ? 'Dependência moderada' : p <= 90 ? 'Dependência leve' : 'Independente',
  },
  MRC: {
    label: 'MRC (Força)', cor: 'blue',
    itens: [
      { key: 'abd_esq', label: 'Abdução ombro E', opcoes: [{ v: 0, l: '0 — Sem contração' }, { v: 1, l: '1 — Traço de contração' }, { v: 2, l: '2 — Movimento sem gravidade' }, { v: 3, l: '3 — Contra gravidade' }, { v: 4, l: '4 — Contra resistência parcial' }, { v: 5, l: '5 — Força normal' }] },
      { key: 'abd_dir', label: 'Abdução ombro D', opcoes: [{ v: 0, l: '0 — Sem contração' }, { v: 1, l: '1 — Traço' }, { v: 2, l: '2 — Sem gravidade' }, { v: 3, l: '3 — Contra gravidade' }, { v: 4, l: '4 — Contra resistência' }, { v: 5, l: '5 — Normal' }] },
      { key: 'flex_esq', label: 'Flexão cotovelo E', opcoes: [{ v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 4, l: '4' }, { v: 5, l: '5' }] },
      { key: 'flex_dir', label: 'Flexão cotovelo D', opcoes: [{ v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 4, l: '4' }, { v: 5, l: '5' }] },
      { key: 'dors_esq', label: 'Dorsiflexão tornozelo E', opcoes: [{ v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 4, l: '4' }, { v: 5, l: '5' }] },
      { key: 'dors_dir', label: 'Dorsiflexão tornozelo D', opcoes: [{ v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 4, l: '4' }, { v: 5, l: '5' }] },
    ],
    calcularPontuacao: (v) => ['abd_esq','abd_dir','flex_esq','flex_dir','dors_esq','dors_dir'].reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p <= 24 ? 'Fraqueza grave (≤4/grupo)' : p <= 36 ? 'Fraqueza moderada' : p <= 48 ? 'Fraqueza leve' : 'Força normal',
  },
  NRS2002: {
    label: 'NRS-2002 (Nutrição)', cor: 'amber',
    itens: [
      { key: 'estado_nutricional', label: 'Estado Nutricional', opcoes: [{ v: 0, l: '0 — Normal' }, { v: 1, l: '1 — Perda de peso >5% em 3 meses' }, { v: 2, l: '2 — Perda de peso >5% em 2 meses ou IMC 18,5-20,5' }, { v: 3, l: '3 — Perda >5% em 1 mês ou IMC <18,5' }] },
      { key: 'gravidade', label: 'Gravidade da Doença', opcoes: [{ v: 0, l: '0 — Normal' }, { v: 1, l: '1 — Fratura da anca, DPOC, hemodiálise' }, { v: 2, l: '2 — Cirurgia abdominal, AVC, pneumonia grave' }, { v: 3, l: '3 — TCE, transplante, UCI (APACHE>10)' }] },
      { key: 'idade', label: 'Idade', opcoes: [{ v: 0, l: '0 — < 70 anos' }, { v: 1, l: '1 — ≥ 70 anos' }] },
    ],
    calcularPontuacao: (v) => ['estado_nutricional', 'gravidade', 'idade'].reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p < 3 ? 'Risco baixo — reavaliar' : 'Em risco — iniciar suporte nutricional',
  },
  PHQ9: {
    label: 'PHQ-9 (Depressão)', cor: 'purple',
    itens: [
      { key: 'anedonia', label: 'Interesse/prazer nas atividades', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'humor', label: 'Sentiu-se deprimido/sem esperança', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'sono', label: 'Problemas de sono', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'energia', label: 'Cansaço/falta de energia', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'apetite', label: 'Problemas com apetite', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'autoestima', label: 'Sentiu-se mal consigo próprio', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'concentracao', label: 'Dificuldade de concentração', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'psicomotor', label: 'Lentidão ou agitação psicomotora', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'suicidio', label: 'Pensamentos de automutilação', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
    ],
    calcularPontuacao: (v) => ['anedonia','humor','sono','energia','apetite','autoestima','concentracao','psicomotor','suicidio'].reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p <= 4 ? 'Mínimo' : p <= 9 ? 'Leve' : p <= 14 ? 'Moderado' : p <= 19 ? 'Moderadamente grave' : 'Grave',
  },
  GAD7: {
    label: 'GAD-7 (Ansiedade)', cor: 'teal',
    itens: [
      { key: 'nervoso', label: 'Sentiu-se nervoso/ansioso', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'controlo', label: 'Incapaz de parar/controlar preocupações', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'preocupacao', label: 'Preocupação excessiva', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'relaxar', label: 'Dificuldade em relaxar', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'inquieto', label: 'Tão inquieto que não para quieto', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'irritavel', label: 'Facilmente irritável', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
      { key: 'medo', label: 'Sentiu medo de que algo terrível pudesse acontecer', opcoes: [{ v: 0, l: '0 — Nunca' }, { v: 1, l: '1 — Vários dias' }, { v: 2, l: '2 — Mais de metade dos dias' }, { v: 3, l: '3 — Quase todos os dias' }] },
    ],
    calcularPontuacao: (v) => ['nervoso','controlo','preocupacao','relaxar','inquieto','irritavel','medo'].reduce((s, k) => s + ((v[k] as number) ?? 0), 0),
    classificar: (p) => p <= 4 ? 'Mínimo' : p <= 9 ? 'Leve' : p <= 14 ? 'Moderado' : 'Grave',
  },
  FOIS: {
    label: 'FOIS (Ingestão Oral Funcional)', cor: 'teal',
    itens: [
      { key: 'nivel', label: 'Nível de Ingestão Oral', opcoes: [
        { v: 1, l: '1 — Sem ingestão oral' },
        { v: 2, l: '2 — Dependente de sonda, tentativas mínimas de alimentos/líquidos' },
        { v: 3, l: '3 — Dependente de sonda com ingestão oral consistente' },
        { v: 4, l: '4 — Dieta sólida e líquidos de uma consistência' },
        { v: 5, l: '5 — Dieta sólida e líquidos de múltiplas consistências, necessita preparação especial' },
        { v: 6, l: '6 — Ingestão oral total sem restrições especiais, mas com modificações' },
        { v: 7, l: '7 — Ingestão oral total sem restrições' },
      ] },
    ],
    calcularPontuacao: (v) => (v['nivel'] as number) ?? 1,
    classificar: (p) => p <= 2 ? 'Sem/mínima ingestão oral' : p <= 4 ? 'Ingestão oral parcial' : p <= 6 ? 'Ingestão oral com restrições' : 'Ingestão oral normal',
  },
};

function calcIdade(dataNascimento: string) {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function BtnAdd({ onClick, label = 'Adicionar' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
      style={{ marginLeft: 'auto' }}>
      <svg aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}

export default function DoenteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { utilizador } = useAuth();
  const [doente, setDoente] = useState<Doente | null>(null);
  const [loading, setLoading] = useState(true);
  const [alterandoEstado, setAlterandoEstado] = useState(false);
  const [salvandoAlta, setSalvandoAlta] = useState(false);

  // Modals
  const [modalQR, setModalQR] = useState(false);
  const [modalNota, setModalNota] = useState(false);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalMed, setModalMed] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [tarefasHistorico, setTarefasHistorico] = useState<Tarefa[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [modalHistoricoMed, setModalHistoricoMed] = useState(false);
  const [medHistorico, setMedHistorico] = useState<Medicacao[]>([]);
  const [loadingHistoricoMed, setLoadingHistoricoMed] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  // Sinais Vitais
  const [sinaisVitais, setSinaisVitais] = useState<any[]>([]);
  const [modalSinalVital, setModalSinalVital] = useState(false);
  const [svPressaoS, setSvPressaoS] = useState('');
  const [svPressaoD, setSvPressaoD] = useState('');
  const [svPulso, setSvPulso] = useState('');
  const [svTemp, setSvTemp] = useState('');
  const [svSpO2, setSvSpO2] = useState('');
  const [svFreqResp, setSvFreqResp] = useState('');
  const [svPeso, setSvPeso] = useState('');
  const [svNotas, setSvNotas] = useState('');

  // Alergias
  const [alergias, setAlergias] = useState<any[]>([]);
  const [modalAlergia, setModalAlergia] = useState(false);
  const [alergenio, setAlergenio] = useState('');
  const [alergiaTipo, setAlergiaTipo] = useState('medicamento');
  const [alergiaSev, setAlergiaSev] = useState('moderada');
  const [alergiaNotas, setAlergiaNotas] = useState('');

  // Contactos
  const [contactos, setContactos] = useState<any[]>([]);
  const [modalContacto, setModalContacto] = useState(false);
  const [ctNome, setCtNome] = useState('');
  const [ctRelacao, setCtRelacao] = useState('cônjuge');
  const [ctTel, setCtTel] = useState('');
  const [ctPrincipal, setCtPrincipal] = useState(false);

  // Escalas clínicas
  const [escalas, setEscalas] = useState<{ braden: any; morse: any }>({ braden: null, morse: null });
  const [modalEscala, setModalEscala] = useState<'braden' | 'morse' | null>(null);
  const [escalaItens, setEscalaItens] = useState<Record<string, number>>({});

  // Editar doente
  const [modalEditarDoente, setModalEditarDoente] = useState(false);
  const [editDiagnostico, setEditDiagnostico] = useState('');
  const [editAltaPrevista, setEditAltaPrevista] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Exames
  const [exames, setExames] = useState<any[]>([]);
  const [modalExame, setModalExame] = useState(false);
  const [exameForm, setExameForm] = useState({ tipo: 'analise_clinica', descricao: '', urgente: false });
  const [resultadoModal, setResultadoModal] = useState<any>(null);
  const [resultadoTexto, setResultadoTexto] = useState('');
  const [salvandoExame, setSalvandoExame] = useState(false);

  // Notas Clínicas SOAP
  const [notasClincias, setNotasClincias] = useState<any[]>([]);
  const [modalNotaClinica, setModalNotaClinica] = useState(false);
  const [soapForm, setSoapForm] = useState({ subjetivo: '', objetivo: '', avaliacao: '', plano: '' });
  const [salvandoSoap, setSalvandoSoap] = useState(false);
  const [notaSoapEditandoId, setNotaSoapEditandoId] = useState<string | null>(null);

  // Escalas Clínicas Especializadas
  const [escalasClinicas, setEscalasClinicas] = useState<any[]>([]);
  const [modalEscalaClinica, setModalEscalaClinica] = useState(false);
  const [tipoEscalaClinica, setTipoEscalaClinica] = useState('RASS');
  const [valoresEscalaClinica, setValoresEscalaClinica] = useState<Record<string, any>>({});
  const [salvandoEscalaClinica, setSalvandoEscalaClinica] = useState(false);

  // Interconsultas
  const [interconsultas, setInterconsultas] = useState<any[]>([]);
  const [modalInterconsulta, setModalInterconsulta] = useState(false);
  const [intercEspecialidade, setIntercEspecialidade] = useState('Cardiologia');
  const [intercMotivo, setIntercMotivo] = useState('');
  const [intercUrgente, setIntercUrgente] = useState(false);
  const [salvandoInterc, setSalvandoInterc] = useState(false);
  const [modalIntercResposta, setModalIntercResposta] = useState<string | null>(null);
  const [intercResposta, setIntercResposta] = useState('');

  // Dispositivos Invasivos
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [modalDispositivo, setModalDispositivo] = useState(false);
  const [dispTipo, setDispTipo] = useState('cateter_venoso_central');
  const [dispLocalizacao, setDispLocalizacao] = useState('');
  const [dispObservacoes, setDispObservacoes] = useState('');
  const [salvandoDisp, setSalvandoDisp] = useState(false);

  // Alta estruturada
  const [modalAltaEstruturada, setModalAltaEstruturada] = useState(false);
  const [altaMotivo, setAltaMotivo] = useState('melhoria');
  const [altaDestino, setAltaDestino] = useState('domicilio');
  const [altaResumo, setAltaResumo] = useState('');
  const [altaPrescricao, setAltaPrescricao] = useState('');
  const [altaMedicoFamilia, setAltaMedicoFamilia] = useState('');

  // Nota form
  const [notaTexto, setNotaTexto] = useState('');

  // Edição inline de notas
  const [notaEditandoId, setNotaEditandoId] = useState<string | null>(null);
  const [notaEditTexto, setNotaEditTexto] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);

  // Turno ativo do utilizador
  const [emTurno, setEmTurno] = useState(false);

  // Tarefa form
  const [tarefaDesc, setTarefaDesc] = useState('');
  const [tarefaTipo, setTarefaTipo] = useState('clinica');
  const [tarefaPrioridade, setTarefaPrioridade] = useState('media');
  const [tarefaGrupo, setTarefaGrupo] = useState('');
  const [tarefaPrazo, setTarefaPrazo] = useState('');

  // Medicação form
  const [medNome, setMedNome] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medVia, setMedVia] = useState('');
  const [medFreq, setMedFreq] = useState('');

  const podeAlterarEstado = ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'].includes(utilizador?.role ?? '');
  const podeDarAlta = ['administrativo', 'chefe_enfermeiros', 'chefe_medicos'].includes(utilizador?.role ?? '');
  const podeCriarTarefa = emTurno && ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'].includes(utilizador?.role ?? '');
  const podeCriarNota = emTurno && ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos', 'auxiliar'].includes(utilizador?.role ?? '');
  const podePrescreveMed = ['medico', 'chefe_medicos'].includes(utilizador?.role ?? '');

  // Grupo de role: médicos vêem só médicos; enfermagem vê só enfermagem
  const grupoMedico = ['medico', 'chefe_medicos'];
  const grupoEnfermagem = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar'];
  const meuGrupo = grupoMedico.includes(utilizador?.role ?? '') ? grupoMedico : grupoEnfermagem;

  // Chave do grupo para filtrar tarefas por grupoResponsavel
  const meuGrupoChave = (() => {
    const role = utilizador?.role ?? '';
    if (['medico', 'chefe_medicos'].includes(role)) return 'medico';
    if (role === 'auxiliar') return 'auxiliar';
    return 'enfermeiro';
  })();

  // Grupos que cada role pode escolher ao criar tarefa
  const gruposDisponiveis = (() => {
    const role = utilizador?.role ?? '';
    if (['medico', 'chefe_medicos'].includes(role)) return ['medico', 'enfermeiro'];
    if (role === 'auxiliar') return ['auxiliar'];
    return ['enfermeiro', 'auxiliar'];
  })();

  const grupoLabel: Record<string, string> = {
    medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  };

  const concluirMedicacao = async (medId: string) => {
    if (!confirm('Confirmar conclusão desta medicação?')) return;
    try {
      await api.patch(`/medicacao/${medId}/descontinuar`);
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao concluir medicação');
    }
  };

  const abrirHistoricoMed = async () => {
    setLoadingHistoricoMed(true);
    setModalHistoricoMed(true);
    try {
      const r = await api.get(`/medicacao/doente/${id}`);
      setMedHistorico(r.data.filter((m: Medicacao) => !m.ativo));
    } catch { setMedHistorico([]); }
    finally { setLoadingHistoricoMed(false); }
  };

  const abrirHistorico = async () => {
    setLoadingHistorico(true);
    setModalHistorico(true);
    try {
      const r = await api.get(`/tarefas/doente/${id}`);
      const concluidas = r.data.filter((t: Tarefa) => t.estado === 'concluida');
      setTarefasHistorico(concluidas);
    } catch { setTarefasHistorico([]); }
    finally { setLoadingHistorico(false); }
  };

  const carregar = () => {
    setLoading(true);
    api.get(`/doentes/${id}`)
      .then((r) => setDoente(r.data))
      .finally(() => setLoading(false));
  };

  const carregarSinaisVitais = () =>
    api.get(`/sinais-vitais/${id}`).then((r) => setSinaisVitais(r.data)).catch(() => setSinaisVitais([]));

  const carregarAlergias = () =>
    api.get(`/alergias/${id}`).then((r) => setAlergias(r.data)).catch(() => setAlergias([]));

  const carregarContactos = () =>
    api.get(`/contactos/${id}`).then((r) => setContactos(r.data)).catch(() => setContactos([]));

  const carregarEscalas = () =>
    api.get(`/escalas/${id}`).then((r) => setEscalas(r.data)).catch(() => {});

  const carregarExames = () =>
    api.get(`/exames/${id}`).then((r) => setExames(r.data)).catch(() => setExames([]));

  const carregarNotasClincias = () =>
    api.get(`/notas-clinicas/${id}`).then((r) => setNotasClincias(r.data)).catch(() => setNotasClincias([]));

  const carregarEscalasClinicas = () =>
    api.get(`/escalas-clinicas/${id}`).then((r) => setEscalasClinicas(r.data)).catch(() => setEscalasClinicas([]));

  const carregarInterconsultas = () =>
    api.get(`/interconsultas/doente/${id}`).then((r) => setInterconsultas(r.data)).catch(() => setInterconsultas([]));

  const carregarDispositivos = () =>
    api.get(`/dispositivos-invasivos/doente/${id}`).then((r) => setDispositivos(r.data)).catch(() => setDispositivos([]));

  const abrirEditarDoente = () => {
    if (!doente) return;
    setEditDiagnostico(doente.diagnosticoPrincipal);
    setEditAltaPrevista(doente.dataAltaPrevista ? doente.dataAltaPrevista.split('T')[0] : '');
    setModalEditarDoente(true);
  };

  const submeterEdicaoDoente = async () => {
    setSalvandoEdicao(true);
    try {
      await api.patch(`/doentes/${id}`, {
        diagnosticoPrincipal: editDiagnostico || undefined,
        dataAltaPrevista: editAltaPrevista ? new Date(editAltaPrevista) : null,
      });
      setModalEditarDoente(false);
      await carregar();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao editar doente');
    } finally { setSalvandoEdicao(false); }
  };

  const submeterEscala = async () => {
    if (!modalEscala) return;
    setSalvando(true);
    try {
      await api.post(`/escalas/${id}`, { tipo: modalEscala, itens: escalaItens });
      setModalEscala(null); setEscalaItens({});
      carregarEscalas();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao registar escala');
    } finally { setSalvando(false); }
  };

  const submeterAltaEstruturada = async () => {
    if (!altaResumo.trim()) return;
    setSalvandoAlta(true);
    try {
      await api.post(`/doentes/${id}/alta-estruturada`, {
        motivoAlta: altaMotivo,
        destino: altaMotivo !== 'obito' ? altaDestino : undefined,
        resumoClinical: altaResumo,
        prescricaoSaida: altaPrescricao || undefined,
        medicoFamilia: altaMedicoFamilia || undefined,
      });
      setModalAltaEstruturada(false);
      router.push('/doentes');
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao registar alta');
    } finally { setSalvandoAlta(false); }
  };

  const submeterSinalVital = async () => {
    setSalvando(true);
    try {
      await api.post(`/sinais-vitais/${id}`, {
        pressaoSistolica:       svPressaoS  ? parseInt(svPressaoS)  : undefined,
        pressaoDiastolica:      svPressaoD  ? parseInt(svPressaoD)  : undefined,
        pulso:                  svPulso     ? parseInt(svPulso)     : undefined,
        temperatura:            svTemp      ? parseFloat(svTemp)    : undefined,
        saturacaoO2:            svSpO2      ? parseInt(svSpO2)      : undefined,
        frequenciaRespiratoria: svFreqResp  ? parseInt(svFreqResp)  : undefined,
        peso:                   svPeso      ? parseFloat(svPeso)    : undefined,
        notas: svNotas || undefined,
      });
      setModalSinalVital(false);
      carregarSinaisVitais();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao registar sinais vitais');
    } finally { setSalvando(false); }
  };

  const submeterAlergia = async () => {
    if (!alergenio.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/alergias/${id}`, { alergenio, tipo: alergiaTipo, severidade: alergiaSev, notas: alergiaNotas || undefined });
      setModalAlergia(false); setAlergenio(''); setAlergiaNotas('');
      carregarAlergias();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao registar alergia');
    } finally { setSalvando(false); }
  };

  const removerAlergia = async (alergiaId: string) => {
    if (!confirm('Remover esta alergia?')) return;
    await api.delete(`/alergias/${alergiaId}`);
    carregarAlergias();
  };

  const submeterContacto = async () => {
    if (!ctNome.trim() || !ctTel.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/contactos/${id}`, { nome: ctNome, relacao: ctRelacao, telefone: ctTel, principal: ctPrincipal });
      setModalContacto(false); setCtNome(''); setCtTel(''); setCtPrincipal(false);
      carregarContactos();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao guardar contacto');
    } finally { setSalvando(false); }
  };

  const removerContacto = async (ctId: string) => {
    if (!confirm('Remover este contacto?')) return;
    await api.delete(`/contactos/${ctId}`);
    carregarContactos();
  };

  useEffect(() => {
    Promise.all([
      carregar(),
      verificarTurnoAtivo(),
      carregarSinaisVitais(),
      carregarAlergias(),
      carregarContactos(),
      carregarEscalas(),
      carregarExames(),
      carregarNotasClincias(),
      carregarEscalasClinicas(),
      carregarInterconsultas(),
      carregarDispositivos(),
    ]);
  }, [id]);

  const verificarTurnoAtivo = async () => {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipo: string;
    const dataRef = new Date(agora);
    if (min >= 8 * 60 && min < 16 * 60)       { tipo = 'manha'; }
    else if (min >= 16 * 60 && min < 23 * 60) { tipo = 'tarde'; }
    else if (min >= 23 * 60)                   { tipo = 'noite'; }
    else                                        { tipo = 'noite'; dataRef.setDate(dataRef.getDate() - 1); }

    try {
      const r = await api.get(`/horarios/meu?mes=${dataRef.getMonth() + 1}&ano=${dataRef.getFullYear()}`);
      const diaRef = dataRef.toDateString();
      const temTurno = r.data.some((h: any) =>
        h.horarioTurno.tipo === tipo &&
        new Date(h.horarioTurno.data).toDateString() === diaRef
      );
      setEmTurno(temTurno);
    } catch { setEmTurno(false); }
  };

  const alterarEstado = async (novoEstado: string) => {
    await api.patch(`/doentes/${id}/estado`, { estado: novoEstado });
    setAlterandoEstado(false);
    carregar();
  };

  // Deadline de edição com base no turno real:
  // Manhã 08:00–16:00 → até 16:30 | Tarde 16:00–23:00 → até 23:30 | Noite 23:00–08:00 → até 08:30
  const getDeadlineEdicao = (criadaEm: string): Date => {
    const d = new Date(criadaEm);
    const min = d.getHours() * 60 + d.getMinutes();
    const dl = new Date(d);
    if (min >= 8 * 60 && min < 16 * 60) {
      dl.setHours(16, 30, 0, 0);
    } else if (min >= 16 * 60 && min < 23 * 60) {
      dl.setHours(23, 30, 0, 0);
    } else if (min >= 23 * 60) {
      dl.setDate(dl.getDate() + 1);
      dl.setHours(8, 30, 0, 0);
    } else {
      dl.setHours(8, 30, 0, 0);
    }
    return dl;
  };

  const isNotaEditavel = (nota: NotaTurno) => {
    if (!emTurno) return false; // utilizador não está de turno agora
    if (nota.autor.id !== utilizador?.id) return false;
    const criadaEm = new Date(nota.criadaEm);
    const agora = new Date();
    if (agora.getTime() - criadaEm.getTime() > 10 * 60 * 60 * 1000) return false;
    return agora <= getDeadlineEdicao(nota.criadaEm);
  };

  const iniciarEdicaoNota = (nota: NotaTurno) => {
    setNotaEditandoId(nota.id);
    setNotaEditTexto(nota.texto);
  };

  const guardarEdicaoNota = async (notaId: string) => {
    if (!notaEditTexto.trim()) return;
    setSalvandoNota(true);
    try {
      await api.patch(`/doentes/${id}/nota/${notaId}`, { texto: notaEditTexto });
      setNotaEditandoId(null);
      carregar();
    } finally { setSalvandoNota(false); }
  };

  const apagarNota = async (notaId: string) => {
    await api.delete(`/doentes/${id}/nota/${notaId}`);
    carregar();
  };

  const abrirModalTarefa = () => {
    setTarefaDesc(''); setTarefaTipo('clinica'); setTarefaPrioridade('media');
    setTarefaGrupo(gruposDisponiveis[0] ?? ''); setTarefaPrazo(''); setErroModal('');
    setModalTarefa(true);
  };

  const submeterNota = async () => {
    if (!notaTexto.trim()) return;
    setSalvando(true); setErroModal('');
    try {
      await api.post(`/doentes/${id}/nota`, { texto: notaTexto });
      setModalNota(false); setNotaTexto(''); carregar();
    } catch (e: any) {
      setErroModal(e.response?.data?.message ?? 'Erro ao guardar nota');
    } finally { setSalvando(false); }
  };

  const submeterTarefa = async () => {
    if (!tarefaDesc.trim() || !tarefaGrupo) return;
    setSalvando(true); setErroModal('');
    try {
      await api.post(`/doentes/${id}/tarefa`, {
        descricao: tarefaDesc,
        tipo: tarefaTipo,
        prioridade: tarefaPrioridade,
        grupoResponsavel: tarefaGrupo,
        prazo: tarefaPrazo || undefined,
      });
      setModalTarefa(false); carregar();
    } catch (e: any) {
      setErroModal(e.response?.data?.message ?? 'Erro ao criar tarefa');
    } finally { setSalvando(false); }
  };

  const submeterMed = async () => {
    if (!medNome.trim() || !medDose.trim() || !medVia.trim() || !medFreq.trim()) return;
    setSalvando(true); setErroModal('');
    try {
      await api.post('/medicacao/prescrever', { doenteId: id, nome: medNome, dose: medDose, via: medVia, frequencia: medFreq });
      setModalMed(false); setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq(''); carregar();
    } catch (e: any) {
      setErroModal(e.response?.data?.message ?? 'Erro ao prescrever medicação');
    } finally { setSalvando(false); }
  };

  const submeterNotaClinica = async () => {
    const { subjetivo, objetivo, avaliacao, plano } = soapForm;
    if (!subjetivo.trim() || !objetivo.trim() || !avaliacao.trim() || !plano.trim()) return;
    setSalvandoSoap(true);
    try {
      if (notaSoapEditandoId) {
        await api.patch(`/notas-clinicas/${notaSoapEditandoId}`, soapForm);
        setNotaSoapEditandoId(null);
      } else {
        await api.post(`/notas-clinicas/${id}`, soapForm);
      }
      setModalNotaClinica(false);
      setSoapForm({ subjetivo: '', objetivo: '', avaliacao: '', plano: '' });
      carregarNotasClincias();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao guardar nota');
    } finally { setSalvandoSoap(false); }
  };

  const apagarNotaClinica = async (notaId: string) => {
    if (!confirm('Apagar esta nota clínica?')) return;
    await api.delete(`/notas-clinicas/${notaId}`);
    carregarNotasClincias();
  };

  const submeterEscalaClinica = async () => {
    setSalvandoEscalaClinica(true);
    try {
      const config = ESCALA_CONFIG[tipoEscalaClinica];
      const pontuacao = config ? config.calcularPontuacao(valoresEscalaClinica) : undefined;
      const classificacao = config && pontuacao !== undefined ? config.classificar(pontuacao) : undefined;
      await api.post(`/escalas-clinicas/${id}`, {
        tipo: tipoEscalaClinica, valores: valoresEscalaClinica, pontuacao, classificacao,
      });
      setModalEscalaClinica(false);
      setValoresEscalaClinica({});
      carregarEscalasClinicas();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao registar escala');
    } finally { setSalvandoEscalaClinica(false); }
  };

  const submeterInterconsulta = async () => {
    setSalvandoInterc(true);
    try {
      await api.post(`/interconsultas/doente/${id}`, {
        especialidadeAlvo: intercEspecialidade, motivo: intercMotivo, urgente: intercUrgente,
      });
      setModalInterconsulta(false);
      setIntercMotivo(''); setIntercUrgente(false);
      carregarInterconsultas();
    } finally { setSalvandoInterc(false); }
  };

  const submeterResposta = async (intercId: string) => {
    if (!intercResposta.trim()) return;
    try {
      await api.patch(`/interconsultas/${intercId}/responder`, { resposta: intercResposta });
      setModalIntercResposta(null); setIntercResposta('');
      carregarInterconsultas();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Erro'); }
  };

  const submeterDispositivo = async () => {
    setSalvandoDisp(true);
    try {
      await api.post(`/dispositivos-invasivos/doente/${id}`, {
        tipo: dispTipo, localizacao: dispLocalizacao || undefined, observacoes: dispObservacoes || undefined,
      });
      setModalDispositivo(false);
      setDispLocalizacao(''); setDispObservacoes('');
      carregarDispositivos();
    } finally { setSalvandoDisp(false); }
  };

  const removerDispositivo = async (dispId: string) => {
    if (!confirm('Confirmar remoção do dispositivo?')) return;
    await api.patch(`/dispositivos-invasivos/${dispId}/remover`);
    carregarDispositivos();
  };

  if (loading) return (
    <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '120px' }}>
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm">A carregar...</span>
    </div>
  );

  if (!doente) return (
    <div className="text-center text-slate-400 text-sm" style={{ paddingTop: '120px' }}>Doente não encontrado</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Back */}
      <Link href="/doentes"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        style={{ marginBottom: '24px', display: 'inline-flex' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar a Doentes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
            <h1 className="text-3xl font-bold text-slate-900">{doente.nome}</h1>
            <div className="relative">
              <button
                onClick={() => podeAlterarEstado && setAlterandoEstado((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-lg ${estadoCor[doente.estado]?.badge} ${podeAlterarEstado ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
                style={{ padding: '5px 10px' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${estadoCor[doente.estado]?.dot}`} />
                {estadoLabel[doente.estado]}
                {podeAlterarEstado && (
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              {alterandoEstado && (
                <div className="absolute top-full left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden" style={{ marginTop: '6px', minWidth: '160px' }}>
                  {Object.entries(estadoLabel).map(([key, label]) => (
                    key !== doente.estado && (
                      <button key={key} onClick={() => alterarEstado(key)}
                        className="w-full flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        style={{ padding: '10px 14px' }}>
                        <span className={`w-2 h-2 rounded-full ${estadoCor[key]?.dot}`} />
                        {label}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-slate-400 text-sm font-mono">{doente.numeroProcesso}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`/doentes/${id}/print`, '_blank')}
            className="inline-flex items-center gap-2 border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all"
            style={{ padding: '10px 16px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            PDF
          </button>
          <button onClick={() => setModalQR(true)}
            className="inline-flex items-center gap-2 border border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 text-sm font-medium rounded-xl transition-all"
            style={{ padding: '10px 16px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5V16M4 4h4v4H4V4zm12 0h4v4h-4V4zm-12 12h4v4H4v-4z" />
            </svg>
            QR Code
          </button>
          {podeDarAlta && doente.ativo && (
            <button onClick={() => setModalAltaEstruturada(true)}
              className="border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-all"
              style={{ padding: '10px 20px' }}>
              Dar Alta
            </button>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '24px' }}>

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Dados Pessoais</span>
          </div>
          <div className="flex flex-col gap-4">
            <InfoRow label="Data de Nascimento" value={`${new Date(doente.dataNascimento).toLocaleDateString('pt-PT')} (${calcIdade(doente.dataNascimento)} anos)`} />
            <InfoRow label="Admissão" value={new Date(doente.dataAdmissao).toLocaleDateString('pt-PT')} />
            <InfoRow label="Alta Prevista" value={doente.dataAltaPrevista ? new Date(doente.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'} />
          </div>
        </div>

        {/* Clínico */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Informação Clínica</span>
            </div>
            {['medico', 'chefe_medicos', 'chefe_turno', 'chefe_enfermeiros', 'administrativo'].includes(utilizador?.role ?? '') && (
              <button onClick={abrirEditarDoente}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                style={{ padding: '4px 8px' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Editar
              </button>
            )}
          </div>
          <InfoRow label="Diagnóstico Principal" value={doente.diagnosticoPrincipal} />
        </div>

        {/* Internamento */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Internamento</span>
          </div>
          <div className="flex flex-col gap-4">
            <InfoRow label="Cama" value={`Quarto ${doente.cama.quarto} · Cama ${doente.cama.numero}`} />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Enfermeiros Atribuídos</span>
              {(() => {
                const ordemTurno: Record<string, number> = { manha: 0, tarde: 1, noite: 2 };
                const mapa = new Map<string, typeof doente.atribuicoesHorario[0]>();
                for (const a of doente.atribuicoesHorario) {
                  const existente = mapa.get(a.utilizador.id);
                  if (!existente) { mapa.set(a.utilizador.id, a); continue; }
                  const dataA = new Date(a.horarioTurno.data).getTime();
                  const dataE = new Date(existente.horarioTurno.data).getTime();
                  if (dataA > dataE || (dataA === dataE && ordemTurno[a.horarioTurno.tipo] > ordemTurno[existente.horarioTurno.tipo])) {
                    mapa.set(a.utilizador.id, a);
                  }
                }
                const unicos = Array.from(mapa.values());
                return unicos.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {unicos.map((a) => (
                      <div key={a.utilizador.id} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{a.utilizador.nome}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          a.horarioTurno.tipo === 'manha' ? 'bg-amber-50 text-amber-700' :
                          a.horarioTurno.tipo === 'tarde' ? 'bg-orange-50 text-orange-700' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>
                          {a.horarioTurno.tipo === 'manha' ? 'Manhã' : a.horarioTurno.tipo === 'tarde' ? 'Tarde' : 'Noite'}
                          {' · '}{new Date(a.horarioTurno.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <span className="text-sm text-slate-400">Nenhum atribuído</span>;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Medicação + Tarefas */}
      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>

        {/* Medicação */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Medicação Ativa</span>
            {doente.medicacoes.length > 0 && (
              <span className="text-xs font-medium text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                {doente.medicacoes.length}
              </span>
            )}
            <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
              <button onClick={abrirHistoricoMed} title="Histórico de medicação"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {podePrescreveMed && <BtnAdd label="Prescrever medicação" onClick={() => { setErroModal(''); setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq(''); setModalMed(true); }} />}
            </div>
          </div>
          {doente.medicacoes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
              {podePrescreveMed ? 'Sem medicação ativa — clica em + para prescrever' : 'Sem medicação ativa'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {doente.medicacoes.map((m) => (
                <div key={m.id} className="flex items-start justify-between bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{m.nome}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{m.dose} · {m.via} · {m.frequencia}</p>
                    {m.prescritoPor && (
                      <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Prescrito por {m.prescritoPor.nome}</p>
                    )}
                  </div>
                  {podePrescreveMed && (
                    <button onClick={() => concluirMedicacao(m.id)} title="Concluir medicação"
                      className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-colors shrink-0"
                      style={{ marginLeft: '8px' }}>
                      <svg className="w-3 h-3 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tarefas */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Tarefas Pendentes</span>
            {doente.tarefas.length > 0 && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                {doente.tarefas.length}
              </span>
            )}
            <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
              <button onClick={abrirHistorico}
                title="Histórico de tarefas"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {podeCriarTarefa && <BtnAdd label="Adicionar tarefa" onClick={abrirModalTarefa} />}
            </div>
          </div>
          {doente.tarefas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
              {podeCriarTarefa ? 'Sem tarefas — clica em + para criar' : 'Sem tarefas pendentes'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {doente.tarefas.map((t) => {
                // Pode concluir se for o responsável directo, ou se tiver a role do grupo atribuído
                const podeConcluir = emTurno && (
                  t.responsavel?.id === utilizador?.id ||
                  (t.grupoResponsavel === meuGrupoChave && !t.responsavel)
                );
                return (
                  <div key={t.id} className="flex items-start gap-3 bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{t.descricao}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                        <span className="text-xs text-slate-400">{t.tipo === 'clinica' ? 'Clínica' : 'Logística'}</span>
                        {t.responsavel ? (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-500 font-medium">A cargo: {t.responsavel.nome}</span>
                          </>
                        ) : t.grupoResponsavel ? (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-500 font-medium">Para: {grupoLabel[t.grupoResponsavel] ?? t.grupoResponsavel}</span>
                          </>
                        ) : null}
                        {t.criadoPor && (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-400">
                              Por {t.criadoPor.nome} às {new Date(t.criadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${prioridadeCor[t.prioridade]}`}>
                        {prioridadeLabel[t.prioridade]}
                      </span>
                      {podeConcluir && (
                        <button
                          onClick={async () => {
                            try {
                              await api.patch(`/tarefas/${t.id}/estado`, { estado: 'concluida' });
                              carregar();
                            } catch { /* ignore */ }
                          }}
                          title="Concluir tarefa"
                          className="w-6 h-6 rounded-full border-2 border-slate-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-all"
                        >
                          <svg className="w-3 h-3 text-slate-400 hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notas de turno */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Notas de Turno</span>
          {podeCriarNota && <BtnAdd label="Adicionar nota de turno" onClick={() => { setNotaTexto(''); setErroModal(''); setModalNota(true); }} />}
        </div>
        {(() => {
          const notasFiltradas = doente.notasTurno.filter((n) => meuGrupo.includes(n.autor.role));
          return notasFiltradas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
            {podeCriarNota ? 'Sem notas — clica em + para adicionar' : 'Sem notas registadas'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {notasFiltradas.map((n) => (
              <div key={n.id} className="border-l-2 border-indigo-200 bg-indigo-50/40 rounded-r-xl" style={{ padding: '14px 16px' }}>
                {notaEditandoId === n.id ? (
                  <div>
                    <textarea
                      rows={3}
                      value={notaEditTexto}
                      onChange={(e) => setNotaEditTexto(e.target.value)}
                      className="w-full border border-indigo-200 rounded-lg text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      style={{ padding: '10px 12px', marginBottom: '10px' }}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => guardarEdicaoNota(n.id)} disabled={salvandoNota || !notaEditTexto.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                        style={{ padding: '6px 14px' }}>
                        {salvandoNota ? 'A guardar...' : 'Guardar'}
                      </button>
                      <button onClick={() => setNotaEditandoId(null)}
                        className="border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors"
                        style={{ padding: '6px 14px' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-700 leading-relaxed">{n.texto}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                      <span className="text-xs font-medium text-slate-500">{n.autor.nome}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">{roleLabel[n.autor.role] ?? n.autor.role}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">
                        {new Date(n.criadaEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isNotaEditavel(n) && (
                        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
                          <button onClick={() => iniciarEdicaoNota(n)} title="Editar"
                            className="w-6 h-6 rounded-md hover:bg-indigo-100 flex items-center justify-center transition-colors">
                            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => apagarNota(n.id)} title="Apagar"
                            className="w-6 h-6 rounded-md hover:bg-red-100 flex items-center justify-center transition-colors">
                            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        );
        })()}
      </div>

      {/* Alergias + Contactos de Emergência */}
      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px', marginTop: '24px' }}>
        {/* Alergias */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Alergias</span>
            <BtnAdd label="Registar alergia" onClick={() => { setAlergenio(''); setAlergiaNotas(''); setModalAlergia(true); }} />
          </div>
          {alergias.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem alergias registadas</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alergias.map((a: any) => {
                const sevCor: Record<string, string> = { anafilaxia: 'bg-red-100 text-red-700', grave: 'bg-orange-100 text-orange-700', moderada: 'bg-yellow-100 text-yellow-700', ligeira: 'bg-slate-100 text-slate-600' };
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg bg-slate-50" style={{ padding: '10px 12px' }}>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sevCor[a.severidade] ?? 'bg-slate-100 text-slate-600'}`}>{a.severidade}</span>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-slate-800">{a.alergenio}</span>
                      <span className="text-xs text-slate-400 ml-2">{a.tipo}</span>
                    </div>
                    <button onClick={() => removerAlergia(a.id)} className="text-red-400 hover:text-red-600 text-xs transition-colors">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contactos de Emergência */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Contactos de Emergência</span>
            <BtnAdd label="Adicionar contacto de emergência" onClick={() => { setCtNome(''); setCtTel(''); setCtRelacao('cônjuge'); setCtPrincipal(false); setModalContacto(true); }} />
          </div>
          {contactos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem contactos registados</p>
          ) : (
            <div className="flex flex-col gap-2">
              {contactos.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg bg-slate-50" style={{ padding: '10px 12px' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{c.nome}</span>
                      {c.principal && <span className="text-xs bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">Principal</span>}
                    </div>
                    <span className="text-xs text-slate-400">{c.relacao} · {c.telefone}</span>
                  </div>
                  <button onClick={() => removerContacto(c.id)} className="text-red-400 hover:text-red-600 text-xs transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sinais Vitais */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Sinais Vitais</span>
          {['enfermeiro', 'auxiliar', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'].includes(utilizador?.role ?? '') && (
            <BtnAdd label="Registar sinais vitais" onClick={() => { setSvPressaoS(''); setSvPressaoD(''); setSvPulso(''); setSvTemp(''); setSvSpO2(''); setSvFreqResp(''); setSvPeso(''); setSvNotas(''); setModalSinalVital(true); }} />
          )}
        </div>
        {sinaisVitais.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>Sem registos de sinais vitais</p>
        ) : (
          <>
            {/* Gráfico */}
            {sinaisVitais.length > 1 && (
              <div style={{ marginBottom: '24px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[...sinaisVitais].reverse().map((sv) => ({
                    hora: new Date(sv.data).toLocaleTimeString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    TA: sv.pressaoSistolica ?? null,
                    Pulso: sv.pulso ?? null,
                    'SpO₂': sv.saturacaoO2 ?? null,
                    'Temp': sv.temperatura ?? null,
                  }))}>
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="TA" stroke="#ef4444" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="Pulso" stroke="#f97316" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="SpO₂" stroke="#3b82f6" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="Temp" stroke="#8b5cf6" dot={false} strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left pb-2">Data/Hora</th>
                    <th className="text-center pb-2">TA (mmHg)</th>
                    <th className="text-center pb-2">Pulso</th>
                    <th className="text-center pb-2">Temp ºC</th>
                    <th className="text-center pb-2">SpO₂ %</th>
                    <th className="text-center pb-2">FR</th>
                    <th className="text-left pb-2">Registado por</th>
                  </tr>
                </thead>
                <tbody>
                  {sinaisVitais.map((sv: any) => {
                    const taCrit = sv.pressaoSistolica != null && (sv.pressaoSistolica >= 160 || sv.pressaoSistolica < 80);
                    const pulsoCrit = sv.pulso != null && (sv.pulso > 120 || sv.pulso < 50);
                    const tempCrit = sv.temperatura != null && (sv.temperatura > 38.5 || sv.temperatura < 35);
                    const spO2Crit = sv.saturacaoO2 != null && sv.saturacaoO2 < 90;
                    return (
                      <tr key={sv.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5 text-slate-500 text-xs">{new Date(sv.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className={`py-2.5 text-center font-semibold ${taCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.pressaoSistolica != null ? `${sv.pressaoSistolica}/${sv.pressaoDiastolica}` : '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${pulsoCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.pulso ?? '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${tempCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.temperatura != null ? sv.temperatura.toFixed(1) : '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${spO2Crit ? 'text-red-600' : 'text-slate-700'}`}>{sv.saturacaoO2 != null ? `${sv.saturacaoO2}%` : '—'}</td>
                        <td className="py-2.5 text-center text-slate-600">{sv.frequenciaRespiratoria ?? '—'}</td>
                        <td className="py-2.5 text-slate-400 text-xs">{sv.registadoPor?.nome}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Escalas de Risco ── */}
      {(() => {
        const riscoConfig: Record<string, { cor: string; label: string }> = {
          muito_alto: { cor: 'bg-red-100 text-red-700',    label: 'Muito Alto' },
          alto:       { cor: 'bg-orange-100 text-orange-700', label: 'Alto' },
          moderado:   { cor: 'bg-yellow-100 text-yellow-700', label: 'Moderado' },
          baixo:      { cor: 'bg-green-100 text-green-700',  label: 'Baixo' },
        };
        const podeAvaliar = ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'].includes(utilizador?.role ?? '');
        return (
          <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
            {(['braden', 'morse'] as const).map((tipo) => {
              const av = tipo === 'braden' ? escalas.braden : escalas.morse;
              const titulo = tipo === 'braden' ? 'Escala de Braden' : 'Escala de Morse';
              const subtitulo = tipo === 'braden' ? 'Risco úlceras de pressão' : 'Risco de queda';
              return (
                <div key={tipo} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-slate-700">{titulo}</span>
                      <p className="text-xs text-slate-400">{subtitulo}</p>
                    </div>
                    {podeAvaliar && (
                      <button
                        onClick={() => { setEscalaItens({}); setModalEscala(tipo); }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                        style={{ padding: '4px 10px' }}>
                        + Avaliar
                      </button>
                    )}
                  </div>
                  {av ? (
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-900">{av.pontuacao}</div>
                        <div className="text-xs text-slate-400" style={{ marginTop: '2px' }}>pontos</div>
                      </div>
                      <div className="flex-1">
                        <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${riscoConfig[av.risco]?.cor ?? 'bg-slate-100 text-slate-600'}`}>
                          {riscoConfig[av.risco]?.label ?? av.risco}
                        </span>
                        <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>
                          Avaliado por {av.registadoPor?.nome?.split(' ')[0]} · {new Date(av.criadaEm).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem avaliação registada</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Exames Complementares ── */}
      {(() => {
        const TIPO_EXAME_LABELS: Record<string, string> = {
          analise_clinica: 'Análise Clínica', rx: 'Raio-X', eco: 'Ecografia',
          tc: 'TC', rmn: 'RMN', ecg: 'ECG', outro: 'Outro',
        };
        const ESTADO_EXAME_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
          solicitado:            { label: 'Solicitado',            bg: 'bg-blue-50',   text: 'text-blue-700' },
          em_progresso:         { label: 'Em Progresso',          bg: 'bg-amber-50',  text: 'text-amber-700' },
          resultado_disponivel: { label: 'Resultado Disponível',  bg: 'bg-green-50',  text: 'text-green-700' },
          cancelado:            { label: 'Cancelado',             bg: 'bg-slate-100', text: 'text-slate-600' },
        };
        const podeSolicitar = ['medico', 'chefe_medicos'].includes(utilizador?.role ?? '');
        const podeRegistarResultado = ['medico', 'chefe_medicos', 'tecnico_farmacia', 'administrativo'].includes(utilizador?.role ?? '');

        const solicitarExame = async () => {
          if (!exameForm.descricao.trim()) return;
          setSalvandoExame(true);
          try {
            await api.post(`/exames/${id}`, exameForm);
            setModalExame(false);
            setExameForm({ tipo: 'analise_clinica', descricao: '', urgente: false });
            carregarExames();
          } finally { setSalvandoExame(false); }
        };

        const registarResultado = async () => {
          if (!resultadoModal || !resultadoTexto.trim()) return;
          setSalvandoExame(true);
          try {
            await api.patch(`/exames/${resultadoModal.id}/resultado`, { resultado: resultadoTexto });
            setResultadoModal(null);
            setResultadoTexto('');
            carregarExames();
          } finally { setSalvandoExame(false); }
        };

        const cancelarExame = async (exameId: string) => {
          if (!confirm('Cancelar este exame?')) return;
          await api.patch(`/exames/${exameId}/cancelar`);
          carregarExames();
        };

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Exames Complementares</span>
              {podeSolicitar && <BtnAdd label="Solicitar exame" onClick={() => { setExameForm({ tipo: 'analise_clinica', descricao: '', urgente: false }); setModalExame(true); }} />}
            </div>
            {exames.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>Sem exames solicitados</p>
            ) : (
              <div className="flex flex-col gap-3">
                {exames.map((e: any) => {
                  const cfg = ESTADO_EXAME_CONFIG[e.estado] ?? ESTADO_EXAME_CONFIG.solicitado;
                  return (
                    <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '14px 16px' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{TIPO_EXAME_LABELS[e.tipo] ?? e.tipo}</span>
                          {e.urgente && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">URGENTE</span>}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <p className="text-sm text-slate-700">{e.descricao}</p>
                        {e.resultado && (
                          <p className="text-sm text-slate-600 bg-green-50 rounded-lg border border-green-100 mt-2" style={{ padding: '8px 12px' }}>
                            <span className="font-semibold text-green-700">Resultado:</span> {e.resultado}
                          </p>
                        )}
                        <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>
                          Por {e.solicitadoPor?.nome} · {new Date(e.criadoEm).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {podeRegistarResultado && ['solicitado', 'em_progresso'].includes(e.estado) && (
                          <button onClick={() => { setResultadoModal(e); setResultadoTexto(''); }}
                            className="text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
                            style={{ padding: '6px 12px' }}>
                            Resultado
                          </button>
                        )}
                        {podeSolicitar && e.estado === 'solicitado' && (
                          <button onClick={() => cancelarExame(e.id)}
                            className="text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            style={{ padding: '6px 12px' }}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal: Solicitar Exame */}
            {modalExame && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
                    <h2 className="text-lg font-bold text-slate-900">Solicitar Exame</h2>
                    <button onClick={() => setModalExame(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo de Exame</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(TIPO_EXAME_LABELS).map(([v, l]) => (
                        <button key={v} onClick={() => setExameForm(f => ({ ...f, tipo: v }))}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${exameForm.tipo === v ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-200 text-slate-600 hover:border-sky-300'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição *</label>
                    <textarea value={exameForm.descricao} onChange={e => setExameForm(f => ({ ...f, descricao: e.target.value }))}
                      rows={3} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                      style={{ padding: '10px 14px' }} placeholder="Descreva o exame solicitado..." />
                  </div>
                  <div className="flex items-center gap-2" style={{ marginBottom: '24px' }}>
                    <input type="checkbox" id="exameUrgente" checked={exameForm.urgente} onChange={e => setExameForm(f => ({ ...f, urgente: e.target.checked }))}
                      className="w-4 h-4 accent-red-600" />
                    <label htmlFor="exameUrgente" className="text-sm font-medium text-red-600">Urgente</label>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setModalExame(false)}
                      className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                      style={{ padding: '11px' }}>Cancelar</button>
                    <button onClick={solicitarExame} disabled={salvandoExame || !exameForm.descricao.trim()}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                      style={{ padding: '11px' }}>
                      {salvandoExame ? 'A solicitar...' : 'Solicitar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Registar Resultado */}
            {resultadoModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
                    <h2 className="text-lg font-bold text-slate-900">Registar Resultado</h2>
                    <button onClick={() => setResultadoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
                  </div>
                  <p className="text-slate-600 text-sm" style={{ marginBottom: '20px' }}>
                    {TIPO_EXAME_LABELS[resultadoModal.tipo] ?? resultadoModal.tipo} — {resultadoModal.descricao}
                  </p>
                  <div style={{ marginBottom: '24px' }}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Resultado *</label>
                    <textarea value={resultadoTexto} onChange={e => setResultadoTexto(e.target.value)}
                      rows={4} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                      style={{ padding: '10px 14px' }} placeholder="Descreva o resultado do exame..." />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setResultadoModal(null)}
                      className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                      style={{ padding: '11px' }}>Cancelar</button>
                    <button onClick={registarResultado} disabled={salvandoExame || !resultadoTexto.trim()}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                      style={{ padding: '11px' }}>
                      {salvandoExame ? 'A guardar...' : 'Guardar Resultado'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Notas Clínicas SOAP ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const podeCriarNotaClinica = ['medico', 'medico_especialista', 'cirurgiao', 'anestesiologista',
          'chefe_medicos', 'enfermeiro', 'enfermeiro_especialista', 'enfermeiro_gestor', 'chefe_enfermeiros'].includes(role);
        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Notas Clínicas SOAP</span>
              {notasClincias.length > 0 && (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                  {notasClincias.length}
                </span>
              )}
              {podeCriarNotaClinica && (
                <BtnAdd label="Adicionar nota clínica SOAP" onClick={() => {
                  setSoapForm({ subjetivo: '', objetivo: '', avaliacao: '', plano: '' });
                  setNotaSoapEditandoId(null);
                  setModalNotaClinica(true);
                }} />
              )}
            </div>
            {notasClincias.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>
                {podeCriarNotaClinica ? 'Sem notas SOAP — clica em + para adicionar' : 'Sem notas clínicas registadas'}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {notasClincias.map((n: any) => (
                  <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '16px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">{n.autor?.nome}</span>
                        <span className="text-slate-300 text-xs">·</span>
                        <span className="text-xs text-slate-400">
                          {new Date(n.criadaEm).toLocaleDateString('pt-PT')} {new Date(n.criadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {n.editadaEm && <span className="text-xs text-slate-400 italic">(editada)</span>}
                      </div>
                      {podeCriarNotaClinica && n.autor?.id === utilizador?.id && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setSoapForm({ subjetivo: n.subjetivo, objetivo: n.objetivo, avaliacao: n.avaliacao, plano: n.plano }); setNotaSoapEditandoId(n.id); setModalNotaClinica(true); }}
                            className="text-xs text-slate-400 hover:text-emerald-600 transition-colors" style={{ padding: '4px 8px' }}>Editar</button>
                          <button onClick={() => apagarNotaClinica(n.id)}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors" style={{ padding: '4px 8px' }}>Apagar</button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'subjetivo', label: 'S — Subjetivo', cor: 'blue' },
                        { key: 'objetivo', label: 'O — Objetivo', cor: 'purple' },
                        { key: 'avaliacao', label: 'A — Avaliação', cor: 'amber' },
                        { key: 'plano', label: 'P — Plano', cor: 'green' },
                      ].map(({ key, label, cor }) => (
                        <div key={key} className={`rounded-lg bg-${cor}-50 border border-${cor}-100`} style={{ padding: '10px 12px' }}>
                          <p className={`text-xs font-bold text-${cor}-600 uppercase tracking-wide`} style={{ marginBottom: '4px' }}>{label}</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{(n as any)[key]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Escalas Clínicas Especializadas ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const subRole = utilizador?.subRole ?? '';
        const podeRegistarEscala = ['enfermeiro', 'enfermeiro_especialista', 'enfermeiro_gestor',
          'chefe_enfermeiros', 'medico', 'medico_especialista', 'chefe_medicos'].includes(role);

        const escalasDisponiveis = (() => {
          if (['enf_uci'].includes(subRole)) return ['RASS', 'CPOT', 'SOFA'];
          if (['enf_obstetricia', 'ginecologista'].includes(subRole)) return ['CTG', 'Apgar'];
          if (['enf_pediatria', 'pediatra'].includes(subRole)) return ['Apgar', 'PEWS', 'FLACC'];
          if (['fisioterapeuta', 'reabilitacao_fisica', 'reabilitacao_fala'].includes(subRole)) return ['Barthel', 'MRC', 'FOIS'];
          if (['nutricao_clinica'].includes(subRole)) return ['NRS2002', 'Barthel'];
          if (['psicologia_clinica'].includes(subRole)) return ['PHQ9', 'GAD7'];
          return Object.keys(ESCALA_CONFIG);
        })();

        const COR_ESCALAS: Record<string, string> = {
          RASS: 'violet', CPOT: 'rose', SOFA: 'red', CTG: 'pink', Apgar: 'blue', PEWS: 'amber', FLACC: 'orange',
          Barthel: 'green', MRC: 'blue', FOIS: 'teal', NRS2002: 'amber', PHQ9: 'purple', GAD7: 'teal',
        };

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Escalas Clínicas</span>
              {escalasClinicas.length > 0 && (
                <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                  {escalasClinicas.length} registos
                </span>
              )}
              {podeRegistarEscala && (
                <BtnAdd label="Registar escala clínica" onClick={() => {
                  setTipoEscalaClinica(escalasDisponiveis[0] ?? 'RASS');
                  setValoresEscalaClinica({});
                  setModalEscalaClinica(true);
                }} />
              )}
            </div>
            {escalasClinicas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>
                {podeRegistarEscala ? 'Sem escalas registadas — clica em + para adicionar' : 'Sem escalas registadas'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {escalasClinicas.map((e: any) => {
                  const cor = COR_ESCALAS[e.tipo] ?? 'slate';
                  return (
                    <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '14px 16px' }}>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg bg-${cor}-100 text-${cor}-700`}>{e.tipo}</span>
                        <div>
                          {e.pontuacao !== null && e.pontuacao !== undefined && (
                            <p className="text-sm font-semibold text-slate-800">
                              Pontuação: <span className={`text-${cor}-700`}>{e.pontuacao}</span>
                            </p>
                          )}
                          {e.classificacao && (
                            <p className="text-xs text-slate-500">{e.classificacao}</p>
                          )}
                          <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>
                            {e.registadoPor?.nome} · {new Date(e.registadaEm).toLocaleDateString('pt-PT')} {new Date(e.registadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Interconsultas ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const podeCriarInterc = ['medico', 'medico_especialista', 'cirurgiao', 'anestesiologista', 'chefe_medicos'].includes(role);
        const podeResponder = ['medico', 'medico_especialista', 'cirurgiao', 'anestesiologista', 'chefe_medicos'].includes(role);
        const estadoCor: Record<string, string> = {
          pendente: 'bg-amber-50 text-amber-700',
          aceite: 'bg-blue-50 text-blue-700',
          respondida: 'bg-green-50 text-green-700',
          cancelada: 'bg-slate-100 text-slate-500',
        };
        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Interconsultas</span>
              {interconsultas.filter((i: any) => i.estado === 'pendente').length > 0 && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                  {interconsultas.filter((i: any) => i.estado === 'pendente').length} pendente(s)
                </span>
              )}
              {podeCriarInterc && (
                <BtnAdd label="Solicitar interconsulta" onClick={() => { setIntercMotivo(''); setIntercUrgente(false); setModalInterconsulta(true); }} />
              )}
            </div>
            {interconsultas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem interconsultas registadas</p>
            ) : (
              <div className="flex flex-col gap-3">
                {interconsultas.map((ic: any) => (
                  <div key={ic.id} className="border border-slate-100 rounded-xl" style={{ padding: '14px 16px' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{ic.especialidadeAlvo}</span>
                          {ic.urgente && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Urgente</span>}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoCor[ic.estado] ?? 'bg-slate-100 text-slate-500'}`}>{ic.estado}</span>
                        </div>
                        <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>{ic.motivo}</p>
                        <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>
                          Por {ic.requisitante?.nome} · {new Date(ic.criadaEm).toLocaleDateString('pt-PT')}
                        </p>
                        {ic.resposta && (
                          <div className="bg-green-50 rounded-lg" style={{ padding: '10px 12px', marginTop: '8px' }}>
                            <p className="text-xs font-semibold text-green-700" style={{ marginBottom: '2px' }}>Resposta de {ic.medicoResposta?.nome}</p>
                            <p className="text-xs text-green-800">{ic.resposta}</p>
                          </div>
                        )}
                      </div>
                      {podeResponder && ic.estado !== 'respondida' && ic.estado !== 'cancelada' && (
                        <button onClick={() => { setModalIntercResposta(ic.id); setIntercResposta(''); }}
                          className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                          style={{ padding: '6px 12px' }}>Responder</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Dispositivos Invasivos ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const visivel = ['enfermeiro', 'enfermeiro_especialista', 'medico', 'medico_especialista',
          'cirurgiao', 'anestesiologista', 'chefe_medicos', 'chefe_enfermeiros'].includes(role);
        if (!visivel) return null;
        const podeRegistar = ['enfermeiro', 'enfermeiro_especialista', 'chefe_enfermeiros', 'medico', 'medico_especialista', 'cirurgiao', 'anestesiologista'].includes(role);

        const TIPOS_DISP: Record<string, string> = {
          cateter_venoso_central: 'CVC', cateter_venoso_periferico: 'CVP', cateter_arterial: 'Cateter Arterial',
          sonda_vesical: 'Sonda Vesical', tubo_orotaqueal: 'TOT', traqueostomia: 'Traqueostomia',
          dreno_toracico: 'Dreno Torácico', sonda_nasogastrica: 'SNG', linha_epidural: 'Linha Epidural', outro: 'Outro',
        };
        const COR_TIPO: Record<string, string> = {
          cateter_venoso_central: 'bg-blue-50 text-blue-700', cateter_venoso_periferico: 'bg-sky-50 text-sky-700',
          cateter_arterial: 'bg-red-50 text-red-700', sonda_vesical: 'bg-yellow-50 text-yellow-700',
          tubo_orotaqueal: 'bg-orange-50 text-orange-700', traqueostomia: 'bg-orange-50 text-orange-700',
          dreno_toracico: 'bg-purple-50 text-purple-700', sonda_nasogastrica: 'bg-teal-50 text-teal-700',
          linha_epidural: 'bg-green-50 text-green-700', outro: 'bg-slate-100 text-slate-600',
        };

        const ativos = dispositivos.filter((d: any) => d.ativo);
        const diasInsercao = (data: string) => Math.floor((Date.now() - new Date(data).getTime()) / 86400000);

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Dispositivos Invasivos</span>
              {ativos.length > 0 && (
                <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                  {ativos.length} ativo{ativos.length !== 1 ? 's' : ''}
                </span>
              )}
              {podeRegistar && (
                <BtnAdd label="Registar dispositivo invasivo" onClick={() => { setDispTipo('cateter_venoso_central'); setDispLocalizacao(''); setDispObservacoes(''); setModalDispositivo(true); }} />
              )}
            </div>
            {ativos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem dispositivos invasivos ativos</p>
            ) : (
              <div className="flex flex-col gap-2">
                {ativos.map((d: any) => {
                  const dias = diasInsercao(d.dataInsercao);
                  return (
                    <div key={d.id} className="flex items-center gap-3 border border-slate-100 rounded-xl" style={{ padding: '12px 16px' }}>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${COR_TIPO[d.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                        {TIPOS_DISP[d.tipo] ?? d.tipo}
                      </span>
                      <div className="flex-1 min-w-0">
                        {d.localizacao && <p className="text-xs text-slate-600">{d.localizacao}</p>}
                        <p className="text-xs text-slate-400">
                          Inserido há {dias} dia{dias !== 1 ? 's' : ''} · {d.inseridoPor?.nome}
                        </p>
                        {dias >= 3 && (
                          <p className="text-xs text-amber-600 font-medium" style={{ marginTop: '2px' }}>⚠ Avaliar substituição</p>
                        )}
                      </div>
                      {podeRegistar && (
                        <button onClick={() => removerDispositivo(d.id)}
                          className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                          style={{ padding: '5px 10px' }}>Remover</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Modal Alergia ── */}
      {modalAlergia && (
        <Modal titulo="Registar Alergia" onClose={() => setModalAlergia(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Agente alérgeno *</label>
            <input type="text" value={alergenio} onChange={(e) => setAlergenio(e.target.value)} placeholder="Ex: Penicilina, Ibuprofeno..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {['medicamento', 'alimento', 'ambiental', 'outro'].map((t) => (
                <button key={t} onClick={() => setAlergiaTipo(t)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${alergiaTipo === t ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Severidade</label>
            <div className="flex gap-2 flex-wrap">
              {['ligeira', 'moderada', 'grave', 'anafilaxia'].map((s) => (
                <button key={s} onClick={() => setAlergiaSev(s)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${alergiaSev === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Notas</label>
            <input type="text" value={alergiaNotas} onChange={(e) => setAlergiaNotas(e.target.value)} placeholder="Observações..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <ModalFooter onCancel={() => setModalAlergia(false)} onConfirm={submeterAlergia} loading={salvando} disabled={!alergenio.trim() || salvando} labelConfirm="Registar" />
        </Modal>
      )}

      {/* ── Modal Contacto ── */}
      {modalContacto && (
        <Modal titulo="Contacto de Emergência" onClose={() => setModalContacto(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nome *</label>
            <input type="text" value={ctNome} onChange={(e) => setCtNome(e.target.value)} placeholder="Nome completo" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Relação</label>
            <div className="flex gap-2 flex-wrap">
              {['cônjuge', 'filho/a', 'pai/mãe', 'outro'].map((r) => (
                <button key={r} onClick={() => setCtRelacao(r)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${ctRelacao === r ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Telefone *</label>
            <input type="tel" value={ctTel} onChange={(e) => setCtTel(e.target.value)} placeholder="9xx xxx xxx" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer" style={{ marginBottom: '16px' }}>
            <input type="checkbox" checked={ctPrincipal} onChange={(e) => setCtPrincipal(e.target.checked)} className="w-4 h-4 rounded" />
            Contacto principal
          </label>
          <ModalFooter onCancel={() => setModalContacto(false)} onConfirm={submeterContacto} loading={salvando} disabled={!ctNome.trim() || !ctTel.trim() || salvando} labelConfirm="Guardar" />
        </Modal>
      )}

      {/* ── Modal Sinal Vital ── */}
      {modalSinalVital && (
        <Modal titulo="Registar Sinais Vitais" onClose={() => setModalSinalVital(false)}>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
            {[
              { label: 'TA Sistólica (mmHg)', val: svPressaoS, set: setSvPressaoS, ph: '120' },
              { label: 'TA Diastólica (mmHg)', val: svPressaoD, set: setSvPressaoD, ph: '80' },
              { label: 'Pulso (bpm)', val: svPulso, set: setSvPulso, ph: '72' },
              { label: 'Temperatura (ºC)', val: svTemp, set: setSvTemp, ph: '36.5' },
              { label: 'SpO₂ (%)', val: svSpO2, set: setSvSpO2, ph: '98' },
              { label: 'Freq. Resp. (rpm)', val: svFreqResp, set: setSvFreqResp, ph: '16' },
            ].map(({ label, val, set, ph }) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>{label}</label>
                <input type="number" value={val} onChange={(e) => set(e.target.value)} placeholder={ph} className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '8px 12px' }} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Peso (kg)</label>
            <input type="number" value={svPeso} onChange={(e) => setSvPeso(e.target.value)} placeholder="70.5" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '8px 12px' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Notas</label>
            <textarea rows={2} value={svNotas} onChange={(e) => setSvNotas(e.target.value)} placeholder="Observações..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" style={{ padding: '8px 12px' }} />
          </div>
          <ModalFooter onCancel={() => setModalSinalVital(false)} onConfirm={submeterSinalVital} loading={salvando} disabled={salvando} labelConfirm="Guardar" />
        </Modal>
      )}

      {/* ── Modal Nota ── */}
      {modalNota && (
        <Modal titulo="Adicionar Nota de Turno" onClose={() => setModalNota(false)}>
          <div style={{ marginBottom: '20px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nota</label>
            <textarea
              autoFocus
              rows={5}
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Escreve a nota de turno..."
              className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: '12px 14px' }}
            />
          </div>
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalNota(false)} onConfirm={submeterNota}
            loading={salvando} disabled={!notaTexto.trim()} labelConfirm="Guardar Nota" />
        </Modal>
      )}

      {/* ── Modal Tarefa ── */}
      {modalTarefa && (
        <Modal titulo="Criar Tarefa" onClose={() => setModalTarefa(false)}>
          <div className="flex flex-col gap-4" style={{ marginBottom: '20px' }}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Descrição *</label>
              <input autoFocus type="text" value={tarefaDesc} onChange={(e) => setTarefaDesc(e.target.value)}
                placeholder="Descrição da tarefa..."
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Tipo</label>
                <select value={tarefaTipo} onChange={(e) => setTarefaTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="clinica">Clínica</option>
                  <option value="logistica">Logística</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Prioridade</label>
                <select value={tarefaPrioridade} onChange={(e) => setTarefaPrioridade(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Para</label>
              <select value={tarefaGrupo} onChange={(e) => setTarefaGrupo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }}>
                {gruposDisponiveis.map((g) => (
                  <option key={g} value={g}>{grupoLabel[g]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Prazo (opcional)</label>
              <input type="datetime-local" value={tarefaPrazo} onChange={(e) => setTarefaPrazo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }} />
            </div>
          </div>
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalTarefa(false)} onConfirm={submeterTarefa}
            loading={salvando} disabled={!tarefaDesc.trim() || !tarefaGrupo} labelConfirm="Criar Tarefa" />
        </Modal>
      )}

      {/* ── Modal Medicação ── */}
      {modalMed && (
        <Modal titulo="Prescrever Medicação" onClose={() => setModalMed(false)}>
          <div className="flex flex-col gap-4" style={{ marginBottom: '20px' }}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nome do medicamento *</label>
              <input autoFocus type="text" value={medNome} onChange={(e) => setMedNome(e.target.value)}
                placeholder="Ex: Paracetamol"
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Dose *</label>
                <input type="text" value={medDose} onChange={(e) => setMedDose(e.target.value)}
                  placeholder="Ex: 500mg"
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Via *</label>
                <select value={medVia} onChange={(e) => setMedVia(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Selecionar...</option>
                  <option value="oral">Oral</option>
                  <option value="intravenosa">Intravenosa</option>
                  <option value="intramuscular">Intramuscular</option>
                  <option value="subcutanea">Subcutânea</option>
                  <option value="topica">Tópica</option>
                  <option value="inalatoria">Inalatória</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Frequência *</label>
              <select value={medFreq} onChange={(e) => setMedFreq(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }}>
                <option value="">Selecionar...</option>
                <option value="SOS">SOS (em SOS)</option>
                <option value="1x/dia">1x por dia</option>
                <option value="2x/dia">2x por dia</option>
                <option value="3x/dia">3x por dia</option>
                <option value="4x/dia">4x por dia</option>
                <option value="6x/dia">6x por dia (4/4h)</option>
                <option value="8x/dia">8x por dia (3/3h)</option>
                <option value="contínua">Contínua (perfusão)</option>
              </select>
            </div>
          </div>
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalMed(false)} onConfirm={submeterMed}
            loading={salvando} disabled={!medNome.trim() || !medDose.trim() || !medVia || !medFreq} labelConfirm="Prescrever" />
        </Modal>
      )}

      {/* ── Modal Histórico de Medicação ── */}
      {modalHistoricoMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '32px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">Histórico de Medicação</h2>
              </div>
              <button onClick={() => setModalHistoricoMed(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingHistoricoMed ? (
                <div className="flex items-center justify-center gap-2 text-slate-400" style={{ padding: '40px 0' }}>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">A carregar...</span>
                </div>
              ) : medHistorico.length === 0 ? (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '40px 0' }}>Sem medicações concluídas</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {medHistorico.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 14px' }}>
                      <svg className="w-4 h-4 text-slate-400 shrink-0" style={{ marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{m.nome}</p>
                        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{m.dose} · {m.via} · {m.frequencia}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                          <span className="text-xs text-slate-400">
                            Início: {new Date(m.iniciadoEm).toLocaleDateString('pt-PT')}
                          </span>
                          {m.terminadoEm && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">
                                Fim: {new Date(m.terminadoEm).toLocaleDateString('pt-PT')}
                              </span>
                            </>
                          )}
                          {m.prescritoPor && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">Por {m.prescritoPor.nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Histórico de Tarefas ── */}
      {modalHistorico && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '560px', padding: '32px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">Histórico de Tarefas</h2>
              </div>
              <button onClick={() => setModalHistorico(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingHistorico ? (
                <div className="flex items-center justify-center gap-2 text-slate-400" style={{ padding: '40px 0' }}>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">A carregar...</span>
                </div>
              ) : tarefasHistorico.length === 0 ? (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '40px 0' }}>Sem tarefas concluídas</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {tarefasHistorico.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 14px' }}>
                      <svg className="w-4 h-4 text-green-500 shrink-0" style={{ marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{t.descricao}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                          {t.concluidaEm && (
                            <span className="text-xs text-slate-400">
                              Concluída {new Date(t.concluidaEm).toLocaleDateString('pt-PT')} às {new Date(t.concluidaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {t.responsavel && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-500">{t.responsavel.nome}</span>
                            </>
                          )}
                          {t.criadoPor && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">Por {t.criadoPor.nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${prioridadeCor[t.prioridade]}`}>
                        {prioridadeLabel[t.prioridade]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Doente */}
      {modalEditarDoente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Editar Dados Clínicos</h2>
              <button onClick={() => setModalEditarDoente(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Diagnóstico Principal</label>
              <input type="text" value={editDiagnostico} onChange={(e) => setEditDiagnostico(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Alta Prevista</label>
              <input type="date" value={editAltaPrevista} onChange={(e) => setEditAltaPrevista(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalEditarDoente(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterEdicaoDoente} disabled={salvandoEdicao}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoEdicao ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {modalQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '380px', padding: '32px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h3 className="text-lg font-bold text-slate-900">QR Code do Doente</h3>
              <button onClick={() => setModalQR(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* QR Code */}
            <div id="qr-print-area" className="flex flex-col items-center" style={{ gap: '16px' }}>
              <div className="bg-white border border-slate-100 rounded-2xl" style={{ padding: '20px' }}>
                <QRCode value={doente.id} size={180} />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900" style={{ fontSize: '15px' }}>{doente.nome}</p>
                <p className="text-slate-400 font-mono text-xs" style={{ marginTop: '4px' }}>{doente.numeroProcesso}</p>
                <p className="text-slate-400 text-xs" style={{ marginTop: '2px' }}>Cama {doente.cama.quarto}/{doente.cama.numero}</p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => setModalQR(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Fechar
              </button>
              <button
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (!win) return;
                  win.document.write(`
                    <html><head><title>QR - ${doente.nome}</title>
                    <style>
                      body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; gap: 12px; }
                      .nome { font-size: 18px; font-weight: 700; color: #0f172a; }
                      .sub { font-size: 12px; color: #94a3b8; font-family: monospace; }
                    </style></head>
                    <body>
                      <div id="qr"></div>
                      <p class="nome">${doente.nome}</p>
                      <p class="sub">${doente.numeroProcesso} · Cama ${doente.cama.quarto}/${doente.cama.numero}</p>
                      <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
                      <script>QRCode.toCanvas(document.getElementById('qr'), '${doente.id}', { width: 220 }, function() { window.print(); window.close(); });</script>
                    </body></html>
                  `);
                  win.document.close();
                }}
                className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
                style={{ padding: '11px' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Alta Estruturada ── */}
      {modalAltaEstruturada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '540px', padding: '32px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Dar Alta — {doente.nome}</h2>
              <button onClick={() => setModalAltaEstruturada(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Motivo */}
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Motivo de Alta</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'melhoria', label: 'Melhoria Clínica' },
                  { value: 'transferencia', label: 'Transferência' },
                  { value: 'pedido_proprio', label: 'Pedido Próprio' },
                  { value: 'obito', label: 'Óbito' },
                ].map((op) => (
                  <button key={op.value} type="button"
                    onClick={() => setAltaMotivo(op.value)}
                    className={`text-sm font-medium rounded-xl border transition-all text-left ${altaMotivo === op.value ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                    style={{ padding: '10px 14px' }}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Destino (se não for óbito) */}
            {altaMotivo !== 'obito' && (
              <div style={{ marginBottom: '20px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Destino</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'domicilio', label: 'Domicílio' },
                    { value: 'outro_hospital', label: 'Outro Hospital' },
                    { value: 'lar', label: 'Lar/Institucional' },
                    { value: 'outro', label: 'Outro' },
                  ].map((op) => (
                    <button key={op.value} type="button"
                      onClick={() => setAltaDestino(op.value)}
                      className={`text-sm font-medium rounded-xl border transition-all ${altaDestino === op.value ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      style={{ padding: '6px 14px' }}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo clínico */}
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>
                Resumo Clínico <span className="text-red-500">*</span>
              </label>
              <textarea
                value={altaResumo}
                onChange={(e) => setAltaResumo(e.target.value)}
                rows={4}
                placeholder="Descreva o internamento, evolução e estado à data de alta..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none"
                style={{ padding: '10px 14px' }}
              />
            </div>

            {/* Prescrição de saída */}
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Prescrição de Saída <span className="text-slate-400 font-normal text-xs">(opcional)</span></label>
              <textarea
                value={altaPrescricao}
                onChange={(e) => setAltaPrescricao(e.target.value)}
                rows={2}
                placeholder="Ex: Amoxicilina 500mg 3×/dia 7 dias, Ibuprofeno 400mg SOS..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none"
                style={{ padding: '10px 14px' }}
              />
            </div>

            {/* Médico de família */}
            <div style={{ marginBottom: '28px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Médico de Família / Referenciação <span className="text-slate-400 font-normal text-xs">(opcional)</span></label>
              <input
                value={altaMedicoFamilia}
                onChange={(e) => setAltaMedicoFamilia(e.target.value)}
                placeholder="Nome ou contacto do médico de família..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalAltaEstruturada(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button onClick={submeterAltaEstruturada} disabled={salvandoAlta || !altaResumo.trim()}
                className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
                style={{ padding: '11px' }}>
                {salvandoAlta ? 'A processar...' : 'Confirmar Alta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Avaliação de Escala ── */}
      {modalEscala && (() => {
        const isBraden = modalEscala === 'braden';
        const bradenItens = [
          { key: 'percepcaoSensorial', label: 'Perceção Sensorial', opcoes: [{ v: 1, l: '1 — Completamente limitada' }, { v: 2, l: '2 — Muito limitada' }, { v: 3, l: '3 — Ligeiramente limitada' }, { v: 4, l: '4 — Sem limitação' }] },
          { key: 'humidade', label: 'Humidade', opcoes: [{ v: 1, l: '1 — Constantemente húmida' }, { v: 2, l: '2 — Muito húmida' }, { v: 3, l: '3 — Ocasionalmente húmida' }, { v: 4, l: '4 — Raramente húmida' }] },
          { key: 'atividade', label: 'Atividade', opcoes: [{ v: 1, l: '1 — Acamado' }, { v: 2, l: '2 — Cadeirante' }, { v: 3, l: '3 — Anda ocasionalmente' }, { v: 4, l: '4 — Anda frequentemente' }] },
          { key: 'mobilidade', label: 'Mobilidade', opcoes: [{ v: 1, l: '1 — Completamente imóvel' }, { v: 2, l: '2 — Muito limitada' }, { v: 3, l: '3 — Ligeiramente limitada' }, { v: 4, l: '4 — Sem limitações' }] },
          { key: 'nutricao', label: 'Nutrição', opcoes: [{ v: 1, l: '1 — Muito pobre' }, { v: 2, l: '2 — Provavelmente inadequada' }, { v: 3, l: '3 — Adequada' }, { v: 4, l: '4 — Excelente' }] },
          { key: 'friccaoCisalhamento', label: 'Fricção e Cisalhamento', opcoes: [{ v: 1, l: '1 — Problema' }, { v: 2, l: '2 — Problema potencial' }, { v: 3, l: '3 — Sem problema' }] },
        ];
        const morseItens = [
          { key: 'historiaQueda', label: 'História de queda nos últimos 3 meses', opcoes: [{ v: 0, l: 'Não — 0 pts' }, { v: 25, l: 'Sim — 25 pts' }] },
          { key: 'diagnosticoSecundario', label: 'Diagnóstico secundário', opcoes: [{ v: 0, l: 'Não — 0 pts' }, { v: 15, l: 'Sim — 15 pts' }] },
          { key: 'ajudaMarcha', label: 'Ajuda na marcha', opcoes: [{ v: 0, l: 'Nenhuma / repouso / cadeira de rodas — 0' }, { v: 15, l: 'Bengala / muleta / andarilho — 15' }, { v: 30, l: 'Apoio em mobiliário — 30' }] },
          { key: 'heparinaIV', label: 'Heparina IV / cateter salinizado', opcoes: [{ v: 0, l: 'Não — 0 pts' }, { v: 20, l: 'Sim — 20 pts' }] },
          { key: 'marchaTransferencia', label: 'Marcha / transferência', opcoes: [{ v: 0, l: 'Normal / repouso / imóvel — 0' }, { v: 10, l: 'Débil — 10' }, { v: 20, l: 'Comprometida — 20' }] },
          { key: 'estadoMental', label: 'Estado mental', opcoes: [{ v: 0, l: 'Consciente das limitações — 0' }, { v: 15, l: 'Sobrestima capacidades — 15' }] },
        ];
        const itensConfig = isBraden ? bradenItens : morseItens;
        const total = itensConfig.reduce((s, it) => s + (escalaItens[it.key] ?? 0), 0);
        const preenchido = itensConfig.every((it) => escalaItens[it.key] !== undefined);

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '560px', padding: '32px', maxHeight: '90vh' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <h2 className="text-xl font-bold text-slate-900">
                  {isBraden ? 'Escala de Braden' : 'Escala de Morse'}
                </h2>
                <button onClick={() => setModalEscala(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-sm text-slate-400" style={{ marginBottom: '24px' }}>
                {isBraden ? 'Avaliação do risco de úlceras de pressão (6–23 pts)' : 'Avaliação do risco de queda (0–125 pts)'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                {itensConfig.map((item) => (
                  <div key={item.key}>
                    <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>{item.label}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {item.opcoes.map((op) => (
                        <button key={op.v} type="button"
                          onClick={() => setEscalaItens((prev) => ({ ...prev, [item.key]: op.v }))}
                          className={`text-left text-sm rounded-lg border transition-all ${escalaItens[item.key] === op.v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                          style={{ padding: '8px 12px' }}>
                          {op.l}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pontuação em tempo real */}
              <div className="bg-slate-50 rounded-xl flex items-center justify-between" style={{ padding: '14px 18px', marginBottom: '20px' }}>
                <span className="text-sm font-semibold text-slate-600">Pontuação total</span>
                <span className="text-2xl font-bold text-indigo-700">{total}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setModalEscala(null)}
                  className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ padding: '11px' }}>
                  Cancelar
                </button>
                <button onClick={submeterEscala} disabled={salvando || !preenchido}
                  className="flex-1 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  style={{ padding: '11px' }}>
                  {salvando ? 'A guardar...' : 'Guardar Avaliação'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Nota Clínica SOAP ── */}
      {modalNotaClinica && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '600px', padding: '32px', maxHeight: '90vh', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">{notaSoapEditandoId ? 'Editar Nota SOAP' : 'Nova Nota Clínica SOAP'}</h2>
              <button onClick={() => setModalNotaClinica(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {[
              { key: 'subjetivo', label: 'S — Subjetivo', placeholder: 'O que o doente refere: queixas, sintomas, história...', cor: 'blue' },
              { key: 'objetivo', label: 'O — Objetivo', placeholder: 'Dados objetivos: exame físico, sinais vitais, resultados de exames...', cor: 'purple' },
              { key: 'avaliacao', label: 'A — Avaliação', placeholder: 'Avaliação clínica, diagnóstico diferencial, raciocínio...', cor: 'amber' },
              { key: 'plano', label: 'P — Plano', placeholder: 'Plano de ação: tratamento, exames a pedir, consultas, alta...', cor: 'green' },
            ].map(({ key, label, placeholder, cor }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <label className={`block text-xs font-bold text-${cor}-600 uppercase tracking-wide`} style={{ marginBottom: '6px' }}>{label}</label>
                <textarea value={(soapForm as any)[key]} onChange={e => setSoapForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={3} placeholder={placeholder}
                  className={`w-full border border-${cor}-200 rounded-xl text-sm bg-${cor}-50 focus:outline-none focus:ring-2 focus:ring-${cor}-400 resize-none`}
                  style={{ padding: '10px 14px' }} />
              </div>
            ))}
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setModalNotaClinica(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterNotaClinica} disabled={salvandoSoap || !soapForm.subjetivo.trim() || !soapForm.objetivo.trim() || !soapForm.avaliacao.trim() || !soapForm.plano.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoSoap ? 'A guardar...' : 'Guardar Nota'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Escala Clínica ── */}
      {modalEscalaClinica && (() => {
        const subRole = utilizador?.subRole ?? '';
        const escalasDisponiveis = (() => {
          if (['enf_uci'].includes(subRole)) return ['RASS', 'CPOT', 'SOFA'];
          if (['enf_obstetricia', 'ginecologista'].includes(subRole)) return ['CTG', 'Apgar'];
          if (['enf_pediatria', 'pediatra'].includes(subRole)) return ['Apgar', 'PEWS', 'FLACC'];
          if (['fisioterapeuta', 'reabilitacao_fisica', 'reabilitacao_fala'].includes(subRole)) return ['Barthel', 'MRC', 'FOIS'];
          if (['nutricao_clinica'].includes(subRole)) return ['NRS2002', 'Barthel'];
          if (['psicologia_clinica'].includes(subRole)) return ['PHQ9', 'GAD7'];
          return Object.keys(ESCALA_CONFIG);
        })();

        const cfg = ESCALA_CONFIG[tipoEscalaClinica];
        const pontuacaoAtual = cfg && tipoEscalaClinica !== 'CTG' ? cfg.calcularPontuacao(valoresEscalaClinica) : null;
        const classificacaoAtual = pontuacaoAtual !== null && cfg ? cfg.classificar(pontuacaoAtual) : '';
        const preenchido = cfg ? cfg.itens.every(it => valoresEscalaClinica[it.key] !== undefined) : false;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '560px', padding: '32px', maxHeight: '90vh', margin: '0 16px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <h2 className="text-xl font-bold text-slate-900">Registar Escala Clínica</h2>
                <button onClick={() => setModalEscalaClinica(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Seletor de tipo */}
              <div className="flex flex-wrap gap-2" style={{ marginBottom: '24px' }}>
                {escalasDisponiveis.map(tipo => (
                  <button key={tipo} onClick={() => { setTipoEscalaClinica(tipo); setValoresEscalaClinica({}); }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${tipoEscalaClinica === tipo ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-300'}`}>
                    {tipo}
                  </button>
                ))}
              </div>

              {cfg && (
                <>
                  <div className="flex flex-col gap-4" style={{ marginBottom: '20px' }}>
                    {cfg.itens.map(item => (
                      <div key={item.key}>
                        <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>{item.label}</p>
                        <div className="flex flex-col gap-2">
                          {item.opcoes.map(op => (
                            <button key={String(op.v)} type="button"
                              onClick={() => setValoresEscalaClinica(prev => ({ ...prev, [item.key]: op.v }))}
                              className={`text-left text-sm rounded-lg border transition-all ${valoresEscalaClinica[item.key] === op.v ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-300'}`}
                              style={{ padding: '8px 12px' }}>
                              {op.l}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {pontuacaoAtual !== null && (
                    <div className="bg-violet-50 rounded-xl flex items-center justify-between" style={{ padding: '14px 18px', marginBottom: '16px' }}>
                      <div>
                        <span className="text-sm font-semibold text-violet-700">Pontuação total</span>
                        {classificacaoAtual && <p className="text-xs text-violet-500" style={{ marginTop: '2px' }}>{classificacaoAtual}</p>}
                      </div>
                      <span className="text-3xl font-bold text-violet-700">{pontuacaoAtual}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setModalEscalaClinica(false)}
                      className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                      style={{ padding: '11px' }}>Cancelar</button>
                    <button onClick={submeterEscalaClinica} disabled={salvandoEscalaClinica || !preenchido}
                      className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                      style={{ padding: '11px' }}>
                      {salvandoEscalaClinica ? 'A guardar...' : 'Registar Escala'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Modal Interconsulta ── */}
      {modalInterconsulta && (
        <Modal titulo="Solicitar Interconsulta" onClose={() => setModalInterconsulta(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Especialidade *</label>
            <select value={intercEspecialidade} onChange={(e) => setIntercEspecialidade(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }}>
              {['Cardiologia','Neurologia','Nefrologia','Gastrenterologia','Pneumologia','Endocrinologia',
                'Ortopedia','Cirurgia Geral','Anestesiologia','Psiquiatria','Dermatologia','Medicina Interna',
                'Oncologia','Hematologia','Reumatologia','Urologia','Ginecologia','Pediatria','Oftalmologia'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
            <textarea value={intercMotivo} onChange={(e) => setIntercMotivo(e.target.value)}
              placeholder="Descreva o motivo da interconsulta..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px', marginBottom: '0' }} rows={3} />
          </div>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <input type="checkbox" id="interc-urgente" checked={intercUrgente} onChange={(e) => setIntercUrgente(e.target.checked)}
              className="w-4 h-4 rounded accent-red-600" />
            <label htmlFor="interc-urgente" className="text-sm font-medium text-red-600">Urgente</label>
          </div>
          <ModalFooter onCancel={() => setModalInterconsulta(false)} onConfirm={submeterInterconsulta}
            loading={salvandoInterc} disabled={!intercMotivo.trim() || salvandoInterc} labelConfirm="Solicitar" />
        </Modal>
      )}

      {/* ── Modal Resposta Interconsulta ── */}
      {modalIntercResposta && (
        <Modal titulo="Responder Interconsulta" onClose={() => setModalIntercResposta(null)}>
          <div style={{ marginBottom: '20px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Resposta clínica *</label>
            <textarea value={intercResposta} onChange={(e) => setIntercResposta(e.target.value)}
              placeholder="Escreva a sua avaliação e recomendações..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px' }} rows={5} />
          </div>
          <ModalFooter onCancel={() => setModalIntercResposta(null)}
            onConfirm={() => submeterResposta(modalIntercResposta)}
            loading={false} disabled={!intercResposta.trim()} labelConfirm="Responder" />
        </Modal>
      )}

      {/* ── Modal Dispositivo Invasivo ── */}
      {modalDispositivo && (
        <Modal titulo="Registar Dispositivo Invasivo" onClose={() => setModalDispositivo(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo *</label>
            <select value={dispTipo} onChange={(e) => setDispTipo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }}>
              {[
                ['cateter_venoso_central','Cateter Venoso Central (CVC)'],
                ['cateter_venoso_periferico','Cateter Venoso Periférico (CVP)'],
                ['cateter_arterial','Cateter Arterial'],
                ['sonda_vesical','Sonda Vesical'],
                ['tubo_orotaqueal','Tubo Orotaqueal (TOT)'],
                ['traqueostomia','Traqueostomia'],
                ['dreno_toracico','Dreno Torácico'],
                ['sonda_nasogastrica','Sonda Nasogástrica (SNG)'],
                ['linha_epidural','Linha Epidural'],
                ['outro','Outro'],
              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Localização / Acesso</label>
            <input type="text" value={dispLocalizacao} onChange={(e) => setDispLocalizacao(e.target.value)}
              placeholder="Ex: Subclávia D, Femoral E, Dorso mão esq..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
            <textarea value={dispObservacoes} onChange={(e) => setDispObservacoes(e.target.value)}
              placeholder="Calibre, lúmen, intercorrências..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px' }} rows={2} />
          </div>
          <ModalFooter onCancel={() => setModalDispositivo(false)} onConfirm={submeterDispositivo}
            loading={salvandoDisp} disabled={salvandoDisp} labelConfirm="Registar Dispositivo" />
        </Modal>
      )}
    </div>
  );
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement;
    const firstFocusable = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = ref.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
         style={{ backdropFilter: 'blur(4px)' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref}
           role="dialog"
           aria-modal="true"
           aria-labelledby="modal-titulo"
           className="bg-white rounded-2xl shadow-2xl w-full"
           style={{ maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 id="modal-titulo" className="text-xl font-bold text-slate-900">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar modal"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg aria-hidden="true" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErroBox({ texto }: { texto: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '16px' }}>
      {texto}
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, disabled, labelConfirm }: {
  onCancel: () => void; onConfirm: () => void; loading: boolean; disabled: boolean; labelConfirm: string;
}) {
  return (
    <div className="flex gap-3">
      <button onClick={onCancel}
        className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
        style={{ padding: '11px' }}>Cancelar</button>
      <button onClick={onConfirm} disabled={disabled || loading}
        className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        style={{ padding: '11px' }}>
        {loading ? 'A guardar...' : labelConfirm}
      </button>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
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
  Glasgow: {
    label: 'Glasgow (GCS)', cor: 'indigo',
    itens: [
      { key: 'ocular', label: 'Abertura Ocular (E)', opcoes: [
        { v: 1, l: 'E1 — Sem resposta' },
        { v: 2, l: 'E2 — À dor' },
        { v: 3, l: 'E3 — À voz' },
        { v: 4, l: 'E4 — Espontânea' },
      ]},
      { key: 'verbal', label: 'Resposta Verbal (V)', opcoes: [
        { v: 1, l: 'V1 — Sem resposta' },
        { v: 2, l: 'V2 — Sons incompreensíveis' },
        { v: 3, l: 'V3 — Palavras inapropriadas' },
        { v: 4, l: 'V4 — Confuso/desorientado' },
        { v: 5, l: 'V5 — Orientado' },
      ]},
      { key: 'motor', label: 'Resposta Motora (M)', opcoes: [
        { v: 1, l: 'M1 — Sem resposta' },
        { v: 2, l: 'M2 — Extensão (descerebração)' },
        { v: 3, l: 'M3 — Flexão anormal (decorticação)' },
        { v: 4, l: 'M4 — Retirada à dor' },
        { v: 5, l: 'M5 — Localiza a dor' },
        { v: 6, l: 'M6 — Obedece a ordens' },
      ]},
    ],
    calcularPontuacao: (v) => ((v['ocular'] as number) ?? 0) + ((v['verbal'] as number) ?? 0) + ((v['motor'] as number) ?? 0),
    classificar: (p) => p <= 8 ? 'Grave (TCE grave)' : p <= 12 ? 'Moderado' : 'Ligeiro',
  },
};

const COR_ESCALAS: Record<string, string> = {
  RASS: 'violet', CPOT: 'rose', SOFA: 'red', CTG: 'pink', Apgar: 'blue', PEWS: 'amber', FLACC: 'orange',
  Barthel: 'green', MRC: 'blue', FOIS: 'teal', NRS2002: 'amber', PHQ9: 'purple', GAD7: 'teal', Glasgow: 'indigo',
};

export function EscalasClinicasPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();

  const [escalasClinicas, setEscalasClinicas] = useState<any[]>([]);
  const [modalEscalaClinica, setModalEscalaClinica] = useState(false);
  const [tipoEscalaClinica, setTipoEscalaClinica] = useState('RASS');
  const [valoresEscalaClinica, setValoresEscalaClinica] = useState<Record<string, any>>({});
  const [salvandoEscalaClinica, setSalvandoEscalaClinica] = useState(false);

  const role = utilizador?.role ?? '';
  const subRole = (utilizador as any)?.subRole ?? '';
  const podeRegistarEscala = ['enfermeiro', 'medico'].includes(role);

  const escalasDisponiveis = (() => {
    if (['enf_uci'].includes(subRole)) return ['RASS', 'CPOT', 'SOFA'];
    if (['enf_obstetricia', 'ginecologista'].includes(subRole)) return ['CTG', 'Apgar'];
    if (['enf_pediatria', 'pediatra'].includes(subRole)) return ['Apgar', 'PEWS', 'FLACC'];
    if (['fisioterapeuta', 'reabilitacao_fisica', 'reabilitacao_fala'].includes(subRole)) return ['Barthel', 'MRC', 'FOIS'];
    if (['nutricao_clinica'].includes(subRole)) return ['NRS2002', 'Barthel'];
    if (['psicologia_clinica'].includes(subRole)) return ['PHQ9', 'GAD7'];
    return Object.keys(ESCALA_CONFIG);
  })();

  const carregarEscalasClinicas = () =>
    api.get(`/escalas-clinicas/${doenteId}`).then((r) => setEscalasClinicas(r.data)).catch(() => setEscalasClinicas([]));

  useEffect(() => {
    carregarEscalasClinicas();
  }, [doenteId]);

  const submeterEscalaClinica = async () => {
    setSalvandoEscalaClinica(true);
    try {
      const config = ESCALA_CONFIG[tipoEscalaClinica];
      const pontuacao = config ? config.calcularPontuacao(valoresEscalaClinica) : undefined;
      const classificacao = config && pontuacao !== undefined ? config.classificar(pontuacao) : undefined;
      await api.post(`/escalas-clinicas/${doenteId}`, {
        tipo: tipoEscalaClinica, valores: valoresEscalaClinica, pontuacao, classificacao,
      });
      toast.success('Guardado com sucesso');
      setModalEscalaClinica(false);
      setValoresEscalaClinica({});
      carregarEscalasClinicas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoEscalaClinica(false); }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Escalas Clínicas</span>
          {escalasClinicas.length > 0 && (
            <span className="text-xs font-medium text-violet-600 bg-violet-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
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
                    <span className={`text-xs font-bold badge-pad py-1 rounded-lg bg-${cor}-100 text-${cor}-700`}>{e.tipo}</span>
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

      {/* Modal Escala Clínica */}
      {modalEscalaClinica && (() => {
        const modalSubRole = (utilizador as any)?.subRole ?? '';
        const modalEscalasDisponiveis = (() => {
          if (['enf_uci'].includes(modalSubRole)) return ['RASS', 'CPOT', 'SOFA'];
          if (['enf_obstetricia', 'ginecologista'].includes(modalSubRole)) return ['CTG', 'Apgar'];
          if (['enf_pediatria', 'pediatra'].includes(modalSubRole)) return ['Apgar', 'PEWS', 'FLACC'];
          if (['fisioterapeuta', 'reabilitacao_fisica', 'reabilitacao_fala'].includes(modalSubRole)) return ['Barthel', 'MRC', 'FOIS'];
          if (['nutricao_clinica'].includes(modalSubRole)) return ['NRS2002', 'Barthel'];
          if (['psicologia_clinica'].includes(modalSubRole)) return ['PHQ9', 'GAD7'];
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

              <div className="flex flex-wrap gap-2" style={{ marginBottom: '24px' }}>
                {modalEscalasDisponiveis.map(tipo => (
                  <button key={tipo} onClick={() => { setTipoEscalaClinica(tipo); setValoresEscalaClinica({}); }}
                    className={`text-sm font-bold filter-pad py-2 rounded-lg border transition-colors ${tipoEscalaClinica === tipo ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-300'}`}>
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
    </>
  );
}

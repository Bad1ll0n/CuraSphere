import { BadRequestException } from '@nestjs/common';

/**
 * PROD-08 — motor único de escalas clínicas, no SERVIDOR.
 *
 * Antes: a pontuação e a classificação de 13 das 14 escalas vinham do browser
 * (`pontuacao = dto.pontuacao`), os itens não eram validados (um item em falta contava 0) e a
 * Braden usava pontos de corte que não são os da DGS. Agora:
 *   - cada item é validado contra os valores admissíveis, e uma escala incompleta é recusada;
 *   - a pontuação e a classificação são calculadas aqui, a partir dos itens (o que o cliente
 *     envia como pontuação é ignorado);
 *   - os pontos de corte da Braden e da Morse são configuráveis por instituição e cada
 *     avaliação guarda a versão (escala + cortes) com que foi classificada.
 */
type Valor = number | string;
interface DefEscala {
  itens: Record<string, readonly Valor[]>;
  pontuar?: (v: Record<string, Valor>) => number;
  classificar: (p: number, v: Record<string, Valor>) => string;
  versao: string;
}

const intervalo = (a: number, b: number, passo = 1) => Array.from({ length: Math.floor((b - a) / passo) + 1 }, (_, i) => a + i * passo);
const somar = (v: Record<string, Valor>) => Object.values(v).reduce<number>((s, x) => s + Number(x), 0);
const freq = intervalo(0, 3);

const FIM_ITENS = ['alimentacao', 'higiene', 'banho', 'vestirSuperior', 'vestirInferior', 'toalete', 'bexiga', 'intestino',
  'transfCama', 'transfSanita', 'transfBanheira', 'marcha', 'escadas', 'compreensao', 'expressao', 'interacao', 'resolucao', 'memoria'];

export const ESCALAS: Record<string, DefEscala> = {
  RASS: {
    itens: { nivel: intervalo(-5, 4) },
    pontuar: (v) => Number(v['nivel']),
    classificar: (p) => (p >= 1 ? 'Agitação' : p === 0 ? 'Alerta e calmo' : p >= -2 ? 'Sedação leve' : p >= -4 ? 'Sedação profunda' : 'Não despertável'),
    versao: 'rass-1',
  },
  CPOT: {
    itens: { expressao: [0, 1, 2], movimento: [0, 1, 2], ventilacao: [0, 1, 2], tensao: [0, 1, 2] },
    // > 2 indica dor (Gélinas 2006).
    classificar: (p) => (p === 0 ? 'Sem dor' : p <= 2 ? 'Dor improvável' : p <= 4 ? 'Dor moderada' : 'Dor intensa'),
    versao: 'cpot-1',
  },
  SOFA: {
    itens: { respiratorio: intervalo(0, 4), coagulacao: intervalo(0, 4), hepatico: intervalo(0, 4), cardiovascular: intervalo(0, 4), neurologico: intervalo(0, 4), renal: intervalo(0, 4) },
    classificar: (p) => (p <= 6 ? 'Baixo risco' : p <= 9 ? 'Risco moderado' : p <= 12 ? 'Risco alto' : 'Risco muito alto'),
    versao: 'sofa-1',
  },
  Apgar: {
    itens: { cor: [0, 1, 2], frequencia: [0, 1, 2], reflexo: [0, 1, 2], tono: [0, 1, 2], respiracao: [0, 1, 2] },
    classificar: (p) => (p >= 7 ? 'Normal' : p >= 4 ? 'Depressão moderada' : 'Depressão grave'),
    versao: 'apgar-1',
  },
  PEWS: {
    itens: { comportamento: freq, cardiovascular: freq, respiratorio: freq },
    classificar: (p) => (p <= 2 ? 'Baixo risco' : p <= 4 ? 'Médio risco' : 'Alto risco — avisar médico'),
    versao: 'pews-brighton-1',
  },
  FLACC: {
    itens: { face: [0, 1, 2], pernas: [0, 1, 2], atividade: [0, 1, 2], choro: [0, 1, 2], consolabilidade: [0, 1, 2] },
    classificar: (p) => (p === 0 ? 'Sem dor' : p <= 3 ? 'Dor leve' : p <= 6 ? 'Dor moderada' : 'Dor intensa'),
    versao: 'flacc-1',
  },
  // CTG — classificação FIGO 2015 (simplificada aos campos do formulário). 0 normal, 1 suspeito, 2 patológico.
  CTG: {
    itens: {
      linha_base: ['normal', 'taquicardia', 'bradicardia'],
      variabilidade: ['normal', 'reduzida', 'saltatorio'],
      aceleracoes: ['presentes', 'ausentes'],
      desaceleracoes: ['ausentes', 'precoces', 'tardias', 'variaveis'],
    },
    pontuar: (v) => {
      if (v['linha_base'] === 'bradicardia' || v['variabilidade'] !== 'normal' || v['desaceleracoes'] === 'tardias') return 2;
      if (v['linha_base'] === 'taquicardia' || v['desaceleracoes'] === 'variaveis') return 1;
      return 0;
    },
    classificar: (p) => (p === 2 ? 'Patológico (FIGO)' : p === 1 ? 'Suspeito (FIGO)' : 'Normal (FIGO)'),
    versao: 'ctg-figo-2015',
  },
  Barthel: {
    itens: {
      alimentacao: [0, 5, 10], banho: [0, 5], toalete: [0, 5], vestir: [0, 5, 10], intestino: [0, 5, 10],
      bexiga: [0, 5, 10], wc: [0, 5, 10], transferencia: [0, 5, 10, 15], mobilidade: [0, 5, 10, 15], escadas: [0, 5, 10],
    },
    classificar: (p) => (p <= 20 ? 'Dependência total' : p <= 35 ? 'Dependência grave' : p <= 55 ? 'Dependência moderada' : p <= 90 ? 'Dependência leve' : 'Independente'),
    versao: 'barthel-1',
  },
  // MRC Sum Score: 6 grupos musculares bilaterais (12 itens, 0–60). < 48 = fraqueza adquirida
  // na UCI; < 36 = fraqueza grave. O formulário antigo tinha só 6 itens (máx. 30) com uma
  // classificação pensada para 60 — "força normal" era impossível.
  MRC: {
    itens: Object.fromEntries(
      ['abd', 'flex', 'ext_punho', 'flex_anca', 'ext_joelho', 'dors'].flatMap((g) => [[`${g}_esq`, intervalo(0, 5)], [`${g}_dir`, intervalo(0, 5)]]),
    ),
    classificar: (p) => (p < 36 ? 'Fraqueza grave (< 36)' : p < 48 ? 'Fraqueza adquirida na UCI (< 48)' : p < 60 ? 'Força ligeiramente reduzida' : 'Força normal'),
    versao: 'mrc-ss-12',
  },
  NRS2002: {
    itens: { estado_nutricional: freq, gravidade: freq, idade: [0, 1] },
    classificar: (p) => (p < 3 ? 'Risco baixo — reavaliar semanalmente' : 'Em risco — iniciar plano nutricional'),
    versao: 'nrs2002-1',
  },
  PHQ9: {
    itens: Object.fromEntries(['anedonia', 'humor', 'sono', 'energia', 'apetite', 'autoestima', 'concentracao', 'psicomotor', 'suicidio'].map((k) => [k, freq])),
    classificar: (p, v) => {
      const base = p <= 4 ? 'Mínimo' : p <= 9 ? 'Leve' : p <= 14 ? 'Moderado' : p <= 19 ? 'Moderadamente grave' : 'Grave';
      // O item 9 positivo exige avaliação de risco de suicídio, qualquer que seja o total.
      return Number(v['suicidio']) > 0 ? `${base} — item 9 positivo: avaliar risco de suicídio` : base;
    },
    versao: 'phq9-1',
  },
  GAD7: {
    itens: Object.fromEntries(['nervoso', 'controlo', 'preocupacao', 'relaxar', 'inquieto', 'irritavel', 'medo'].map((k) => [k, freq])),
    classificar: (p) => (p <= 4 ? 'Mínimo' : p <= 9 ? 'Leve' : p <= 14 ? 'Moderado' : 'Grave'),
    versao: 'gad7-1',
  },
  FOIS: {
    itens: { nivel: intervalo(1, 7) },
    pontuar: (v) => Number(v['nivel']),
    classificar: (p) => (p <= 2 ? 'Sem/mínima ingestão oral' : p <= 4 ? 'Ingestão oral parcial' : p <= 6 ? 'Ingestão oral com restrições' : 'Ingestão oral normal'),
    versao: 'fois-1',
  },
  FIM: {
    itens: Object.fromEntries(FIM_ITENS.map((k) => [k, intervalo(1, 7)])),
    classificar: (p) => (p <= 36 ? 'Dependência completa' : p <= 72 ? 'Dependência modificada (moderada)' : p <= 108 ? 'Dependência modificada (ligeira)' : 'Independência'),
    versao: 'fim-18',
  },
  Glasgow: {
    itens: { ocular: intervalo(1, 4), verbal: intervalo(1, 5), motor: intervalo(1, 6) },
    classificar: (p) => (p <= 8 ? 'grave' : p <= 12 ? 'moderado' : 'ligeiro'),
    versao: 'gcs-1',
  },
};

/** Valida os itens (todos presentes, valores admissíveis, nenhum a mais) e calcula. */
export function avaliarEscala(tipo: string, valores: Record<string, unknown>): { pontuacao: number; classificacao: string; versao: string; valores: Record<string, Valor> } {
  const def = ESCALAS[tipo];
  if (!def) throw new BadRequestException(`Escala desconhecida: ${tipo}`);
  if (!valores || typeof valores !== 'object') throw new BadRequestException('Itens da escala em falta.');
  const limpos: Record<string, Valor> = {};
  const problemas: string[] = [];
  for (const [item, admissiveis] of Object.entries(def.itens)) {
    const bruto = (valores as Record<string, unknown>)[item];
    if (bruto === undefined || bruto === null || bruto === '') { problemas.push(`${item} em falta`); continue; }
    const valor = typeof admissiveis[0] === 'number' ? Number(bruto) : String(bruto);
    if (!admissiveis.includes(valor)) { problemas.push(`${item}=${String(bruto)} não é admissível (${admissiveis.join(', ')})`); continue; }
    limpos[item] = valor;
  }
  const extra = Object.keys(valores).filter((k) => !(k in def.itens));
  if (extra.length) problemas.push(`itens desconhecidos: ${extra.join(', ')}`);
  if (problemas.length) throw new BadRequestException(`${tipo} incompleta ou inválida: ${problemas.join('; ')}.`);
  const pontuacao = def.pontuar ? def.pontuar(limpos) : somar(limpos);
  return { pontuacao, classificacao: def.classificar(pontuacao, limpos), versao: def.versao, valores: limpos };
}

// ── Braden e Morse (avaliações de risco) ─────────────────────────────────────

const ITENS_BRADEN: Record<string, readonly number[]> = {
  percepcaoSensorial: [1, 2, 3, 4], humidade: [1, 2, 3, 4], atividade: [1, 2, 3, 4],
  mobilidade: [1, 2, 3, 4], nutricao: [1, 2, 3, 4], friccaoCisalhamento: [1, 2, 3],
};
const ITENS_MORSE: Record<string, readonly number[]> = {
  historiaQueda: [0, 25], diagnosticoSecundario: [0, 15], ajudaMarcha: [0, 15, 30],
  heparinaIV: [0, 20], marchaTransferencia: [0, 10, 20], estadoMental: [0, 15],
};

/**
 * Pontos de corte, por instituição (env). Predefinições:
 *   Braden — Orientação DGS 017/2011 (adulto): alto risco ≤ 16, baixo risco ≥ 17.
 *   Morse  — 0–24 baixo, 25–44 moderado, ≥ 45 alto (versão original; muitos hospitais
 *            portugueses usam cortes próprios: MORSE_CORTES="25,51", por exemplo).
 */
export function cortesRisco() {
  const bradenAlto = Number(process.env['BRADEN_CORTE_ALTO'] ?? 16);
  const [morseMod, morseAlto] = (process.env['MORSE_CORTES'] ?? '25,45').split(',').map(Number);
  return { bradenAlto, morseMod, morseAlto };
}

export function avaliarRisco(tipo: 'braden' | 'morse', itens: Record<string, unknown>): { pontuacao: number; risco: string; versao: string; itens: Record<string, number> } {
  const defs = tipo === 'braden' ? ITENS_BRADEN : ITENS_MORSE;
  const limpos: Record<string, number> = {};
  const problemas: string[] = [];
  for (const [item, adm] of Object.entries(defs)) {
    const v = Number((itens ?? {})[item]);
    if ((itens ?? {})[item] === undefined || !adm.includes(v)) problemas.push(`${item} ${itens?.[item] === undefined ? 'em falta' : `=${String(itens[item])} não admissível (${adm.join(', ')})`}`);
    else limpos[item] = v;
  }
  if (problemas.length) throw new BadRequestException(`${tipo === 'braden' ? 'Braden' : 'Morse'} incompleta ou inválida: ${problemas.join('; ')}.`);
  const pontuacao = Object.values(limpos).reduce((s, x) => s + x, 0);
  const c = cortesRisco();
  if (tipo === 'braden') {
    return { pontuacao, risco: pontuacao <= c.bradenAlto ? 'alto' : 'baixo', versao: `braden-dgs-017-2011/alto<=${c.bradenAlto}`, itens: limpos };
  }
  const risco = pontuacao >= c.morseAlto ? 'alto' : pontuacao >= c.morseMod ? 'moderado' : 'baixo';
  return { pontuacao, risco, versao: `morse/moderado>=${c.morseMod},alto>=${c.morseAlto}`, itens: limpos };
}

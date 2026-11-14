import { readFileSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import interacoesInternas from './interacoes.json';
import { CLASSES_FARMACOLOGICAS, normalizarTermo } from './alergias.helper';
import { expandirMarcas } from './marcas-dci';

/**
 * PROD-05 — interacções medicamentosas DETERMINÍSTICAS, com fonte e versão.
 *
 * A base interna (51 pares) é um ponto de partida; uma instituição liga a sua base validada e
 * licenciada com INTERACOES_FICHEIRO=/caminho/base.json no formato
 *   { "fonte": "...", "versao": "...", "data": "AAAA-MM-DD", "interacoes": [{ med1, med2, severidade, descricao }] }
 * Um LLM nunca decide se há interacção: no máximo explica um alerta que esta tabela deu.
 */
export interface Interacao { med1: string; med2: string; severidade: string; descricao: string }
export interface FonteInteracoes { fonte: string; versao: string; data: string | null; pares: number }

const log = new Logger('Interacoes');

function carregar(): { fonte: FonteInteracoes; interacoes: Interacao[] } {
  const ficheiro = process.env['INTERACOES_FICHEIRO'];
  if (ficheiro) {
    try {
      const j = JSON.parse(readFileSync(ficheiro, 'utf8'));
      if (!Array.isArray(j.interacoes) || !j.fonte || !j.versao) throw new Error('faltam "fonte", "versao" ou "interacoes"');
      return { fonte: { fonte: j.fonte, versao: j.versao, data: j.data ?? null, pares: j.interacoes.length }, interacoes: j.interacoes };
    } catch (e) {
      log.error(`INTERACOES_FICHEIRO inválido (${(e as Error).message}) — a usar a base interna.`);
    }
  }
  const lista = interacoesInternas as Interacao[];
  return { fonte: { fonte: 'Base interna CuraSphere (a substituir por base licenciada)', versao: '2026.11', data: null, pares: lista.length }, interacoes: lista };
}

let base: ReturnType<typeof carregar> | null = null;
function obter() { return (base ??= carregar()); }
export function fonteInteracoes(): FonteInteracoes { return obter().fonte; }
/** Para testes: volta a ler INTERACOES_FICHEIRO. */
export function recarregarInteracoes() { base = null; }

/** Termos da tabela que são classes ou têm sinónimos → substâncias (DCI) que os representam. */
const membrosDaClasse = (id: string) => CLASSES_FARMACOLOGICAS.find((c) => c.id === id)?.membros ?? [];
const TERMOS: Record<string, string[]> = {
  aspirina: ['acetilsalicilico', 'aspirina'],
  warfarina: ['varfarina', 'warfarina'],
  varfarina: ['varfarina', 'warfarina'],
  fentanil: ['fentanil', 'fentanilo'],
  benzodiazepinas: ['diazepam', 'lorazepam', 'midazolam', 'alprazolam', 'clonazepam', 'oxazepam', 'bromazepam', 'lormetazepam'],
  opioide: membrosDaClasse('opioides'),
  aminoglicosido: membrosDaClasse('aminoglicosideos'),
  corticosteroides: ['prednisolona', 'metilprednisolona', 'hidrocortisona', 'dexametasona', 'prednisona', 'deflazacort', 'betametasona'],
  nitratos: ['nitroglicerina', 'isossorbida'],
  'contraceptivo oral': ['etinilestradiol', 'levonorgestrel', 'desogestrel', 'drospirenona', 'gestodeno'],
  contraceptivo: ['etinilestradiol', 'levonorgestrel', 'desogestrel', 'drospirenona', 'gestodeno'],
  antibiotico: [
    ...['penicilinas', 'cefalosporinas', 'carbapenemos', 'macrolidos', 'quinolonas', 'aminoglicosideos'].flatMap(membrosDaClasse),
    'vancomicina', 'metronidazol', 'linezolida', 'clindamicina', 'doxiciclina',
  ],
};

/** O medicamento (nome prescrito, com marcas expandidas para a DCI) contém o termo da tabela? */
export function contemTermo(nomeMedicamento: string, termo: string): boolean {
  const texto = ` ${normalizarTermo(expandirMarcas(nomeMedicamento))}`;
  const membros = TERMOS[normalizarTermo(termo)] ?? [termo];
  // Início de palavra: "fentanil" apanha "fentanilo"; "insulina" apanha "insulina glargina".
  return membros.some((m) => m && texto.includes(` ${normalizarTermo(m)}`));
}

export function verificarInteracao(nomeMed: string, medicacoesAtivas: string[]): Interacao[] {
  const encontradas: Interacao[] = [];
  for (const ativa of medicacoesAtivas) {
    for (const i of obter().interacoes) {
      const par = (contemTermo(nomeMed, i.med1) && contemTermo(ativa, i.med2)) || (contemTermo(nomeMed, i.med2) && contemTermo(ativa, i.med1));
      if (par && !encontradas.includes(i)) encontradas.push(i);
    }
  }
  return encontradas;
}

/** Severidades que exigem justificação para prescrever. */
export const SEVERIDADES_BLOQUEANTES = ['contraindicada', 'grave'];

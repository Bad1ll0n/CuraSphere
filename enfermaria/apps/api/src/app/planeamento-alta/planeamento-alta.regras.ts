/**
 * PROD-13 — regras do planeamento de alta e da continuidade de cuidados (puras, testáveis).
 */

/** Para onde se referencia. A RNCCI tem tipologias próprias; os CSP e o apoio social também contam. */
export const DESTINOS = {
  rncci_convalescenca: 'RNCCI — Unidade de Convalescença',
  rncci_media_duracao: 'RNCCI — Unidade de Média Duração e Reabilitação',
  rncci_longa_duracao: 'RNCCI — Unidade de Longa Duração e Manutenção',
  rncci_paliativos: 'RNCCI — Unidade de Cuidados Paliativos',
  rncci_ecci: 'RNCCI — Equipa de Cuidados Continuados Integrados (domicílio)',
  csp_usf: 'Cuidados de Saúde Primários — USF/UCSP (enfermeiro de família)',
  csp_ucc: 'Cuidados de Saúde Primários — UCC (visitação domiciliária)',
  apoio_social: 'Serviço Social / resposta social (ERPI, apoio domiciliário)',
  outro: 'Outro',
} as const;
export type Destino = keyof typeof DESTINOS;

export const ESTADOS_REFERENCIACAO = ['proposta', 'enviada', 'aceite', 'vaga_atribuida', 'recusada', 'cancelada'] as const;
export type EstadoReferenciacao = (typeof ESTADOS_REFERENCIACAO)[number];

/** Transições permitidas. Recusada e cancelada fecham; vaga atribuída é o fim feliz. */
const TRANSICOES: Record<EstadoReferenciacao, EstadoReferenciacao[]> = {
  proposta: ['enviada', 'cancelada'],
  enviada: ['aceite', 'recusada', 'cancelada'],
  aceite: ['vaga_atribuida', 'cancelada'],
  vaga_atribuida: ['cancelada'],
  recusada: [],
  cancelada: [],
};

export function transicaoValida(de: EstadoReferenciacao, para: EstadoReferenciacao): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

/** Ainda à espera de resposta ou de vaga — é o que prende o doente depois da alta clínica. */
export const estaPendente = (estado: string) => ['proposta', 'enviada', 'aceite'].includes(estado);

/** Conteúdos-tipo dos ensinos (o enfermeiro adapta; o registo guarda o que foi feito e se foi compreendido). */
export const TEMAS_ENSINO: Record<string, { titulo: string; pontos: string[] }> = {
  medicacao: { titulo: 'Gestão da medicação em casa', pontos: ['Para que serve cada medicamento', 'Horários e o que fazer se esquecer uma toma', 'Efeitos adversos a vigiar'] },
  insulina: { titulo: 'Administração de insulina e vigilância da glicemia', pontos: ['Técnica e locais de administração', 'Pesquisa de glicemia capilar', 'Sinais de hipoglicemia e o que fazer'] },
  sinais_alarme: { titulo: 'Sinais de alarme e quando procurar ajuda', pontos: ['Febre, dor que agrava, falta de ar', 'Quando ligar SNS 24 / ir à urgência'] },
  quedas: { titulo: 'Prevenção de quedas', pontos: ['Calçado e iluminação', 'Levante em três tempos', 'Retirar tapetes e obstáculos'] },
  transferencias: { titulo: 'Posicionamentos e transferências (cuidador)', pontos: ['Posicionar de 2/2 a 3/3 h', 'Transferência cama–cadeira em segurança', 'Proteger a coluna do cuidador'] },
  pele: { titulo: 'Prevenção de úlceras por pressão', pontos: ['Vigiar proeminências ósseas', 'Hidratação da pele', 'Alívio de pressão'] },
  ferida: { titulo: 'Cuidados à ferida / penso', pontos: ['Quando e como mudar o penso', 'Sinais de infeção'] },
  alimentacao: { titulo: 'Alimentação, deglutição e hidratação', pontos: ['Consistência adaptada', 'Posição para comer', 'Hidratação diária'] },
  sng: { titulo: 'Alimentação por sonda nasogástrica', pontos: ['Verificar a posição da sonda', 'Administração e lavagem', 'O que fazer se sair'] },
  algalia: { titulo: 'Cuidados à algália', pontos: ['Higiene', 'Saco abaixo da bexiga', 'Sinais de infeção urinária'] },
  estoma: { titulo: 'Cuidados ao estoma', pontos: ['Higiene e troca do dispositivo', 'Proteção da pele periestomal'] },
  inaloterapia: { titulo: 'Inaloterapia', pontos: ['Técnica do inalador / câmara expansora', 'Lavar a boca após corticoide inalado'] },
  oxigenio: { titulo: 'Oxigenoterapia no domicílio', pontos: ['Débito prescrito', 'Segurança (fumo, chamas)', 'Higiene do material'] },
};

export const DESTINATARIOS = ['doente', 'cuidador', 'ambos'] as const;
export const COMPREENSAO = ['compreendeu', 'parcial', 'nao_compreendeu'] as const;

/** Barthel ≤ 60: dependência grave/total ou moderada-grave (Mahoney & Barthel; versão portuguesa DGS). */
export const BARTHEL_LIMIAR_DEPENDENCIA = 60;

export interface Sinalizacao { motivo: 'dependencia' | 'sem_cuidador' | 'ensino_nao_compreendido' | 'sem_avaliacao_inicial'; detalhe: string }

/**
 * Sinalização precoce (dia 1): quem vai precisar de continuidade de cuidados ou de capacitar o
 * cuidador. Não decide nada — mostra à equipa, cedo, o que costuma atrasar a alta.
 */
export function sinalizar(entrada: {
  barthel?: number | null;
  avaliacaoInicial?: { dados: Record<string, unknown> } | null;
  ensinos?: { titulo: string; compreensao: string }[];
}): Sinalizacao[] {
  const s: Sinalizacao[] = [];
  if (entrada.barthel != null && entrada.barthel <= BARTHEL_LIMIAR_DEPENDENCIA) {
    s.push({ motivo: 'dependencia', detalhe: `Barthel ${entrada.barthel}/100 — avaliar necessidade de RNCCI ou apoio no domicílio` });
  }
  if (!entrada.avaliacaoInicial) {
    s.push({ motivo: 'sem_avaliacao_inicial', detalhe: 'Sem avaliação inicial de enfermagem — rede de apoio desconhecida' });
  } else {
    const d = entrada.avaliacaoInicial.dados ?? {};
    const temCuidador = typeof d['cuidadorNome'] === 'string' && (d['cuidadorNome'] as string).trim().length > 0;
    if (!temCuidador) s.push({ motivo: 'sem_cuidador', detalhe: 'Cuidador principal não identificado na avaliação inicial' });
  }
  // Para cada tema, conta o último ensino: um "não compreendeu" já repetido com sucesso não sinaliza.
  const ultimoPorTema = new Map<string, string>();
  for (const e of entrada.ensinos ?? []) if (!ultimoPorTema.has(e.titulo)) ultimoPorTema.set(e.titulo, e.compreensao);
  const porRever = [...ultimoPorTema].filter(([, c]) => c !== 'compreendeu').map(([t]) => t);
  if (porRever.length) s.push({ motivo: 'ensino_nao_compreendido', detalhe: `Ensino a repetir: ${porRever.join(', ')}` });
  return s;
}

/** Dias inteiros desde a alta clínica (0 no próprio dia). null se ainda não houve alta clínica. */
export function diasAposAltaClinica(altaClinicaEm: Date | null | undefined, ate: Date = new Date()): number | null {
  if (!altaClinicaEm) return null;
  return Math.max(0, Math.floor((ate.getTime() - altaClinicaEm.getTime()) / 86_400_000));
}

// Correspondência entre um fármaco prescrito e as alergias documentadas do doente.
//
// O algoritmo anterior era `palavras com mais de 3 caracteres` + `includes()` em ambos os
// sentidos. Consequências reais:
//   · "AAS" (3 caracteres) e "ovo" (3) eram descartados — nunca bloqueavam nada;
//   · "penicilina" e "amoxicilina" não se cruzavam (não são substring uma da outra), pelo que
//     um doente alérgico a penicilinas recebia amoxicilina sem qualquer aviso;
//   · "acido" em "ácido acetilsalicílico" cruzava com "ácido fólico" — falso positivo.
//
// Passa a haver três níveis: correspondência directa da substância, pertença à mesma classe
// farmacológica, e reactividade cruzada documentada entre classes.

/** Palavras que aparecem em nomes de fármacos mas não os identificam. */
const STOPWORDS = new Set([
  'acido', 'sal', 'sais', 'sodio', 'sodica', 'sodico', 'potassio', 'calcio', 'magnesio',
  'cloridrato', 'sulfato', 'fosfato', 'nitrato', 'acetato', 'maleato', 'tartarato',
  'succinato', 'besilato', 'mesilato', 'citrato', 'gluconato', 'carbonato', 'bromidrato',
  'comprimido', 'comprimidos', 'capsula', 'capsulas', 'solucao', 'suspensao', 'xarope',
  'injetavel', 'injectavel', 'ampola', 'ampolas', 'saqueta', 'pomada', 'creme', 'gel',
  'oral', 'iv', 'im', 'sc', 'ev', 'topico', 'inalatorio', 'retal', 'rectal',
  'liberacao', 'libertacao', 'prolongada', 'rapida', 'lenta', 'forte', 'plus', 'retard',
  'de', 'da', 'do', 'e', 'em', 'com', 'sem', 'para',
]);

const UNIDADES = /^(mg|g|mcg|ug|ml|l|ui|iu|meq|mmol|%|x)$/;

/** Minúsculas, sem acentos, sem pontuação. */
export function normalizarTermo(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

/** Tokens úteis de um nome de fármaco/alergénio: sem doses, unidades nem palavras vazias. */
export function tokenizar(texto: string): string[] {
  return normalizarTermo(texto)
    .split(/[\s+]+/)
    .filter((t) => t.length >= 3)
    .filter((t) => !/^\d/.test(t))
    .filter((t) => !UNIDADES.test(t))
    .filter((t) => !STOPWORDS.has(t));
}

export interface ClasseFarmacologica {
  /** Chave interna da classe. */
  id: string;
  /** Nome legível, para as mensagens. */
  nome: string;
  /** Substâncias e marcas que pertencem à classe. */
  membros: string[];
  /** Termos que, escritos como alergénio, designam a classe inteira. */
  designacoes: string[];
  /** Classes com reactividade cruzada documentada. */
  cruzadas?: string[];
}

/**
 * Tabela de classes. Deliberadamente curta e centrada no que se prescreve em enfermaria —
 * é uma rede de segurança, não um substituto de um dicionário de medicamentos (ver relatório).
 */
export const CLASSES_FARMACOLOGICAS: ClasseFarmacologica[] = [
  {
    id: 'penicilinas',
    nome: 'Penicilinas',
    membros: [
      'penicilina', 'benzilpenicilina', 'fenoximetilpenicilina', 'amoxicilina', 'ampicilina',
      'flucloxacilina', 'cloxacilina', 'piperacilina', 'ticarcilina', 'clavulanico',
      'clavulanato', 'augmentin', 'tazobactam',
    ],
    designacoes: ['penicilina', 'penicilinas', 'betalactamicos', 'beta lactamicos', 'betalactamico'],
    cruzadas: ['cefalosporinas', 'carbapenemos'],
  },
  {
    id: 'cefalosporinas',
    nome: 'Cefalosporinas',
    membros: [
      'cefalexina', 'cefazolina', 'cefuroxima', 'cefotaxima', 'ceftriaxona', 'ceftazidima',
      'cefepima', 'cefixima', 'cefadroxil', 'ceftarolina',
    ],
    designacoes: ['cefalosporina', 'cefalosporinas', 'betalactamicos', 'betalactamico'],
    cruzadas: ['penicilinas', 'carbapenemos'],
  },
  {
    id: 'carbapenemos',
    nome: 'Carbapenemos',
    membros: ['meropenem', 'imipenem', 'ertapenem', 'doripenem'],
    designacoes: ['carbapenemo', 'carbapenemos', 'carbapenemicos'],
    cruzadas: ['penicilinas', 'cefalosporinas'],
  },
  {
    id: 'sulfonamidas',
    nome: 'Sulfonamidas',
    membros: ['sulfametoxazol', 'cotrimoxazol', 'trimetoprim', 'sulfadiazina', 'sulfassalazina'],
    designacoes: ['sulfa', 'sulfas', 'sulfonamida', 'sulfonamidas', 'sulfamidas'],
  },
  {
    id: 'macrolidos',
    nome: 'Macrólidos',
    membros: ['azitromicina', 'claritromicina', 'eritromicina', 'espiramicina'],
    designacoes: ['macrolido', 'macrolidos'],
  },
  {
    id: 'quinolonas',
    nome: 'Quinolonas',
    membros: ['ciprofloxacina', 'levofloxacina', 'moxifloxacina', 'norfloxacina', 'ofloxacina'],
    designacoes: ['quinolona', 'quinolonas', 'fluoroquinolonas', 'fluoroquinolona'],
  },
  {
    id: 'aminoglicosideos',
    nome: 'Aminoglicosídeos',
    membros: ['gentamicina', 'amicacina', 'tobramicina', 'estreptomicina', 'neomicina'],
    designacoes: ['aminoglicosideo', 'aminoglicosideos'],
  },
  {
    id: 'aines',
    nome: 'AINEs / salicilatos',
    membros: [
      'aas', 'aspirina', 'acetilsalicilico', 'salicilato', 'ibuprofeno', 'diclofenac',
      'naproxeno', 'cetoprofeno', 'cetorolaco', 'nimesulida', 'indometacina', 'piroxicam',
      'etoricoxib', 'celecoxib', 'metamizol',
    ],
    designacoes: ['aine', 'aines', 'anti inflamatorios', 'antiinflamatorios', 'salicilatos', 'aas'],
  },
  {
    id: 'opioides',
    nome: 'Opióides',
    membros: [
      'morfina', 'tramadol', 'codeina', 'fentanilo', 'fentanil', 'petidina', 'oxicodona',
      'hidromorfona', 'buprenorfina', 'metadona', 'tapentadol',
    ],
    designacoes: ['opioide', 'opioides', 'opiaceo', 'opiaceos'],
  },
  {
    id: 'heparinas',
    nome: 'Heparinas',
    membros: ['heparina', 'enoxaparina', 'dalteparina', 'tinzaparina', 'nadroparina', 'fondaparinux'],
    designacoes: ['heparina', 'heparinas', 'hbpm'],
  },
  {
    id: 'iecas',
    nome: 'IECAs',
    membros: ['captopril', 'enalapril', 'lisinopril', 'ramipril', 'perindopril', 'trandolapril'],
    designacoes: ['ieca', 'iecas', 'inibidores da eca'],
  },
  {
    id: 'estatinas',
    nome: 'Estatinas',
    membros: ['sinvastatina', 'atorvastatina', 'rosuvastatina', 'pravastatina', 'fluvastatina'],
    designacoes: ['estatina', 'estatinas'],
  },
  {
    id: 'anestesicos_locais',
    nome: 'Anestésicos locais (amidas)',
    membros: ['lidocaina', 'bupivacaina', 'ropivacaina', 'mepivacaina', 'prilocaina', 'articaina'],
    designacoes: ['anestesico local', 'anestesicos locais', 'lidocaina'],
  },
  {
    id: 'contraste_iodado',
    nome: 'Contraste iodado',
    membros: ['iohexol', 'iopamidol', 'iodixanol', 'ioversol', 'iopromida', 'contraste'],
    designacoes: ['iodo', 'contraste', 'contraste iodado', 'iodado'],
  },
  {
    id: 'ovo',
    nome: 'Ovo (excipiente)',
    // Propofol é emulsão com lecitina de ovo; várias vacinas são cultivadas em ovo.
    membros: ['propofol'],
    designacoes: ['ovo', 'ovos', 'clara de ovo', 'lecitina'],
  },
  {
    id: 'soja',
    nome: 'Soja (excipiente)',
    membros: ['propofol'],
    designacoes: ['soja', 'oleo de soja'],
  },
];

export type TipoCorrespondencia = 'substancia' | 'classe' | 'cruzada';

export interface CorrespondenciaAlergia {
  tipo: TipoCorrespondencia;
  /** Descrição legível do porquê, para a mensagem de erro e para o registo do override. */
  motivo: string;
  classe?: string;
}

/**
 * Classes a que o termo pertence (como membro). O prefixo só conta a partir de 5 letras —
 * com tokens curtos ("aas", "ovo") exige-se igualdade, senão sobra-se em falsos positivos.
 */
function classesDoTermo(tokens: string[]): ClasseFarmacologica[] {
  return CLASSES_FARMACOLOGICAS.filter((c) =>
    c.membros.some((m) =>
      tokens.some(
        (t) => t === m || (t.length >= 5 && m.length >= 5 && (t.startsWith(m) || m.startsWith(t))),
      ),
    ),
  );
}

/** Classes que o termo designa por nome (ex.: alergénio "penicilinas"). */
function classesDesignadas(texto: string, tokens: string[]): ClasseFarmacologica[] {
  const normal = normalizarTermo(texto);
  return CLASSES_FARMACOLOGICAS.filter(
    (c) =>
      c.designacoes.some((d) => normal === d || normal.includes(d)) ||
      c.designacoes.some((d) => tokens.includes(d)),
  );
}

/** Correspondência directa de substância: token igual, ou um é prefixo do outro (≥5 letras). */
function mesmaSubstancia(tokensMed: string[], tokensAlg: string[]): string | null {
  for (const a of tokensAlg) {
    for (const m of tokensMed) {
      if (a === m) return a;
      if (a.length >= 5 && m.length >= 5 && (a.startsWith(m) || m.startsWith(a))) return a;
    }
  }
  return null;
}

/**
 * Confronta o nome de um medicamento com um alergénio documentado.
 * Devolve `null` quando não há relação conhecida.
 */
export function compararComAlergenio(
  nomeMedicamento: string,
  alergenio: string,
): CorrespondenciaAlergia | null {
  const tokensMed = tokenizar(nomeMedicamento);
  const tokensAlg = tokenizar(alergenio);
  if (tokensMed.length === 0 || tokensAlg.length === 0) return null;

  const direta = mesmaSubstancia(tokensMed, tokensAlg);
  if (direta) {
    return { tipo: 'substancia', motivo: `substância documentada como alergénio ("${alergenio}")` };
  }

  const classesMed = classesDoTermo(tokensMed);
  const classesAlg = [...classesDoTermo(tokensAlg), ...classesDesignadas(alergenio, tokensAlg)];
  if (classesMed.length === 0 || classesAlg.length === 0) return null;

  const idsAlg = new Set(classesAlg.map((c) => c.id));

  // Mesma classe farmacológica (ex.: alergia a "penicilina", prescrição de amoxicilina).
  const mesma = classesMed.find((c) => idsAlg.has(c.id));
  if (mesma) {
    return {
      tipo: 'classe',
      classe: mesma.id,
      motivo: `mesma classe farmacológica do alergénio "${alergenio}" (${mesma.nome})`,
    };
  }

  // Reactividade cruzada documentada entre classes (ex.: penicilinas ↔ cefalosporinas).
  for (const c of classesMed) {
    const cruzada = (c.cruzadas ?? []).find((id) => idsAlg.has(id));
    if (cruzada) {
      const nomeCruzada = CLASSES_FARMACOLOGICAS.find((x) => x.id === cruzada)?.nome ?? cruzada;
      return {
        tipo: 'cruzada',
        classe: c.id,
        motivo: `reactividade cruzada documentada entre ${c.nome} e ${nomeCruzada} (alergénio "${alergenio}")`,
      };
    }
  }

  return null;
}

export interface AlergiaDocumentada {
  id?: string;
  alergenio: string;
  severidade?: string | null;
}

export interface ConflitoAlergia<T extends AlergiaDocumentada = AlergiaDocumentada> {
  alergia: T;
  correspondencia: CorrespondenciaAlergia;
}

/**
 * Primeiro conflito entre um medicamento e as alergias do doente, dando prioridade à
 * correspondência mais forte (substância > classe > cruzada).
 */
export function detetarConflitoAlergia<T extends AlergiaDocumentada>(
  nomeMedicamento: string,
  alergias: T[],
): ConflitoAlergia<T> | null {
  const encontrados: ConflitoAlergia<T>[] = [];
  for (const alergia of alergias) {
    const correspondencia = compararComAlergenio(nomeMedicamento, alergia.alergenio);
    if (correspondencia) encontrados.push({ alergia, correspondencia });
  }
  if (encontrados.length === 0) return null;

  const ordem: Record<TipoCorrespondencia, number> = { substancia: 0, classe: 1, cruzada: 2 };
  encontrados.sort((a, b) => ordem[a.correspondencia.tipo] - ordem[b.correspondencia.tipo]);
  return encontrados[0];
}

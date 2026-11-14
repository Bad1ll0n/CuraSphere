import { normalizarTermo, tokenizar } from '../medicacao/alergias.helper';
import { expandirMarcas } from '../medicacao/marcas-dci';

/**
 * PROD-05 — catálogo nacional de medicamentos (INFARMED / CHNM).
 *
 * O INFARMED disponibiliza a lista de medicamentos (Infomed) e o Código Hospitalar Nacional do
 * Medicamento como ficheiros tabulares. Os nomes das colunas variam entre extracções, por isso
 * a leitura aceita sinónimos e o separador é detectado (`;`, `,` ou tabulação).
 */
export interface ItemCatalogo {
  dci: string;
  nomeMarca?: string | null;
  formaFarmaceutica: string;
  concentracao?: string | null;
  via?: string | null;
  codigoATC?: string | null;
  codigoCHNM?: string | null;
  embalagem?: string | null;
  classeTerap: string;
  unidade: string;
}

const COLUNAS: Record<keyof Omit<ItemCatalogo, 'classeTerap' | 'unidade'>, string[]> = {
  dci: ['dci', 'substancia ativa dci', 'substancia ativa', 'substancia activa', 'substancias ativas', 'denominacao comum internacional', 'dci nome generico', 'principio ativo'],
  nomeMarca: ['nome do medicamento', 'nome comercial', 'medicamento', 'nome'],
  formaFarmaceutica: ['forma farmaceutica', 'forma'],
  concentracao: ['dosagem', 'concentracao', 'dose'],
  via: ['via de administracao', 'via'],
  codigoATC: ['codigo atc', 'atc'],
  codigoCHNM: ['chnm', 'codigo chnm', 'codigo hospitalar nacional do medicamento', 'codigo hospitalar'],
  embalagem: ['embalagem', 'apresentacao', 'dimensao da embalagem'],
};

/** Grupos anatómicos da classificação ATC (OMS) — classe quando o ficheiro não a traz. */
const GRUPOS_ATC: Record<string, string> = {
  A: 'Aparelho digestivo e metabolismo', B: 'Sangue e órgãos hematopoiéticos', C: 'Aparelho cardiovascular',
  D: 'Dermatológicos', G: 'Aparelho geniturinário e hormonas sexuais', H: 'Preparações hormonais sistémicas',
  J: 'Anti-infecciosos de uso sistémico', L: 'Antineoplásicos e imunomoduladores', M: 'Sistema músculo-esquelético',
  N: 'Sistema nervoso', P: 'Antiparasitários', R: 'Aparelho respiratório', S: 'Órgãos dos sentidos', V: 'Vários',
};

export function classeDeATC(atc?: string | null): string {
  return (atc && GRUPOS_ATC[atc.trim().charAt(0).toUpperCase()]) || 'Não classificado';
}

/** Unidade de dispensa a partir da forma farmacêutica. */
export function unidadeDaForma(forma: string): string {
  const f = normalizarTermo(forma);
  if (/comprimido/.test(f)) return 'comprimido';
  if (/capsula/.test(f)) return 'cápsula';
  if (/seringa/.test(f)) return 'seringa';
  if (/ampola|injetavel|injectavel/.test(f)) return 'ampola';
  if (/perfusao/.test(f)) return 'frasco';
  if (/xarope|solucao oral|suspensao oral/.test(f)) return 'frasco';
  if (/inalacao|inalador/.test(f)) return 'inalador';
  if (/supositorio/.test(f)) return 'supositório';
  if (/creme|pomada|gel/.test(f)) return 'bisnaga';
  return 'unidade';
}

/** Lê uma linha CSV respeitando aspas ("a;b" fica num só campo; "" é uma aspa). */
function dividirLinha(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { campos.push(atual); atual = ''; }
    else atual += c;
  }
  campos.push(atual);
  return campos.map((x) => x.trim());
}

export function lerCsvCatalogo(texto: string): { itens: ItemCatalogo[]; rejeitadas: { linha: number; motivo: string }[]; colunas: Record<string, string> } {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return { itens: [], rejeitadas: [], colunas: {} };
  const cab = linhas[0];
  const sep = [';', '\t', ','].sort((a, b) => cab.split(b).length - cab.split(a).length)[0];
  const cabecalhos = dividirLinha(cab, sep).map(normalizarTermo);
  const indice: Partial<Record<keyof typeof COLUNAS, number>> = {};
  const colunas: Record<string, string> = {};
  for (const [campo, sinonimos] of Object.entries(COLUNAS) as [keyof typeof COLUNAS, string[]][]) {
    const i = cabecalhos.findIndex((h) => sinonimos.includes(h));
    if (i >= 0) { indice[campo] = i; colunas[campo] = cabecalhos[i]; }
  }
  if (indice.dci === undefined || indice.formaFarmaceutica === undefined) {
    throw new Error(`O ficheiro não tem as colunas obrigatórias (DCI e forma farmacêutica). Cabeçalho lido: ${cabecalhos.join(' | ')}`);
  }
  const itens: ItemCatalogo[] = [];
  const rejeitadas: { linha: number; motivo: string }[] = [];
  linhas.slice(1).forEach((l, k) => {
    const v = dividirLinha(l, sep);
    const get = (c: keyof typeof COLUNAS) => (indice[c] !== undefined ? v[indice[c]!] || null : null);
    const dci = get('dci'), forma = get('formaFarmaceutica');
    if (!dci || !forma) { rejeitadas.push({ linha: k + 2, motivo: 'sem DCI ou forma farmacêutica' }); return; }
    const atc = get('codigoATC');
    itens.push({
      dci, formaFarmaceutica: forma, nomeMarca: get('nomeMarca'), concentracao: get('concentracao'), via: get('via'),
      codigoATC: atc, codigoCHNM: get('codigoCHNM'), embalagem: get('embalagem'),
      classeTerap: classeDeATC(atc), unidade: unidadeDaForma(forma),
    });
  });
  return { itens, rejeitadas, colunas };
}

export function normalizarDci(dci: string): string {
  return normalizarTermo(dci).replace(/\s*\+\s*/g, ' + ').replace(/\s+/g, ' ').trim();
}

/**
 * Encontra a substância (DCI) de um nome prescrito: marcas comerciais expandidas para a DCI
 * (`Ben-u-ron` → paracetamol) e combinações preferidas à substância isolada
 * ("amoxicilina + ácido clavulânico" antes de "amoxicilina"). Devolve a DCI do catálogo.
 */
/** Qualificadores de sal que a prescrição costuma omitir ("enoxaparina" = "enoxaparina sódica"). */
const SAIS = new Set(['sodica', 'sodico', 'potassico', 'potassica', 'magnesico', 'magnesica', 'calcico', 'calcica',
  'cloridrato', 'mesilato', 'sulfato', 'fosfato', 'acetato', 'maleato', 'besilato', 'succinato', 'tartarato']);

export function dciDoNome(nome: string, dcisCatalogo: string[]): string | null {
  const texto = ` ${normalizarTermo(expandirMarcas(nome))} `;
  const tokens = new Set(tokenizar(expandirMarcas(nome)));
  let melhor: { dci: string; peso: number } | null = null;
  for (const dci of dcisCatalogo) {
    const partes = normalizarDci(dci).split(' + ').map((p) => p.trim()).filter(Boolean);
    const todas = partes.every((p) => texto.includes(` ${p} `)
      || p.split(' ').every((w) => w.length < 3 || SAIS.has(w) || tokens.has(w)));
    if (!todas) continue;
    const peso = partes.length * 100 + normalizarDci(dci).length;
    if (!melhor || peso > melhor.peso) melhor = { dci, peso };
  }
  return melhor?.dci ?? null;
}

/** Gravação idempotente (usada pelo serviço, pelo script de importação e pelos seeds). */
export async function gravarItensCatalogo(prisma: any, itens: ItemCatalogo[], fonte: 'infarmed' | 'amostra' | 'local', versao: string) {
  let criados = 0, atualizados = 0;
  for (const it of itens) {
    const dados = {
      dci: it.dci.trim(), nomeMarca: it.nomeMarca ?? null, formaFarmaceutica: it.formaFarmaceutica,
      concentracao: it.concentracao ?? null, via: it.via ?? null, codigoATC: it.codigoATC ?? null,
      codigoCHNM: it.codigoCHNM ?? null, embalagem: it.embalagem ?? null, classeTerap: it.classeTerap, unidade: it.unidade,
      fonte, versaoFonte: versao, ativo: true,
    };
    const existente = it.codigoCHNM
      ? await prisma.catalogoMedicamento.findUnique({ where: { codigoCHNM: it.codigoCHNM } })
      : await prisma.catalogoMedicamento.findFirst({
        where: { dci: dados.dci, formaFarmaceutica: dados.formaFarmaceutica, concentracao: dados.concentracao, via: dados.via },
      });
    if (existente) {
      await prisma.catalogoMedicamento.update({ where: { id: existente.id }, data: dados });
      atualizados++;
    } else {
      await prisma.catalogoMedicamento.create({ data: dados });
      criados++;
    }
  }
  return { criados, atualizados, total: itens.length };
}

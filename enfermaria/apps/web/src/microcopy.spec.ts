/**
 * UX-25 — microcopy em PT-PT pós-Acordo Ortográfico (AO90) e com tratamento por "você".
 *
 * Havia 183 grafias pré-AO na interface ("Activo", "Acção", "Seleccione", "actualização") ao lado
 * de 348 formas AO90, e "Não tens doentes" ao lado de "Introduza as suas credenciais". Esta guarda
 * verifica as mensagens (pt.json) e o texto visível dos ecrãs (nós de texto JSX e frases entre
 * aspas). Só apanha formas portuguesas — "active"/"actual" em inglês não contam.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import pt from './messages/pt.json';

const L = 'A-Za-zÀ-ÿ';
const ANTES = `(?<![${L}])`;
const DEPOIS = `(?![${L}])`;
const PRE_AO = new RegExp(
  ANTES + '(' + [
    '[Ii]nactiv[oa]s?', '[Aa]ctiv(?:o|a|os|as|ar|ado|ada|ados|adas|ação|ações|idade|idades)',
    '[Ss]elecc(?:ione|ionar|ionado|ionada)', '[Ss]elecç(?:ão|ões)', '[Aa]ctualiz[a-zç]*',
    '[Aa]cç(?:ão|ões)', '[Ee]fectu[a-z]*', '[Dd]irecç(?:ão|ões)', '[Pp]rotecç(?:ão|ões)', '[Ii]nfecç(?:ão|ões)',
    '[Rr]ecepç(?:ão|ões)', '[Oo]bjectiv[oa]s?', '[Ee]xact(?:o|a|amente)', '[Dd]etect(?:ado|ada|ados|adas|ar)',
  ].join('|') + ')' + DEPOIS,
  'g',
);
const TU = new RegExp(ANTES + '(Não tens|não tens|os teus|Os teus|o teu|O teu|a tua|A tua|clica em|clica para)' + DEPOIS, 'g');

type Arvore = { [k: string]: string | Arvore };
const folhas = (o: Arvore): string[] => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : folhas(v)));

const RAIZ = __dirname;
function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : tsx(p);
    return e.name.endsWith('.tsx') && !/\.(spec|stories)\.tsx$/.test(e.name) ? [p] : [];
  });
}
const NAO_TEXTO = /[;=()]|&&|\|\||\?\s|\bconst\b|\breturn\b/;
function textoVisivel(fonte: string): string[] {
  const out: string[] = [];
  for (const m of fonte.matchAll(new RegExp(`(?<!=)>([^<>{}]*[${L}][^<>{}]*)<`, 'g'))) if (!NAO_TEXTO.test(m[1])) out.push(m[1]);
  for (const linha of fonte.split('\n')) {
    if (/^\s*(import |\/\/|\*)/.test(linha) || linha.includes('className')) continue;
    for (const m of linha.matchAll(/'([^'\n]* [^'\n]*)'|"([^"\n]* [^"\n]*)"/g)) out.push(m[1] ?? m[2]);
  }
  return out;
}

describe('microcopy (UX-25)', () => {
  it('pt.json: sem grafias pré-AO nem tratamento por "tu"', () => {
    const maus = folhas(pt as Arvore).flatMap((t) => [...t.matchAll(PRE_AO), ...t.matchAll(TU)].map((m) => `${m[0]} — "${t}"`));
    expect(maus).toEqual([]);
  });

  it('texto visível dos ecrãs: sem grafias pré-AO nem tratamento por "tu"', () => {
    const maus = tsx(RAIZ).flatMap((f) => textoVisivel(readFileSync(f, 'utf8'))
      .flatMap((t) => [...t.matchAll(PRE_AO), ...t.matchAll(TU)].map((m) => `${relative(RAIZ, f).replace(/\\/g, '/')}: ${m[0]}`)));
    expect(maus).toEqual([]);
  });
});

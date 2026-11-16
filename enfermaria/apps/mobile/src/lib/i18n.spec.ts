/**
 * UX-07 — a app móvel tem pt e en com as mesmas chaves (incluindo as formas de plural do
 * i18next: `_one` / `_other`), e cada `t('…')` usado nos ecrãs existe em português.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

type Arvore = { [k: string]: string | Arvore };
const ler = (l: string): Arvore => JSON.parse(readFileSync(join(__dirname, '..', 'locales', `${l}.json`), 'utf8'));
const folhas = (o: Arvore, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [p + k] : folhas(v, `${p}${k}.`)));
function ficheiros(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return ficheiros(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.spec.') ? [p] : [];
  });
}

describe('i18n móvel (UX-07)', () => {
  const pt = ler('pt');
  const en = ler('en');

  it('pt e en têm as mesmas chaves', () => {
    const p = new Set(folhas(pt));
    const e = new Set(folhas(en));
    expect([...p].filter((k) => !e.has(k))).toEqual([]);
    expect([...e].filter((k) => !p.has(k))).toEqual([]);
  });

  it("cada t('chave') usado existe (ou tem formas de plural)", () => {
    const chaves = new Set(folhas(pt));
    const prefixos = new Set(folhas(pt).flatMap((k) => k.split('.').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('.'))));
    const emFalta: string[] = [];
    for (const f of ficheiros(join(__dirname, '..'))) {
      const src = readFileSync(f, 'utf8');
      for (const [, chave, prefixo] of src.matchAll(/\bt\(\s*(?:'([\w.]+)'|`([\w.]+)\.\$\{)/g)) {
        const ok = chave ? chaves.has(chave) || chaves.has(`${chave}_other`) : prefixos.has(prefixo);
        if (!ok) emFalta.push(`${relative(join(__dirname, '..'), f)}: ${chave ?? `${prefixo}.*`}`);
      }
    }
    expect(emFalta).toEqual([]);
  });
});

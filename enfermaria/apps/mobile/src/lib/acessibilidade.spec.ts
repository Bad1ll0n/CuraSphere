/**
 * UX-24 — guarda de acessibilidade da app móvel (VoiceOver/TalkBack e letra grande).
 *
 * Havia 2 `accessibilityLabel` para mais de 300 botões, e texto de 10–12 sp em centenas de
 * sítios. Estas regras impedem o regresso:
 *  - todo o `TouchableOpacity`/`Pressable` diz que é um botão (`accessibilityRole`);
 *  - um botão só com ícone (sem `<Text>` lá dentro) tem `accessibilityLabel` — senão o leitor
 *    de ecrã anuncia "botão" e mais nada;
 *  - nenhum texto abaixo de 13 sp, e ninguém desliga a escala de letra do sistema.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, '..');
function ficheiros(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'test-doubles' ? [] : ficheiros(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.spec.') ? [p] : [];
  });
}

/** Aberturas de TouchableOpacity/Pressable: [início, fim, autofechada, nome]. Respeita {…} e aspas. */
export function aberturas(s: string): [number, number, boolean, string][] {
  const out: [number, number, boolean, string][] = [];
  const re = /<(TouchableOpacity|Pressable)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    let i = re.lastIndex, depth = 0, q: string | null = null;
    for (; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) { out.push([m.index, i, s[i - 1] === '/', m[1]]); break; }
    }
  }
  return out;
}

function corpo(s: string, fim: number, nome: string): string {
  const fecho = s.indexOf(`</${nome}>`, fim);
  return fecho < 0 ? '' : s.slice(fim + 1, fecho);
}

const linha = (s: string, i: number) => s.slice(0, i).split('\n').length;

describe('acessibilidade da app móvel (UX-24)', () => {
  const fontes = ficheiros(RAIZ).map((f) => ({ f: relative(RAIZ, f).replace(/\\/g, '/'), s: readFileSync(f, 'utf8') }));

  it('o detetor lê props com setas e chaves', () => {
    const s = `<TouchableOpacity onPress={() => fazer({ a: 1 })} accessibilityRole="button"><Text>Ok</Text></TouchableOpacity>`;
    expect(aberturas(s)).toHaveLength(1);
    expect(s.slice(...aberturas(s)[0].slice(0, 2) as [number, number])).toContain('accessibilityRole');
  });

  it('todo o botão tem accessibilityRole', () => {
    const falta = fontes.flatMap(({ f, s }) => aberturas(s).filter(([a, b]) => !s.slice(a, b).includes('accessibilityRole')).map(([a]) => `${f}:${linha(s, a)}`));
    expect(falta).toEqual([]);
  });

  it('um botão só com ícone tem accessibilityLabel', () => {
    const falta = fontes.flatMap(({ f, s }) => aberturas(s)
      .filter(([a, b, auto, nome]) => !s.slice(a, b).includes('accessibilityLabel') && !(auto ? '' : corpo(s, b, nome)).includes('<Text'))
      .map(([a]) => `${f}:${linha(s, a)}`));
    expect(falta).toEqual([]);
  });

  it('nenhum texto abaixo de 13 sp e a escala de letra do sistema nunca é desligada', () => {
    const pequenos = fontes.flatMap(({ f, s }) => [...s.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)].filter((m) => Number(m[1]) < 13).map((m) => `${f}:${linha(s, m.index!)} (${m[1]})`));
    expect(pequenos).toEqual([]);
    const desligada = fontes.filter(({ s }) => /allowFontScaling=\{?\s*false/.test(s)).map(({ f }) => f);
    expect(desligada).toEqual([]);
  });
});

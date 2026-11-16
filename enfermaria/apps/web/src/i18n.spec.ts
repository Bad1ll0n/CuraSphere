/**
 * UX-07 — internacionalização: o seletor PT/EN não pode prometer o que não cumpre.
 *
 * 1. pt.json e en.json têm exatamente as mesmas chaves.
 * 2. Cada `t('chave')` usado num componente existe nas mensagens (o next-intl não está tipado:
 *    uma chave errada só se via no ecrã, como texto cru).
 * 3. Texto fixo em JSX é dívida declarada em i18n-texto-fixo.json e só pode descer: um ficheiro
 *    novo nasce traduzido, e um ficheiro existente não ganha texto fixo. Quando se traduz um
 *    ecrã, a contagem desce e o teste pede para atualizar a base (assim a dívida não volta).
 *
 * Para regenerar a base depois de traduzir ecrãs:
 *   ATUALIZAR_BASELINE=1 pnpm nx run @org/web:test --skip-nx-cache
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import pt from './messages/pt.json';
import en from './messages/en.json';

type Arvore = { [k: string]: string | Arvore };
const RAIZ = __dirname;
const FICHEIRO_BASE = join(__dirname, 'i18n-texto-fixo.json');

function folhas(o: Arvore, prefixo = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [prefixo + k] : folhas(v, `${prefixo}${k}.`)));
}
function obter(o: Arvore, caminho: string): string | Arvore | undefined {
  return caminho.split('.').reduce<string | Arvore | undefined>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o);
}
function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : tsx(p);
    return e.name.endsWith('.tsx') && !/\.(spec|stories)\.tsx$/.test(e.name) ? [p] : [];
  });
}
const rel = (f: string) => relative(RAIZ, f).replace(/\\/g, '/');

// Texto fixo: nós de texto JSX e atributos visíveis com pelo menos duas letras seguidas.
const TEXTO = />\s*([^<>{}]*[A-Za-zÀ-ÿ]{2,}[^<>{}]*?)\s*</g;
const ATRIBUTO = /\b(?:placeholder|title|aria-label|alt|label)="([^"]*[A-Za-zÀ-ÿ]{2,}[^"]*)"/g;
const NAO_E_TEXTO = /[;=()]|&&|\|\||\?\s|\bconst\b|\breturn\b/;
export function textoFixo(fonte: string): string[] {
  const s = fonte
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const out: string[] = [];
  for (const m of s.matchAll(TEXTO)) if (!NAO_E_TEXTO.test(m[1])) out.push(m[1].trim());
  for (const m of s.matchAll(ATRIBUTO)) out.push(m[1]);
  return out;
}

describe('i18n (UX-07)', () => {
  it('pt.json e en.json têm as mesmas chaves', () => {
    const p = new Set(folhas(pt as Arvore));
    const e = new Set(folhas(en as Arvore));
    expect([...p].filter((k) => !e.has(k))).toEqual([]);
    expect([...e].filter((k) => !p.has(k))).toEqual([]);
  });

  it('cada t("chave") usado existe nas mensagens', () => {
    const emFalta: string[] = [];
    for (const f of tsx(RAIZ)) {
      const src = readFileSync(f, 'utf8');
      for (const [, nome, ns] of src.matchAll(/const\s+(\w+)\s*=\s*useTranslations\(\s*'([\w.]+)'\s*\)/g)) {
        const usos = new RegExp(`\\b${nome}(?:\\.rich)?\\(\\s*(?:'([\\w.]+)'|\`([\\w.]+)\\.\\$\\{)`, 'g');
        for (const [, chave, prefixo] of src.matchAll(usos)) {
          const alvo = obter(pt as Arvore, `${ns}.${chave ?? prefixo}`);
          const ok = chave ? typeof alvo === 'string' : !!alvo && typeof alvo === 'object';
          if (!ok) emFalta.push(`${rel(f)}: ${ns}.${chave ?? `${prefixo}.*`}`);
        }
      }
    }
    expect(emFalta).toEqual([]);
  });

  describe('texto fixo em JSX só pode descer', () => {
    const atual: Record<string, number> = {};
    for (const f of tsx(RAIZ)) {
      const n = textoFixo(readFileSync(f, 'utf8')).length;
      if (n) atual[rel(f)] = n;
    }
    if (process.env['ATUALIZAR_BASELINE'] === '1') {
      const ordenado = Object.fromEntries(Object.entries(atual).sort(([a], [b]) => a.localeCompare(b)));
      writeFileSync(FICHEIRO_BASE, JSON.stringify(ordenado, null, 2) + '\n');
    }
    const base: Record<string, number> = JSON.parse(readFileSync(FICHEIRO_BASE, 'utf8'));

    it('o detetor apanha o que diz apanhar', () => {
      expect(textoFixo('<p>Sem registos</p>')).toEqual(['Sem registos']);
      expect(textoFixo('<input placeholder="Descreva o motivo" />')).toEqual(['Descreva o motivo']);
      expect(textoFixo("<p>{t('vazio')}</p>")).toEqual([]);
      expect(textoFixo('const x = useState<string | null>(null);')).toEqual([]);
    });

    it('nenhum ficheiro ganha texto fixo (ficheiros novos nascem traduzidos)', () => {
      const piores = Object.entries(atual)
        .filter(([f, n]) => n > (base[f] ?? 0))
        .map(([f, n]) => `${f}: ${base[f] ?? 0} → ${n}`);
      expect(piores).toEqual([]);
    });

    it('a base acompanha o que já foi traduzido (atualize-a quando a contagem desce)', () => {
      const melhores = Object.entries(base)
        .filter(([f, n]) => (atual[f] ?? 0) < n)
        .map(([f, n]) => `${f}: ${n} → ${atual[f] ?? 0}`);
      expect(melhores).toEqual([]);
    });
  });
});

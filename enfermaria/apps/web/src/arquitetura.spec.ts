/**
 * ARQ-13 / ARQ-14 — dívida de arquitetura declarada que só pode descer.
 *
 * - Ficheiros grandes (ARQ-14): nenhum ficheiro passa de LIMITE_LINHAS, exceto os que já
 *   passavam e estão em arquitetura-base.json, e esses não podem crescer. O dashboard
 *   (1 800 linhas) foi partido por papel em components/dashboard/paineis.
 * - Carga manual (ARQ-13): `api.get(` fora de um `queryFn` do react-query (o padrão
 *   useEffect + useState + setInterval). Ecrãs novos usam react-query (lib/hooks); a contagem
 *   por ficheiro dos existentes só pode descer.
 *
 * - Design system (UX-19): botões com cor desenhada à mão (`<button className="bg-blue-600…">`)
 *   e cores hex inline. Usa-se `<Button variant>` / `<Badge tone>` de components/ui e os tokens
 *   CSS; a contagem por ficheiro só pode descer.
 *
 * Quando a dívida desce, o teste pede para atualizar a base:
 *   ATUALIZAR_BASELINE=1 pnpm nx run @org/web:test --skip-nx-cache
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = __dirname;
const FICHEIRO_BASE = join(__dirname, 'arquitetura-base.json');
export const LIMITE_LINHAS = 600;

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : fontes(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.(spec|stories)\.tsx?$/.test(e.name) ? [p] : [];
  });
}
const rel = (f: string) => relative(RAIZ, f).replace(/\\/g, '/');

/** Chamadas `api.get(` que não estão dentro de um `queryFn` do react-query. */
export function cargasManuais(src: string): number {
  let n = 0;
  for (const m of src.matchAll(/\bapi\.get\s*[<(]/g)) {
    const antes = src.slice(Math.max(0, m.index - 120), m.index);
    if (!/queryFn\s*:\s*(?:async\s*)?\([^)]*\)\s*=>\s*(?:\{[^}]*)?$/.test(antes)) n++;
  }
  return n;
}

/** `<button` com uma cor de preenchimento escrita à mão no className (em vez de `<Button variant>`). */
export function botoesCrus(src: string): number {
  let n = 0;
  for (const m of src.matchAll(/<button\b[^>]*?className=(["'`{])/g)) {
    const resto = src.slice(m.index, m.index + 600);
    const fim = resto.indexOf('>');
    if (/\bbg-(?:blue|indigo|red|emerald|green|violet)-[5-7]00\b/.test(resto.slice(0, fim < 0 ? 600 : fim))) n++;
  }
  return n;
}

/** Cores hex inline (`#1e40af`) em vez dos tokens do design system. */
export const coresHex = (src: string) => (src.match(/['"`(\s:]#[0-9a-fA-F]{6}\b/g) ?? []).length;

interface Base { grandes: Record<string, number>; cargaManual: Record<string, number>; botoesCrus: Record<string, number>; coresHex: Record<string, number> }

describe('arquitetura web (ARQ-13 / ARQ-14)', () => {
  const grandes: Record<string, number> = {};
  const cargaManual: Record<string, number> = {};
  const crus: Record<string, number> = {};
  const hex: Record<string, number> = {};
  for (const f of fontes(RAIZ)) {
    // Finais de linha normalizados: no CI (LF) e no Windows (CRLF) as contagens têm de ser iguais.
    const src = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    const linhas = src.split('\n').length;
    if (linhas > LIMITE_LINHAS) grandes[rel(f)] = linhas;
    const n = cargasManuais(src);
    if (n) cargaManual[rel(f)] = n;
    if (f.endsWith('.tsx') && !rel(f).startsWith('components/ui/')) {
      const b = botoesCrus(src);
      if (b) crus[rel(f)] = b;
      const h = coresHex(src);
      if (h) hex[rel(f)] = h;
    }
  }
  const ordenar = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  if (process.env['ATUALIZAR_BASELINE'] === '1') {
    writeFileSync(FICHEIRO_BASE, JSON.stringify({ grandes: ordenar(grandes), cargaManual: ordenar(cargaManual), botoesCrus: ordenar(crus), coresHex: ordenar(hex) }, null, 2) + '\n');
  }
  const base: Base = JSON.parse(readFileSync(FICHEIRO_BASE, 'utf8'));

  it('o detetor de carga manual distingue queryFn de useEffect', () => {
    expect(cargasManuais("useEffect(() => { api.get('/x').then(setX); }, []);")).toBe(1);
    expect(cargasManuais("useQuery({ queryKey: ['x'], queryFn: () => api.get('/x').then((r) => r.data) })")).toBe(0);
    expect(cargasManuais("useQuery({ queryKey: ['x'], queryFn: async () => { const r = await api.get('/x'); return r.data; } })")).toBe(0);
  });

  it(`nenhum ficheiro novo passa de ${LIMITE_LINHAS} linhas e os grandes não crescem`, () => {
    const piores = Object.entries(grandes)
      .filter(([f, n]) => n > (base.grandes[f] ?? LIMITE_LINHAS))
      .map(([f, n]) => `${f}: ${base.grandes[f] ?? LIMITE_LINHAS} → ${n}`);
    expect(piores).toEqual([]);
  });

  it('nenhum ficheiro ganha cargas manuais (ecrãs novos usam react-query)', () => {
    const piores = Object.entries(cargaManual)
      .filter(([f, n]) => n > (base.cargaManual[f] ?? 0))
      .map(([f, n]) => `${f}: ${base.cargaManual[f] ?? 0} → ${n}`);
    expect(piores).toEqual([]);
  });

  it('o detetor de botões crus apanha a cor à mão e ignora o <Button>', () => {
    expect(botoesCrus('<button onClick={x} className="bg-blue-600 text-white">Ok</button>')).toBe(1);
    expect(botoesCrus('<Button variant="primary">Ok</Button>')).toBe(0);
    expect(botoesCrus('<button className="border border-slate-200">Cancelar</button>')).toBe(0);
    expect(coresHex("style={{ color: '#1e40af' }}")).toBe(1);
  });

  it('nenhum ficheiro ganha botões com cor à mão nem cores hex (UX-19: usar components/ui e tokens)', () => {
    const piores = [
      ...Object.entries(crus).filter(([f, n]) => n > (base.botoesCrus?.[f] ?? 0)).map(([f, n]) => `botões ${f}: ${base.botoesCrus?.[f] ?? 0} → ${n}`),
      ...Object.entries(hex).filter(([f, n]) => n > (base.coresHex?.[f] ?? 0)).map(([f, n]) => `hex ${f}: ${base.coresHex?.[f] ?? 0} → ${n}`),
    ];
    expect(piores).toEqual([]);
  });

  it('a base acompanha o que já foi resolvido (atualize-a quando a dívida desce)', () => {
    const desceu = [
      ...Object.entries(base.grandes).filter(([f, n]) => (grandes[f] ?? 0) < n).map(([f, n]) => `grande ${f}: ${n} → ${grandes[f] ?? '≤' + LIMITE_LINHAS}`),
      ...Object.entries(base.cargaManual).filter(([f, n]) => (cargaManual[f] ?? 0) < n).map(([f, n]) => `carga ${f}: ${n} → ${cargaManual[f] ?? 0}`),
      ...Object.entries(base.botoesCrus ?? {}).filter(([f, n]) => (crus[f] ?? 0) < n).map(([f, n]) => `botões ${f}: ${n} → ${crus[f] ?? 0}`),
      ...Object.entries(base.coresHex ?? {}).filter(([f, n]) => (hex[f] ?? 0) < n).map(([f, n]) => `hex ${f}: ${n} → ${hex[f] ?? 0}`),
    ];
    expect(desceu).toEqual([]);
  });
});

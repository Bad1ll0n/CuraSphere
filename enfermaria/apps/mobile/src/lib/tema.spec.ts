import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { CORES, LETRA, estilosTematicos, esquemaDe } from './tema';
// O jest do mobile só cobre lógica pura: um duplo mínimo do react-native chega para o tema.
const esquemaDoSistema = { valor: 'light' as 'light' | 'dark' | null };
jest.mock('react-native', () => ({
  Appearance: { getColorScheme: () => esquemaDoSistema.valor },
  StyleSheet: { create: <T,>(o: T) => o },
  useColorScheme: () => esquemaDoSistema.valor,
}));

/** Contraste WCAG entre duas cores #rrggbb. */
function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('UX-24 — tema claro/escuro', () => {
  it('o esquema segue o do telemóvel', () => {
    expect(esquemaDe('dark')).toBe('escuro');
    expect(esquemaDe('light')).toBe('claro');
    expect(esquemaDe(null)).toBe('claro');
  });

  it.each(['claro', 'escuro'] as const)('%s: texto legível (AA) sobre o fundo e sobre os cartões', (e) => {
    const c = CORES[e];
    for (const fundo of [c.fundo, c.superficie]) {
      expect(contraste(c.texto, fundo)).toBeGreaterThanOrEqual(7);
      expect(contraste(c.textoSecundario, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.textoTenue, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('a mesma folha de estilos devolve as cores do esquema em uso', () => {
    const s = estilosTematicos((c) => ({ caixa: { backgroundColor: c.superficie } }));
    esquemaDoSistema.valor = 'light';
    expect(s.caixa).toMatchObject({ backgroundColor: CORES.claro.superficie });
    esquemaDoSistema.valor = 'dark';
    expect(s.caixa).toMatchObject({ backgroundColor: CORES.escuro.superficie });
    esquemaDoSistema.valor = 'light';
  });

  it('texto corrente a 15 sp', () => {
    expect(LETRA.corpo).toBe(15);
  });
});

// Dívida declarada: cores hex escritas à mão nos ecrãs (não mudam com o modo escuro). A contagem
// por ecrã só pode descer; os ecrãs de cabeceira já usam o tema. Regenerar depois de converter:
//   ATUALIZAR_BASELINE=1 pnpm nx run @org/mobile:test --skip-nx-cache
describe('UX-24 — cores à mão nos ecrãs só descem', () => {
  const RAIZ = join(__dirname, '..');
  const BASE = join(__dirname, 'cores-hex-base.json');
  const fontes = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = join(d, e.name);
    if (e.isDirectory()) return fontes(p);
    return /\.tsx$/.test(e.name) && !/\.spec\./.test(e.name) ? [p] : [];
  });
  const atual: Record<string, number> = {};
  for (const f of [...fontes(join(RAIZ, 'screens')), ...fontes(join(RAIZ, 'components')), join(RAIZ, 'app', 'App.tsx')]) {
    const n = (readFileSync(f, 'utf8').match(/['"]#[0-9a-fA-F]{3,6}['"]/g) ?? []).length;
    if (n) atual[relative(RAIZ, f).replace(/\\/g, '/')] = n;
  }
  if (process.env['ATUALIZAR_BASELINE'] === '1' || !existsSync(BASE)) {
    writeFileSync(BASE, JSON.stringify(Object.fromEntries(Object.entries(atual).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
  }
  const base: Record<string, number> = JSON.parse(readFileSync(BASE, 'utf8'));

  it('nenhum ecrã ganha cores hex à mão', () => {
    const piores = Object.entries(atual).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f}: ${base[f] ?? 0} → ${n}`);
    expect(piores).toEqual([]);
  });

  it('os ecrãs de cabeceira usam o tema', () => {
    for (const f of ['MARScreen.tsx', 'DoentesScreen.tsx', 'TurnoScreen.tsx', 'NotificacoesScreen.tsx']) {
      const src = readFileSync(join(RAIZ, 'screens', f), 'utf8');
      expect(src).toContain('estilosTematicos(');
      expect(src).toContain('useEsquema()');
    }
  });
});

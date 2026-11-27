import { Appearance, StyleSheet, useColorScheme } from 'react-native';

/**
 * UX-24 — tema central da app: paleta clara e escura e escala de letra.
 *
 * O modo escuro segue o do telemóvel (app.json: userInterfaceStyle "automatic"). Os ecrãs
 * descrevem os estilos uma vez, com as cores do tema (`estilosTematicos((c) => ({ … }))`), e
 * recebem a folha do esquema em uso. Para voltarem a desenhar quando o esquema muda, chamam
 * `useEsquema()` (ou `useCores()`).
 */
export type Esquema = 'claro' | 'escuro';

export interface Cores {
  fundo: string;
  superficie: string;
  superficieAlt: string;
  texto: string;
  textoSecundario: string;
  textoTenue: string;
  borda: string;
  acento: string;
  sobreAcento: string;
  perigo: string;
  sucesso: string;
  aviso: string;
}

export const CORES: Record<Esquema, Cores> = {
  claro: {
    fundo: '#f1f5f9',
    superficie: '#ffffff',
    superficieAlt: '#f8fafc',
    texto: '#0f172a',
    textoSecundario: '#475569',
    textoTenue: '#5f6b7f', // ≥ 4,5:1 sobre o fundo e os cartões (o #94a3b8 antigo ficava em 2,6:1)
    borda: '#e2e8f0',
    acento: '#2563eb',
    sobreAcento: '#ffffff',
    perigo: '#dc2626',
    sucesso: '#16a34a',
    aviso: '#d97706',
  },
  escuro: {
    fundo: '#0b1220',
    superficie: '#111827',
    superficieAlt: '#1f2937',
    texto: '#f1f5f9',
    textoSecundario: '#cbd5e1',
    textoTenue: '#94a3b8',
    borda: '#334155',
    acento: '#60a5fa',
    sobreAcento: '#0b1220',
    perigo: '#f87171',
    sucesso: '#4ade80',
    aviso: '#fbbf24',
  },
};

/** Escala de letra (sp). Texto corrente a 15: o 13–14 antigo era pequeno à cabeceira. */
export const LETRA = { corpo: 15, secundario: 13, titulo: 18, cabecalho: 22 } as const;

export const esquemaDe = (sistema: string | null | undefined): Esquema => (sistema === 'dark' ? 'escuro' : 'claro');

export function useEsquema(): Esquema {
  return esquemaDe(useColorScheme());
}

export function useCores(): Cores {
  return CORES[useEsquema()];
}

/**
 * Uma folha de estilos por esquema, criada à primeira utilização. O objeto devolvido resolve
 * cada estilo no esquema em uso no momento do acesso, por isso os ecrãs continuam a escrever
 * `s.cartao` sem mudar a estrutura.
 */
export function estilosTematicos<T extends StyleSheet.NamedStyles<T>>(criar: (c: Cores) => T): T {
  const cache: Partial<Record<Esquema, T>> = {};
  const folha = (): T => {
    const e = esquemaDe(Appearance.getColorScheme());
    return (cache[e] ??= StyleSheet.create(criar(CORES[e])) as T);
  };
  return new Proxy({} as T, { get: (_alvo, chave) => (folha() as Record<string | symbol, unknown>)[chave] });
}

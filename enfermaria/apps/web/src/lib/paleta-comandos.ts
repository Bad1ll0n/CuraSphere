/**
 * UX-18 — conteúdo da paleta de comandos (Ctrl+K).
 *
 * Antes eram duas listas fixas para todos os papéis, com rotas mortas (`/audit`, `/doentes/novo`),
 * o portal do doente no meio do pessoal e nada para "vitais". Agora:
 *  - a navegação vem do menu do utilizador (`filtrarMenus`), logo respeita o papel;
 *  - cada destino tem sinónimos clínicos ("vitais" → NEWS2, o meu turno; "tomas" → MAR);
 *  - na ficha de um doente aparecem as ações desse doente (vitais, medicação, notas…), que são
 *    também atalhos de uma tecla (V, M, N…);
 *  - os doentes abertos recentemente ficam à mão (por utilizador, neste posto).
 * A pesquisa ignora maiúsculas e acentos.
 */

export interface EntradaPaleta {
  id: string;
  label: string;
  href: string;
  palavras?: string[];
  tecla?: string;
}

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function corresponde(e: Pick<EntradaPaleta, 'label' | 'palavras'>, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  return [e.label, ...(e.palavras ?? [])].some((x) => normalizar(x).includes(t));
}

/** Sinónimos por destino do menu. */
export const SINONIMOS: Record<string, string[]> = {
  '/meu-turno': ['turno', 'os meus doentes', 'vitais', 'tarefas do turno'],
  '/mar': ['medicação', 'medicacao', 'administrar', 'tomas', 'mar'],
  '/risco-clinico': ['news2', 'vitais', 'deterioração', 'sinais vitais'],
  '/passagem-turno': ['isbar', 'passagem', 'handover'],
  '/camas': ['cama', 'ocupação', 'quartos'],
  '/doentes': ['processo', 'ficha', 'doente'],
  '/auditoria': ['audit', 'log', 'acessos'],
  '/farmacia': ['validação', 'stock', 'dispensa'],
  '/tarefas': ['pendentes', 'to do'],
};

export function entradasDoMenu(itens: { href: string; label: string }[]): EntradaPaleta[] {
  return itens.map((i) => ({ id: `nav:${i.href}`, label: i.label, href: i.href, palavras: SINONIMOS[i.href] }));
}

/** Separadores da ficha (`/doentes/[id]#…`) com a tecla de atalho. */
export const ACOES_FICHA: { separador: string; label: string; tecla: string; palavras: string[] }[] = [
  { separador: 'vitais', label: 'Registar sinais vitais', tecla: 'V', palavras: ['vitais', 'news2', 'tensão', 'temperatura', 'escalas'] },
  { separador: 'medicacao', label: 'Medicação e administração', tecla: 'M', palavras: ['medicação', 'prescrever', 'administrar', 'mar'] },
  { separador: 'notas', label: 'Notas clínicas', tecla: 'N', palavras: ['nota', 'soap', 'diário'] },
  { separador: 'cuidados', label: 'Plano de cuidados', tecla: 'C', palavras: ['cuidados', 'intervenções', 'feridas'] },
  { separador: 'exames', label: 'Exames e análises', tecla: 'E', palavras: ['exames', 'análises', 'resultados', 'lab'] },
  { separador: 'alta', label: 'Alta e plano de alta', tecla: 'A', palavras: ['alta', 'carta'] },
];

export function acoesDaFicha(doenteId: string): EntradaPaleta[] {
  return ACOES_FICHA.map((a) => ({
    id: `ficha:${a.separador}`, label: a.label, href: `/doentes/${doenteId}#${a.separador}`, palavras: a.palavras, tecla: a.tecla,
  }));
}

/** O id do doente se o caminho for a ficha (`/doentes/<id>` ou subpáginas), senão null. */
export function doenteDoCaminho(pathname: string | null): string | null {
  const m = /^\/doentes\/([0-9a-f-]{8,})/i.exec(pathname ?? '');
  return m ? m[1] : null;
}

// ── Doentes recentes (por utilizador, neste posto) ─────────────────────────────

export interface DoenteRecente { id: string; nome: string; cama?: string | null }
const MAX_RECENTES = 5;
const chave = (utilizadorId: string) => `curasphere_recentes_${utilizadorId}`;

export function lerRecentes(utilizadorId: string): DoenteRecente[] {
  try {
    const v = JSON.parse(localStorage.getItem(chave(utilizadorId)) ?? '[]');
    return Array.isArray(v) ? v.filter((d) => d && typeof d.id === 'string' && typeof d.nome === 'string').slice(0, MAX_RECENTES) : [];
  } catch { return []; }
}

export function registarRecente(utilizadorId: string, d: DoenteRecente): void {
  try {
    const lista = [d, ...lerRecentes(utilizadorId).filter((x) => x.id !== d.id)].slice(0, MAX_RECENTES);
    localStorage.setItem(chave(utilizadorId), JSON.stringify(lista));
  } catch { /* sem storage: a paleta funciona sem recentes */ }
}

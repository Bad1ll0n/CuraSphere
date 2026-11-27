/**
 * UX-27 — onboarding por papel.
 *
 * Antes: um modal de 3–5 passos de texto, sem apontar para nada no ecrã, com secções só para
 * médico e enfermeiro (farmácia, receção e direção recebiam "contacte o administrador"), e que
 * não se voltava a ver. Os profissionais rodam entre serviços e aprendem no posto.
 *
 * Aqui ficam os dados: os passos da visita guiada (cada um aponta para um elemento real — um
 * item do menu, a pesquisa, o bloqueio do posto) e os "primeiros passos" de cada papel, que se
 * vão completando à medida que o profissional visita os ecrãs.
 */

export interface PassoVisita {
  /** Chave das mensagens: tour.passo.<id>.titulo / .texto */
  id: string;
  /** Seletor do elemento a destacar. Se não estiver visível (menu fechado, papel sem acesso), o passo salta. */
  alvo: string;
}

const menu = (rota: string) => `#sidebar-nav a[href="${rota}"]`;
const PASSO_PALETA: PassoVisita = { id: 'paleta', alvo: '[data-tour="paleta"]' };
const PASSO_NOTIFICACOES: PassoVisita = { id: 'notificacoes', alvo: '[data-tour="notificacoes"]' };
const PASSO_BLOQUEAR: PassoVisita = { id: 'bloquear', alvo: '[data-tour="bloquear"]' };
const PASSO_AJUDA: PassoVisita = { id: 'ajuda', alvo: '[data-tour="ajuda"]' };

export const VISITA_POR_PAPEL: Record<string, PassoVisita[]> = {
  enfermeiro: [
    { id: 'meuTurno', alvo: menu('/meu-turno') }, { id: 'mar', alvo: menu('/mar') },
    { id: 'passagem', alvo: menu('/passagem-turno') }, PASSO_PALETA, PASSO_BLOQUEAR, PASSO_AJUDA,
  ],
  auxiliar: [{ id: 'meuTurno', alvo: menu('/meu-turno') }, { id: 'tarefas', alvo: menu('/tarefas') }, PASSO_PALETA, PASSO_BLOQUEAR, PASSO_AJUDA],
  medico: [
    { id: 'meuTurno', alvo: menu('/meu-turno') }, { id: 'doentes', alvo: menu('/doentes') },
    { id: 'worklist', alvo: menu('/worklist') }, PASSO_PALETA, PASSO_BLOQUEAR, PASSO_AJUDA,
  ],
  farmaceutico: [{ id: 'farmacia', alvo: menu('/farmacia') }, { id: 'farmaciaClinica', alvo: menu('/farmacia-clinica') }, PASSO_PALETA, PASSO_NOTIFICACOES, PASSO_AJUDA],
  administrativo: [
    { id: 'recepcao', alvo: menu('/recepcao') }, { id: 'registos', alvo: menu('/registos-administrativos') },
    { id: 'camas', alvo: menu('/camas') }, PASSO_PALETA, PASSO_AJUDA,
  ],
  direcao: [{ id: 'executivo', alvo: menu('/dashboard-executivo') }, { id: 'qualidade', alvo: menu('/dashboard-qualidade') }, PASSO_PALETA, PASSO_NOTIFICACOES, PASSO_AJUDA],
  qualidade: [{ id: 'qualidade', alvo: menu('/dashboard-qualidade') }, { id: 'eventos', alvo: menu('/eventos-adversos') }, PASSO_PALETA, PASSO_AJUDA],
};
const VISITA_GERAL: PassoVisita[] = [PASSO_PALETA, PASSO_NOTIFICACOES, PASSO_BLOQUEAR, PASSO_AJUDA];

export function visitaDoPapel(role: string): PassoVisita[] {
  return VISITA_POR_PAPEL[role] ?? VISITA_GERAL;
}

export interface PrimeiroPasso {
  /** Chave das mensagens: onboarding.primeiro.<id> */
  id: string;
  /** Fica feito quando o profissional abre esta rota (ou uma subpágina). */
  rota: string;
}

export const PRIMEIROS_PASSOS: Record<string, PrimeiroPasso[]> = {
  enfermeiro: [{ id: 'meuTurno', rota: '/meu-turno' }, { id: 'mar', rota: '/mar' }, { id: 'fichaDoente', rota: '/doentes/' }, { id: 'passagem', rota: '/passagem-turno' }],
  auxiliar: [{ id: 'meuTurno', rota: '/meu-turno' }, { id: 'tarefas', rota: '/tarefas' }],
  medico: [{ id: 'meuTurno', rota: '/meu-turno' }, { id: 'fichaDoente', rota: '/doentes/' }, { id: 'worklist', rota: '/worklist' }],
  farmaceutico: [{ id: 'farmacia', rota: '/farmacia' }, { id: 'farmaciaClinica', rota: '/farmacia-clinica' }],
  administrativo: [{ id: 'recepcao', rota: '/recepcao' }, { id: 'registos', rota: '/registos-administrativos' }, { id: 'camas', rota: '/camas' }],
  direcao: [{ id: 'executivo', rota: '/dashboard-executivo' }, { id: 'qualidade', rota: '/dashboard-qualidade' }],
};

export function primeirosPassosDoPapel(role: string): PrimeiroPasso[] {
  return PRIMEIROS_PASSOS[role] ?? [];
}

/** O passo fica feito ao abrir a rota (ou uma subpágina, ex.: a ficha de qualquer doente). */
export function passoFeitoPor(passo: PrimeiroPasso, pathname: string): boolean {
  return passo.rota.endsWith('/') ? pathname.startsWith(passo.rota) && pathname.length > passo.rota.length
    : pathname === passo.rota || pathname.startsWith(passo.rota + '/');
}

// ── estado por utilizador, neste posto (o progresso não é dado clínico) ─────────────────────────

export interface EstadoOnboarding { visitados: string[]; fechado: boolean; novidadesVistas: string | null }
const VAZIO: EstadoOnboarding = { visitados: [], fechado: false, novidadesVistas: null };
const chave = (utilizadorId: string) => `curasphere_onboarding_${utilizadorId}`;

export function lerOnboarding(utilizadorId: string): EstadoOnboarding {
  try {
    const v = JSON.parse(localStorage.getItem(chave(utilizadorId)) ?? 'null');
    return v && Array.isArray(v.visitados) ? { ...VAZIO, ...v } : { ...VAZIO };
  } catch { return { ...VAZIO }; }
}

export function gravarOnboarding(utilizadorId: string, e: EstadoOnboarding): void {
  try { localStorage.setItem(chave(utilizadorId), JSON.stringify(e)); } catch { /* sem storage: volta a aparecer */ }
}

/** Marca os passos que este caminho conclui. Devolve o estado novo (ou o mesmo, se nada mudou). */
export function registarVisita(e: EstadoOnboarding, passos: PrimeiroPasso[], pathname: string): EstadoOnboarding {
  const novos = passos.filter((p) => !e.visitados.includes(p.id) && passoFeitoPor(p, pathname)).map((p) => p.id);
  return novos.length ? { ...e, visitados: [...e.visitados, ...novos] } : e;
}

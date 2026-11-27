'use client';

import { useEffect } from 'react';
import { LETRA_SENHA } from '@org/shared';

export const SERVICOS = [
  // UX-07: o nome vem de kiosk.service.<tipo>.
  // UX-26: letras mnemónicas, as mesmas da api (libs/shared): F = Farmácia, I = Informações.
  { tipo: 'admissao', letra: LETRA_SENHA.admissao, cor: '#3b82f6' },
  { tipo: 'consulta', letra: LETRA_SENHA.consulta, cor: '#8b5cf6' },
  { tipo: 'faturacao', letra: LETRA_SENHA.faturacao, cor: '#f59e0b' },
  { tipo: 'farmacia', letra: LETRA_SENHA.farmacia, cor: '#10b981' },
  { tipo: 'exames', letra: LETRA_SENHA.exames, cor: '#06b6d4' },
  { tipo: 'geral', letra: LETRA_SENHA.geral, cor: '#6b7280' },
];

/** Segundos sem toques até o quiosque voltar ao início (a meio / depois de mostrar o resultado). */
export const REPOSICAO_MS = { aMeio: 30_000, fim: 15_000 };
const ECRAS_FINAIS = ['sucesso', 'marcacao_sucesso', 'nova_sucesso'];

/**
 * UX-26: o quiosque volta sozinho ao início — 30 s sem toques a meio de um percurso, 15 s depois
 * de mostrar a senha ou a marcação. Antes o utente seguinte via os dados do anterior (nome, NIF
 * identificado, marcações).
 */
export function useReposicaoQuiosque(estado: string, reiniciar: () => void) {
  useEffect(() => {
    if (estado === 'selecionar') return;
    const espera = ECRAS_FINAIS.includes(estado) ? REPOSICAO_MS.fim : REPOSICAO_MS.aMeio;
    let temporizador = setTimeout(reiniciar, espera);
    const toque = () => { clearTimeout(temporizador); temporizador = setTimeout(reiniciar, espera); };
    const eventos = ['pointerdown', 'keydown'] as const;
    eventos.forEach((e) => window.addEventListener(e, toque, { passive: true }));
    return () => { clearTimeout(temporizador); eventos.forEach((e) => window.removeEventListener(e, toque)); };
  }, [estado]);
}

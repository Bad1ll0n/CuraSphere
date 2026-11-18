'use client';
import dynamic from 'next/dynamic';

/**
 * PERF-10 — painéis da ficha com gráficos (recharts) carregados só quando o separador que os
 * mostra é aberto. Antes pesavam no primeiro carregamento da ficha (468 → 254 KB gzip).
 */
export const SinaisVitaisPanel = dynamic(() => import('./sinais-vitais-panel').then((m) => m.SinaisVitaisPanel));
export const PediatriaPanel = dynamic(() => import('./pediatria-panel').then((m) => m.PediatriaPanel));
export const BalancoHidricoPanel = dynamic(() => import('./balanco-hidrico-panel').then((m) => m.BalancoHidricoPanel));
export const MaternidadePanel = dynamic(() => import('./maternidade-panel').then((m) => m.MaternidadePanel));
export const DialisePanel = dynamic(() => import('./dialise-panel').then((m) => m.DialisePanel));
export const PlanoCuidadosPanel = dynamic(() => import('./plano-cuidados-panel').then((m) => m.PlanoCuidadosPanel));

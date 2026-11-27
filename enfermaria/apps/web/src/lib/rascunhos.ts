'use client';

import { useCallback, useState } from 'react';

/**
 * UX-21 — rascunhos que sobrevivem ao fim da sessão por inatividade.
 *
 * Num posto partilhado, a sessão termina aos 15 min sem atividade e quem estava a meio de uma nota
 * de turno perdia o texto. Os rascunhos ficam **só na memória deste separador** (nunca em
 * `localStorage`, onde o próximo utilizador do posto os leria), separados por utilizador:
 *  - a sessão expira → o rascunho fica; o mesmo profissional volta a entrar → reaparece;
 *  - outro profissional entra no mesmo posto → não o vê (a chave inclui o id de quem escreveu);
 *  - "Terminar sessão" explícito ou recarregar a página → desaparecem.
 */
const memoria = new Map<string, unknown>();
let utilizadorAtual: string | null = null;

/** Chamado pela sessão: os rascunhos passam a ser os deste utilizador. */
export function definirUtilizadorRascunhos(id: string | null) {
  utilizadorAtual = id;
}

/** Logout explícito: apaga os rascunhos deste utilizador. */
export function limparRascunhos(id: string | null = utilizadorAtual) {
  if (!id) return;
  for (const k of [...memoria.keys()]) if (k.startsWith(`${id}:`)) memoria.delete(k);
}

export function lerRascunho<T>(chave: string): T | undefined {
  return utilizadorAtual ? (memoria.get(`${utilizadorAtual}:${chave}`) as T | undefined) : undefined;
}

export function gravarRascunho<T>(chave: string, valor: T, vazio: T) {
  if (!utilizadorAtual) return;
  const k = `${utilizadorAtual}:${chave}`;
  if (JSON.stringify(valor) === JSON.stringify(vazio)) memoria.delete(k);
  else memoria.set(k, valor);
}

/** Como `useState`, mas o valor sobrevive ao fim da sessão (ver acima). `vazio` = sem rascunho. */
export function useRascunho<T>(chave: string, vazio: T): [T, (v: T | ((a: T) => T)) => void] {
  const [valor, setValor] = useState<T>(() => lerRascunho<T>(chave) ?? vazio);
  const definir = useCallback((v: T | ((a: T) => T)) => {
    setValor((atual) => {
      const novo = typeof v === 'function' ? (v as (a: T) => T)(atual) : v;
      gravarRascunho(chave, novo, vazio);
      return novo;
    });
  }, [chave]);
  return [valor, definir];
}

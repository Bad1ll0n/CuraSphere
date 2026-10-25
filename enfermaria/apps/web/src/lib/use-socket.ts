'use client';

import { useEffect, useRef, useCallback, useState, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Sentry from '@sentry/nextjs';
import api from './api';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace('/api', '');

/**
 * Rota do bilhete de socket (ver dependência de backend BE-DEP-01 no relatório da auditoria).
 *
 * O pessoal autentica-se por cookie `httpOnly` (`access_token`), que por definição não é legível
 * por JavaScript — logo o browser não consegue pôr o token de sessão no `auth.token` do handshake.
 * O gateway, por outro lado, exige um token de pessoal assinado (HS256, iss `curasphere-api`,
 * aud `curasphere`, `tipo === 'pessoal'` com `role` e `servico`).
 *
 * A ponte é este endpoint: o browser pede-o com o cookie (`withCredentials`), a API valida o
 * cookie e devolve um bilhete de curta duração que serve só para o handshake do websocket.
 * Enquanto o endpoint não existir, o pedido falha e o estado da ligação passa a `falhou` —
 * de forma visível (ver `SocketStatusBanner`), nunca em silêncio.
 */
const ROTA_BILHETE = '/auth/socket-ticket';

const MAX_TENTATIVAS = 5;

export type EstadoLigacao =
  /** A negociar bilhete / a estabelecer ligação. */
  | 'a-ligar'
  /** Ligado e a receber eventos. */
  | 'ligado'
  /** Sem canal em tempo real. Os alertas clínicos NÃO estão a chegar. */
  | 'falhou';

export interface EstadoSocket {
  estado: EstadoLigacao;
  /** Motivo técnico da última falha (para diagnóstico; não é texto de interface). */
  erro: string | null;
}

// ── Estado partilhado (o socket é único para toda a aplicação) ────────────────
let sharedSocket: Socket | null = null;
let refCount = 0;
let instantaneo: EstadoSocket = { estado: 'a-ligar', erro: null };
const ouvintes = new Set<() => void>();

function publicar(estado: EstadoLigacao, erro: string | null) {
  if (instantaneo.estado === estado && instantaneo.erro === erro) return;
  instantaneo = { estado, erro };
  ouvintes.forEach((l) => l());
}

function subscreverEstado(l: () => void) {
  ouvintes.add(l);
  return () => { ouvintes.delete(l); };
}

function lerEstado(): EstadoSocket {
  return instantaneo;
}

// Estado no servidor (SSR): a ligação ainda nem foi tentada.
const ESTADO_SSR: EstadoSocket = { estado: 'a-ligar', erro: null };
function lerEstadoServidor(): EstadoSocket {
  return ESTADO_SSR;
}

function descreverErro(e: unknown): string {
  if (typeof e === 'object' && e !== null) {
    const resposta = (e as { response?: { status?: number } }).response;
    if (resposta?.status) return `bilhete de socket: HTTP ${resposta.status}`;
    const msg = (e as { message?: string }).message;
    if (msg) return msg;
  }
  return 'erro desconhecido';
}

/** Falha do canal em tempo real é sempre reportada — nunca engolida. */
let ultimoReportado: string | null = null;
function reportarFalha(motivo: string) {
  if (ultimoReportado === motivo) return; // não inundar o Sentry em ciclo de reconexão
  ultimoReportado = motivo;
  // eslint-disable-next-line no-console
  console.error('[tempo-real] canal de alertas clínicos indisponível:', motivo);
  Sentry.captureMessage(`WebSocket clínico indisponível: ${motivo}`, 'error');
}

/**
 * Pede à API um bilhete de curta duração para o handshake, autenticando-se pelo cookie
 * `httpOnly` da sessão (o `api` do axios corre com `withCredentials: true`).
 */
async function obterBilhete(): Promise<string> {
  const { data } = await api.get(ROTA_BILHETE);
  const bilhete = (data as { ticket?: unknown } | null)?.ticket;
  if (typeof bilhete !== 'string' || bilhete.length === 0) {
    throw new Error('resposta do bilhete de socket sem campo "ticket"');
  }
  return bilhete;
}

function criarSocket(): Socket {
  const socket = io(`${WS_URL}/ws`, {
    // `auth` como função é reavaliada em cada tentativa de ligação — inclusive nas reconexões.
    // É o que permite usar bilhetes de curta duração sem os guardar em lado nenhum.
    auth: (cb: (dados: Record<string, unknown>) => void) => {
      publicar('a-ligar', null);
      obterBilhete()
        .then((token) => cb({ token }))
        .catch((e) => {
          const motivo = descreverErro(e);
          reportarFalha(motivo);
          publicar('falhou', motivo);
          // Sem bilhete não há handshake possível; envia vazio para o servidor recusar
          // depressa em vez de deixar a ligação pendurada.
          cb({ token: '' });
        });
    },
    transports: ['websocket'],
    withCredentials: true,
    reconnectionAttempts: MAX_TENTATIVAS,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    ultimoReportado = null;
    publicar('ligado', null);
  });

  socket.on('connect_error', (err: Error) => {
    publicar('a-ligar', err?.message ?? 'connect_error');
  });

  socket.on('disconnect', (reason: string) => {
    if (reason === 'io client disconnect') return; // desmontagem normal
    if (reason === 'io server disconnect') {
      // O gateway recusou o handshake (bilhete inválido/ausente) e não haverá reconexão
      // automática. É uma falha terminal e tem de ser visível.
      const motivo = 'handshake recusado pelo servidor (bilhete inválido ou em falta)';
      reportarFalha(motivo);
      publicar('falhou', motivo);
      return;
    }
    publicar('a-ligar', reason);
  });

  socket.io.on('reconnect_failed', () => {
    const motivo = `sem ligação ao servidor após ${MAX_TENTATIVAS} tentativas`;
    reportarFalha(motivo);
    publicar('falhou', motivo);
  });

  return socket;
}

function getSocket(): Socket {
  if (!sharedSocket) sharedSocket = criarSocket();
  return sharedSocket;
}

type SocketEvent =
  | 'urgencia:update'
  | 'urgencia:ambulancia'
  | 'urgencia:sla-excedido'
  | 'sos:alerta'
  | 'alerta:novo'
  | 'doente:estado'
  | 'bloco:update'
  | 'turno:passagem-desafio'
  | 'turno:passagem-confirmada'
  | 'nota:lock'
  | 'nota:unlock'
  | 'nota:lock-denied'
  | 'pong';

/**
 * Subscreve eventos do canal em tempo real e devolve o estado da ligação.
 *
 * A autenticação é tratada aqui dentro (bilhete pedido com o cookie de sessão) — os
 * chamadores não passam token nenhum. Devolve sempre o estado para que a interface possa
 * dizer ao utilizador que o canal caiu: uma falha silenciosa num canal que transporta
 * alertas SOS e SLA de urgência é indistinguível de "não há alertas".
 */
export function useSocket(
  handlers: Partial<Record<SocketEvent, (data: any) => void>>,
): EstadoSocket & { reconectar: () => void } {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const estadoSocket = useSyncExternalStore(subscreverEstado, lerEstado, lerEstadoServidor);
  const [geracao, setGeracao] = useState(0);

  const subscribe = useCallback((socket: Socket) => {
    const entries = Object.entries(handlersRef.current) as [SocketEvent, (d: any) => void][];

    // Guardar a referência de cada wrapper é obrigatório para o desmontar.
    //
    // `socket.off(evento)` SEM handler remove os ouvintes de TODOS os componentes, não só
    // os deste. Como `sos:alerta` é subscrito ao mesmo tempo no shell do dashboard e na
    // página inicial, sair dessa página apagava também o ouvinte do shell — e o alerta de
    // SOS ficava mudo para o resto da sessão, com o banner a continuar a dizer 'ligado'.
    const registados: [SocketEvent, (d: any) => void][] = entries.map(([event]) => {
      const wrapper = (data: any) => handlersRef.current[event]?.(data);
      socket.on(event, wrapper);
      return [event, wrapper];
    });

    return () => {
      for (const [event, wrapper] of registados) {
        socket.off(event, wrapper);
      }
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    refCount++;
    const unsub = subscribe(socket);

    return () => {
      unsub();
      refCount--;
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
        instantaneo = { estado: 'a-ligar', erro: null };
        ultimoReportado = null;
      }
    };
  }, [subscribe, geracao]);

  /** Nova tentativa manual, para o botão "Tentar novamente" do aviso de ligação. */
  const reconectar = useCallback(() => {
    if (sharedSocket) {
      sharedSocket.disconnect();
      sharedSocket = null;
    }
    refCount = 0;
    ultimoReportado = null;
    publicar('a-ligar', null);
    setGeracao((g) => g + 1);
  }, []);

  return { ...estadoSocket, reconectar };
}

/** Lê apenas o estado da ligação, sem subscrever eventos nem segurar o socket. */
export function useEstadoSocket(): EstadoSocket {
  return useSyncExternalStore(subscreverEstado, lerEstado, lerEstadoServidor);
}

export function emitSocket(event: string, data?: unknown) {
  sharedSocket?.emit(event, data);
}

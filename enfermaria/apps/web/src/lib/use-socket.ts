import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace('/api', '');

let sharedSocket: Socket | null = null;
let refCount = 0;

function getSocket(token: string): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(`${WS_URL}/ws`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }
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

export function useSocket(
  token: string | undefined,
  handlers: Partial<Record<SocketEvent, (data: any) => void>>,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const subscribe = useCallback((socket: Socket) => {
    const entries = Object.entries(handlersRef.current) as [SocketEvent, (d: any) => void][];
    for (const [event] of entries) {
      socket.on(event, (data: any) => handlersRef.current[event]?.(data));
    }
    return () => {
      for (const [event] of entries) {
        socket.off(event);
      }
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = getSocket(token);
    refCount++;
    const unsub = subscribe(socket);

    return () => {
      unsub();
      refCount--;
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, [token, subscribe]);
}

export function emitSocket(event: string, data?: unknown) {
  sharedSocket?.emit(event, data);
}

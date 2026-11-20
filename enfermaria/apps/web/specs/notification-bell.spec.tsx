import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import pt from '../src/messages/pt.json';

// next-intl é ESM e não carrega no Jest: as mensagens são as reais (pt.json), com {variáveis}.
jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (chave: string, vars: Record<string, unknown> = {}) => {
    const txt = chave.split('.').reduce((o: any, k) => o?.[k], (pt as any)[ns]) ?? `${ns}.${chave}`;
    return String(txt).replace(/\{(\w+)\}/g, (_m: string, k: string) => String(vars[k] ?? ''));
  },
}));
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
// O som sai pelo Web Audio: conta-se cada AudioContext criado.
const tocar = jest.fn();
const no = () => ({ connect: jest.fn(), start: jest.fn(), stop: jest.fn(), frequency: { value: 0 }, gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() } });
(window as any).AudioContext = jest.fn(() => { tocar(); return { createOscillator: no, createGain: no, destination: {}, currentTime: 0 }; });
jest.mock('@/lib/hooks/use-notificacoes', () => ({
  useNaoLidasCount: jest.fn(),
  useNotificacoes: jest.fn(),
  useMarcarLida: jest.fn(),
  useMarcarTodasLidas: jest.fn(),
}));

import { NotificationBell } from '../src/components/notification-bell';
import { deveTocar } from '../src/lib/alerta-sonoro';
import { useNaoLidasCount, useNotificacoes, useMarcarLida, useMarcarTodasLidas } from '@/lib/hooks/use-notificacoes';

const mockCount = useNaoLidasCount as jest.Mock;
const mockLista = useNotificacoes as jest.Mock;
const mutateLida = jest.fn();
const mutateTodas = jest.fn();
const n = (id: string, extra: Record<string, unknown> = {}) => ({ id, titulo: `T${id}`, corpo: 'c', lida: false, criadaEm: new Date().toISOString(), ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockCount.mockReturnValue({ data: { count: 0 } });
  mockLista.mockReturnValue({ data: { notificacoes: [] } });
  (useMarcarLida as jest.Mock).mockReturnValue({ mutate: mutateLida });
  (useMarcarTodasLidas as jest.Mock).mockReturnValue({ mutate: mutateTodas });
});

describe('NotificationBell (UX-11)', () => {
  it('badge: nada com 0, número, e 99+', () => {
    const { rerender } = render(<NotificationBell />);
    expect(screen.queryByText('0')).toBeNull();
    mockCount.mockReturnValue({ data: { count: 3 } });
    rerender(<NotificationBell />);
    expect(screen.getByText('3')).toBeTruthy();
    mockCount.mockReturnValue({ data: { count: 150 } });
    rerender(<NotificationBell />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('a lista mostra as notificações (a API devolve `notificacoes`), críticas primeiro', () => {
    mockCount.mockReturnValue({ data: { count: 2 } });
    mockLista.mockReturnValue({ data: { notificacoes: [n('a', { nivel: 'informativo' }), n('b', { nivel: 'critico' })] } });
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /Notificações/ }));
    const itens = screen.getAllByRole('button').filter((b) => /^Crítico|^T/.test(b.textContent ?? ''));
    expect(itens[0].textContent).toContain('Tb');
    expect(screen.getByText(/Marcar todas lidas/)).toBeTruthy();
  });

  it('o clique marca como lida E abre a ficha do doente', () => {
    mockCount.mockReturnValue({ data: { count: 1 } });
    mockLista.mockReturnValue({ data: { notificacoes: [n('x', { nivel: 'critico', doenteId: 'd1' })] } });
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /Notificações/ }));
    fireEvent.click(screen.getByText(/Tx/));
    expect(mutateLida).toHaveBeenCalledWith('x');
    expect(push).toHaveBeenCalledWith('/doentes/d1');
  });

  it('o primeiro crítico (caixa vazia → 1) toca', () => {
    const { rerender } = render(<NotificationBell />);
    expect(tocar).not.toHaveBeenCalled();
    mockLista.mockReturnValue({ data: { notificacoes: [n('c', { nivel: 'critico' })] } });
    rerender(<NotificationBell />);
    expect(tocar).toHaveBeenCalledTimes(1);
  });
});

describe('regra do som (UX-11)', () => {
  it('toca quando sobe (incluindo de 0) e repete fora do silêncio', () => {
    expect(deveTocar(0, 1, false, 0)).toBe(true);
    expect(deveTocar(2, 2, false, 0)).toBe(false);
    expect(deveTocar(1, 1, true, 0)).toBe(true);
    expect(deveTocar(1, 1, true, Date.now() + 60_000)).toBe(false);
    expect(deveTocar(0, 0, true, 0)).toBe(false);
  });
});

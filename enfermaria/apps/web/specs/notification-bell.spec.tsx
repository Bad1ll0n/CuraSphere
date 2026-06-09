import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBell } from '../src/components/notification-bell';

jest.mock('@/lib/hooks/use-notificacoes', () => ({
  useNaoLidasCount:    jest.fn(),
  useNotificacoes:     jest.fn(),
  useMarcarLida:       jest.fn(),
  useMarcarTodasLidas: jest.fn(),
}));

import {
  useNaoLidasCount,
  useNotificacoes,
  useMarcarLida,
  useMarcarTodasLidas,
} from '@/lib/hooks/use-notificacoes';

const mockUseNaoLidasCount    = useNaoLidasCount    as jest.Mock;
const mockUseNotificacoes     = useNotificacoes     as jest.Mock;
const mockUseMarcarLida       = useMarcarLida       as jest.Mock;
const mockUseMarcarTodasLidas = useMarcarTodasLidas as jest.Mock;

const mutateMarcarLida   = jest.fn();
const mutateMarcarTodas  = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNaoLidasCount.mockReturnValue({ data: { count: 0 } });
  mockUseNotificacoes.mockReturnValue({ data: { data: [] } });
  mockUseMarcarLida.mockReturnValue({ mutate: mutateMarcarLida });
  mockUseMarcarTodasLidas.mockReturnValue({ mutate: mutateMarcarTodas });
});

describe('NotificationBell', () => {
  it('não mostra badge quando count=0', () => {
    render(<NotificationBell />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('mostra contagem quando há notificações não lidas', () => {
    mockUseNaoLidasCount.mockReturnValue({ data: { count: 3 } });
    render(<NotificationBell />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('mostra "99+" quando count > 99', () => {
    mockUseNaoLidasCount.mockReturnValue({ data: { count: 150 } });
    render(<NotificationBell />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('clicar no sino abre o painel de notificações', () => {
    render(<NotificationBell />);
    const sino = screen.getByRole('button');
    fireEvent.click(sino);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('"Marcar todas lidas" só aparece quando há notificações não lidas', () => {
    mockUseNaoLidasCount.mockReturnValue({ data: { count: 0 } });
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText(/marcar todas/i)).toBeNull();
  });

  it('"Marcar todas lidas" é visível quando count > 0', () => {
    mockUseNaoLidasCount.mockReturnValue({ data: { count: 2 } });
    mockUseNotificacoes.mockReturnValue({
      data: {
        data: [
          { id: '1', titulo: 'Alerta', corpo: 'Mensagem', lida: false, tipo: 'info', criadaEm: new Date().toISOString() },
        ],
      },
    });
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/marcar todas/i)).toBeTruthy();
  });
});

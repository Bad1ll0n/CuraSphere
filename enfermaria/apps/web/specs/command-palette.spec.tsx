import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import pt from '../src/messages/pt.json';
import { CommandPalette } from '../src/components/command-palette';

// next-intl é ESM e não carrega no Jest: as mensagens são as reais (pt.json), com {variáveis}.
jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (chave: string, vars: Record<string, unknown> = {}) => {
    const txt = chave.split('.').reduce((o: any, k) => o?.[k], (pt as any)[ns]) ?? `${ns}.${chave}`;
    return String(txt).replace(/\{(\w+)\}/g, (_m: string, k: string) => String(vars[k] ?? ''));
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  get: jest.fn().mockResolvedValue({ data: [] }),
}));

import { useRouter, usePathname } from 'next/navigation';
const mockPush = jest.fn();

const MENU = [{ href: '/camas', label: 'Camas' }, { href: '/risco-clinico', label: 'Risco Clínico' }, { href: '/mar', label: 'MAR' }];
const base = { onClose: jest.fn(), itens: MENU, utilizadorId: 'u1', podePesquisarDoentes: true, podeAdmitir: false };

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  (usePathname as jest.Mock).mockReturnValue('/dashboard');
  localStorage.clear();
});

describe('CommandPalette', () => {
  it('não renderiza quando open=false', () => {
    render(<CommandPalette {...base} open={false} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('tecla Escape chama onClose', () => {
    const onClose = jest.fn();
    render(<CommandPalette {...base} open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('UX-18: a navegação é o menu do utilizador — sem rotas fixas nem portal', () => {
    render(<CommandPalette {...base} open={true} />);
    expect(screen.getByText('Camas')).toBeTruthy();
    expect(screen.queryByText(/portal doente|audit log|novo doente/i)).toBeNull();
  });

  it('UX-18: "vitais" encontra o NEWS2 (sinónimos, sem acentos)', () => {
    render(<CommandPalette {...base} open={true} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'vitais' } });
    expect(screen.getByText('Risco Clínico')).toBeTruthy();
    expect(screen.queryByText('Camas')).toBeNull();
  });

  it('UX-18: na ficha aparecem as ações do doente, com tecla', () => {
    (usePathname as jest.Mock).mockReturnValue('/doentes/7f0c2a52-1d2e-4f6b-9a3d-111111111111');
    render(<CommandPalette {...base} open={true} />);
    expect(screen.getByText('Registar sinais vitais')).toBeTruthy();
    expect(screen.getByText('Neste doente')).toBeTruthy();
  });

  it('"Admitir doente" só aparece a quem pode admitir', () => {
    const { unmount } = render(<CommandPalette {...base} open={true} />);
    expect(screen.queryByText('Admitir doente')).toBeNull();
    unmount();
    render(<CommandPalette {...base} open={true} podeAdmitir />);
    expect(screen.getByText('Admitir doente')).toBeTruthy();
  });
});

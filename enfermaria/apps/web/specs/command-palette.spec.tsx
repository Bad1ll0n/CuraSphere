import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from '../src/components/command-palette';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  get: jest.fn().mockResolvedValue({ data: [] }),
}));

import { useRouter } from 'next/navigation';
const mockUseRouter = useRouter as jest.Mock;
const mockPush = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push: mockPush });
});

describe('CommandPalette', () => {
  it('não renderiza quando open=false', () => {
    render(<CommandPalette open={false} onClose={jest.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('renderiza campo de pesquisa quando open=true', () => {
    render(<CommandPalette open={true} onClose={jest.fn()} />);
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('tecla Escape chama onClose', () => {
    const onClose = jest.fn();
    render(<CommandPalette open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('links de navegação rápida são visíveis', () => {
    render(<CommandPalette open={true} onClose={jest.fn()} />);
    expect(screen.getByText(/camas|horários|farmácia|urgência/i)).toBeTruthy();
  });

  it('campo de pesquisa aceita input de texto', () => {
    render(<CommandPalette open={true} onClose={jest.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'João' } });
    expect((input as HTMLInputElement).value).toBe('João');
  });
});

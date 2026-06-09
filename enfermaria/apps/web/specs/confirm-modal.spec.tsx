import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../src/components/confirm-modal';

const defaultProps = {
  isOpen: true,
  titulo: 'Confirmar acção',
  mensagem: 'Tem a certeza que pretende continuar?',
  onConfirmar: jest.fn(),
  onCancelar: jest.fn(),
};

describe('ConfirmModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não renderiza quando isOpen=false', () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renderiza título e mensagem quando isOpen=true', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Confirmar acção')).toBeTruthy();
    expect(screen.getByText('Tem a certeza que pretende continuar?')).toBeTruthy();
  });

  it('botão Cancelar chama onCancelar', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(defaultProps.onCancelar).toHaveBeenCalledTimes(1);
    expect(defaultProps.onConfirmar).not.toHaveBeenCalled();
  });

  it('botão Confirmar chama onConfirmar', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(defaultProps.onConfirmar).toHaveBeenCalledTimes(1);
    expect(defaultProps.onCancelar).not.toHaveBeenCalled();
  });

  it('variant=danger aplica classe vermelha no botão de confirmação', () => {
    render(<ConfirmModal {...defaultProps} variant="danger" />);
    const confirmar = screen.getByRole('button', { name: /confirmar/i });
    expect(confirmar.className).toMatch(/red/);
  });

  it('Escape chama onCancelar', () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onCancelar).toHaveBeenCalledTimes(1);
  });

  it('labels personalizados são exibidos', () => {
    render(<ConfirmModal {...defaultProps} labelConfirmar="Eliminar" labelCancelar="Voltar" />);
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /voltar/i })).toBeTruthy();
  });
});

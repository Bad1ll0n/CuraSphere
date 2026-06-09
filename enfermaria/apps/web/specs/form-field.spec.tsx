import React from 'react';
import { render, screen } from '@testing-library/react';
import { FormField } from '../src/components/form-field';

describe('FormField', () => {
  it('renderiza label e children', () => {
    render(
      <FormField label="Nome do doente">
        <input placeholder="insira o nome" />
      </FormField>
    );
    expect(screen.getByText('Nome do doente')).toBeTruthy();
    expect(screen.getByPlaceholderText('insira o nome')).toBeTruthy();
  });

  it('exibe mensagem de erro quando error prop é fornecida', () => {
    render(
      <FormField label="Email" error="Email inválido">
        <input type="email" />
      </FormField>
    );
    const erro = screen.getByRole('alert');
    expect(erro.textContent).toBe('Email inválido');
  });

  it('não exibe mensagem de erro quando error prop está ausente', () => {
    render(
      <FormField label="Campo">
        <input />
      </FormField>
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('required prop mostra asterisco vermelho', () => {
    render(
      <FormField label="Campo obrigatório" required>
        <input />
      </FormField>
    );
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('sem required não mostra asterisco', () => {
    render(
      <FormField label="Campo opcional">
        <input />
      </FormField>
    );
    expect(screen.queryByText('*')).toBeNull();
  });

  it('className é aplicado ao wrapper externo', () => {
    const { container } = render(
      <FormField label="Campo" className="minha-classe">
        <input />
      </FormField>
    );
    expect(container.firstChild as HTMLElement).toHaveProperty('className', expect.stringContaining('minha-classe'));
  });
});

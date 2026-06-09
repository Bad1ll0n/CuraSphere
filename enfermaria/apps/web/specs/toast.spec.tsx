import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../src/components/toast';

function TestConsumer({ type }: { type: 'success' | 'error' | 'warning' | 'info' }) {
  const toast = useToast();
  return <button onClick={() => toast[type]('Mensagem de teste')}>Disparar</button>;
}

function renderWithProvider(type: 'success' | 'error' | 'warning' | 'info') {
  return render(
    <ToastProvider>
      <TestConsumer type={type} />
    </ToastProvider>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('toast de sucesso exibe mensagem com ícone ✓', () => {
    renderWithProvider('success');
    fireEvent.click(screen.getByRole('button', { name: /disparar/i }));
    expect(screen.getByRole('alert').textContent).toContain('Mensagem de teste');
    expect(screen.getByRole('alert').textContent).toContain('✓');
  });

  it('toast de erro exibe mensagem com ícone ✕', () => {
    renderWithProvider('error');
    fireEvent.click(screen.getByRole('button', { name: /disparar/i }));
    expect(screen.getByRole('alert').textContent).toContain('✕');
  });

  it('botão × fecha o toast imediatamente', () => {
    renderWithProvider('info');
    fireEvent.click(screen.getByRole('button', { name: /disparar/i }));
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('toast é auto-dispensado após 4 segundos', () => {
    renderWithProvider('warning');
    fireEvent.click(screen.getByRole('button', { name: /disparar/i }));
    expect(screen.getByRole('alert')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(4100); });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('useToast lança erro fora do ToastProvider', () => {
    function BadConsumer() {
      useToast();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow('useToast must be used inside <ToastProvider>');
  });
});

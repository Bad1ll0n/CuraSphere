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

const disparar = () => fireEvent.click(screen.getByRole('button', { name: /disparar/i }));

describe('Toast', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('toast de sucesso exibe a mensagem numa região polida com ícone ✓', () => {
    renderWithProvider('success');
    disparar();
    const regiao = screen.getByRole('status');
    expect(regiao.textContent).toContain('Mensagem de teste');
    expect(regiao.textContent).toContain('✓');
    expect(regiao.getAttribute('aria-live')).toBe('polite');
  });

  it('toast de erro vai para a região assertiva com ícone ✕', () => {
    renderWithProvider('error');
    disparar();
    const regiao = screen.getByRole('alert');
    expect(regiao.textContent).toContain('✕');
    expect(regiao.getAttribute('aria-live')).toBe('assertive');
  });

  it('as duas regiões live existem antes de haver mensagens', () => {
    render(<ToastProvider><span /></ToastProvider>);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('botão de fechar dispensa o toast imediatamente', () => {
    renderWithProvider('info');
    disparar();
    expect(screen.getByRole('status').textContent).toContain('Mensagem de teste');
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    expect(screen.getByRole('status').textContent).not.toContain('Mensagem de teste');
  });

  // WCAG 2.2.1 — um erro clínico não pode desaparecer sozinho.
  it('erro NÃO é auto-dispensado, por muito tempo que passe', () => {
    renderWithProvider('error');
    disparar();
    act(() => { jest.advanceTimersByTime(120000); });
    expect(screen.getByRole('alert').textContent).toContain('Mensagem de teste');
  });

  it('aviso dura 12 s (e não 4)', () => {
    renderWithProvider('warning');
    disparar();
    act(() => { jest.advanceTimersByTime(4100); });
    expect(screen.getByRole('alert').textContent).toContain('Mensagem de teste');
    act(() => { jest.advanceTimersByTime(8100); });
    expect(screen.getByRole('alert').textContent).not.toContain('Mensagem de teste');
  });

  it('sucesso dura 6 s', () => {
    renderWithProvider('success');
    disparar();
    act(() => { jest.advanceTimersByTime(4100); });
    expect(screen.getByRole('status').textContent).toContain('Mensagem de teste');
    act(() => { jest.advanceTimersByTime(2100); });
    expect(screen.getByRole('status').textContent).not.toContain('Mensagem de teste');
  });

  it('a contagem pára enquanto o rato estiver sobre a pilha e retoma ao sair', () => {
    renderWithProvider('success');
    disparar();
    const pilha = screen.getByRole('status').parentElement as HTMLElement;
    fireEvent.mouseEnter(pilha);
    act(() => { jest.advanceTimersByTime(30000); });
    expect(screen.getByRole('status').textContent).toContain('Mensagem de teste');
    fireEvent.mouseLeave(pilha);
    act(() => { jest.advanceTimersByTime(6100); });
    expect(screen.getByRole('status').textContent).not.toContain('Mensagem de teste');
  });

  it('a duração é ajustável por chamada', () => {
    function Consumidor() {
      const toast = useToast();
      return <button onClick={() => toast.success('Persistente', { duracao: null })}>Disparar</button>;
    }
    render(<ToastProvider><Consumidor /></ToastProvider>);
    disparar();
    act(() => { jest.advanceTimersByTime(60000); });
    expect(screen.getByRole('status').textContent).toContain('Persistente');
  });

  it('useToast lança erro fora do ToastProvider', () => {
    function BadConsumer() {
      useToast();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow('useToast must be used inside <ToastProvider>');
  });
});

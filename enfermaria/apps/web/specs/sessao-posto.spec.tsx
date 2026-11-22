import React from 'react';
import { act, render, screen } from '@testing-library/react';
import pt from '../src/messages/pt.json';
import { AVISO_ANTES_MS, INATIVIDADE_MS, useSessaoPosto } from '../src/components/sessao-posto';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (chave: string) => (pt as any)[ns]?.[chave] ?? `${ns}.${chave}`,
}));
jest.mock('@/lib/api', () => ({ post: jest.fn() }));

function Sonda({ onExpirar }: { onExpirar: () => void }) {
  const s = useSessaoPosto('u1', onExpirar);
  return <div><span data-testid="aviso">{s.avisoSegundos ?? 'sem'}</span><span data-testid="bloq">{String(s.bloqueado)}</span>
    <button onClick={s.continuar}>continuar</button><button onClick={s.bloquear}>bloquear</button></div>;
}

describe('sessão do posto (UX-21)', () => {
  beforeEach(() => { jest.useFakeTimers(); sessionStorage.clear(); });
  afterEach(() => jest.useRealTimers());

  it('avisa 2 min antes e termina aos 15 min', () => {
    const expirar = jest.fn();
    render(<Sonda onExpirar={expirar} />);
    act(() => { jest.advanceTimersByTime(INATIVIDADE_MS - AVISO_ANTES_MS - 2000); });
    expect(screen.getByTestId('aviso').textContent).toBe('sem');
    act(() => { jest.advanceTimersByTime(3000); });
    expect(Number(screen.getByTestId('aviso').textContent)).toBeLessThanOrEqual(120);
    act(() => { jest.advanceTimersByTime(AVISO_ANTES_MS); });
    expect(expirar).toHaveBeenCalledTimes(1);
  });

  it('"Continuar" adia; mexer no rato com o aviso aberto não adia (é preciso escolher)', () => {
    const expirar = jest.fn();
    render(<Sonda onExpirar={expirar} />);
    act(() => { jest.advanceTimersByTime(INATIVIDADE_MS - 60_000); });
    act(() => { window.dispatchEvent(new Event('mousemove')); jest.advanceTimersByTime(1000); });
    expect(screen.getByTestId('aviso').textContent).not.toBe('sem');
    act(() => { screen.getByText('continuar').click(); jest.advanceTimersByTime(1000); });
    expect(screen.getByTestId('aviso').textContent).toBe('sem');
    act(() => { jest.advanceTimersByTime(INATIVIDADE_MS - AVISO_ANTES_MS - 5000); });
    expect(expirar).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+L bloqueia, e o bloqueio sobrevive a um reload do separador', () => {
    const { unmount } = render(<Sonda onExpirar={jest.fn()} />);
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'L', ctrlKey: true, shiftKey: true })); });
    expect(screen.getByTestId('bloq').textContent).toBe('true');
    unmount();
    render(<Sonda onExpirar={jest.fn()} />);
    expect(screen.getByTestId('bloq').textContent).toBe('true');
  });
});

describe('ecrã bloqueado (UX-21)', () => {
  const { EcraBloqueado } = jest.requireActual('../src/components/sessao-posto');
  const api = jest.requireMock('@/lib/api') as { post: jest.Mock };
  const { fireEvent, waitFor } = jest.requireActual('@testing-library/react');

  async function tentar(resposta: unknown) {
    api.post.mockReset().mockRejectedValueOnce(resposta);
    const ok = jest.fn(); const trocar = jest.fn();
    render(<EcraBloqueado nome="Ana" alertasCriticos={1} onDesbloqueado={ok} onTrocarUtilizador={trocar} />);
    fireEvent.change(document.querySelector('input[type=password]')!, { target: { value: 'x' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/desbloquear', { password: 'x' }));
    return { ok, trocar };
  }

  it('password errada: fica bloqueado e diz porquê', async () => {
    const { trocar } = await tentar({ response: { status: 401, data: { message: 'Credenciais inválidas' } } });
    await waitFor(() => expect(screen.getByText(pt.session.wrongPassword)).toBeTruthy());
    expect(trocar).not.toHaveBeenCalled();
  });

  it('conta bloqueada ou sessão expirada: volta ao login', async () => {
    const { trocar } = await tentar({ response: { status: 401, data: { message: 'Unauthorized' } } });
    await waitFor(() => expect(trocar).toHaveBeenCalled());
  });

  it('mostra os alertas críticos por responder', () => {
    render(<EcraBloqueado nome="Ana" alertasCriticos={2} onDesbloqueado={jest.fn()} onTrocarUtilizador={jest.fn()} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

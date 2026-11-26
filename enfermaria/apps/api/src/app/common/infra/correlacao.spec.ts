import { gerarIdCorrelacao, idCorrelacaoDoPedido, idCorrelacaoValido } from './correlacao';

// OPS-07 — id de correlação validado e devolvido.
describe('id de correlação', () => {
  const res = () => { const h: Record<string, string> = {}; return { headersSent: false, setHeader: (k: string, v: string) => { h[k] = v; }, h } as any; };

  it('aceita o id do proxy/cliente com formato seguro e devolve-o', () => {
    const r = res();
    expect(gerarIdCorrelacao({ headers: { 'x-correlation-id': 'abc-123_x.Y' } } as any, r)).toBe('abc-123_x.Y');
    expect(r.h['X-Correlation-Id']).toBe('abc-123_x.Y');
  });

  it('ignora ids longos ou com caracteres perigosos e gera um novo', () => {
    for (const mau of ['a'.repeat(65), 'x\ninjecção', '<script>', 'a b']) {
      const r = res();
      const id = gerarIdCorrelacao({ headers: { 'x-correlation-id': mau } } as any, r);
      expect(id).not.toBe(mau);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(r.h['X-Correlation-Id']).toBe(id);
    }
  });

  it('o contexto usa o id atribuído pelo pino-http, nunca o cabeçalho cru', () => {
    expect(idCorrelacaoDoPedido({ id: 'id-pino', headers: { 'x-correlation-id': 'outro' } } as any)).toBe('id-pino');
    expect(idCorrelacaoDoPedido({ headers: { 'x-correlation-id': 'x'.repeat(200) } } as any)).toBeNull();
    expect(idCorrelacaoValido(undefined)).toBeNull();
  });
});

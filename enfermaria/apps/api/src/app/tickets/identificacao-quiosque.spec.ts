import { doenteIdentificado, emitirIdentificacao, mesmaDataNascimento, nomeAbreviado, CABECALHO_IDENTIFICACAO } from './identificacao-quiosque';

describe('identificação no quiosque (SEC-12)', () => {
  const antes = process.env['QUIOSQUE_SECRET'];
  beforeAll(() => { process.env['QUIOSQUE_SECRET'] = 'segredo-de-quiosque-para-testes-0123456789'; });
  afterAll(() => { process.env['QUIOSQUE_SECRET'] = antes; });

  const req = (token: string | undefined, servicoId = 'consulta') => ({ headers: token ? { [CABECALHO_IDENTIFICACAO]: token } : {}, quiosque: { servicoId } });

  it('a identificação devolve o doente no mesmo quiosque', () => {
    const t = emitirIdentificacao('d1', 'consulta');
    expect(doenteIdentificado(req(t))).toBe('d1');
  });

  it('sem identificação, de outro quiosque, ou forjada → 401', () => {
    const t = emitirIdentificacao('d1', 'consulta');
    expect(() => doenteIdentificado(req(undefined))).toThrow(/Identifique-se/);
    expect(() => doenteIdentificado(req(t, 'urgencia'))).toThrow(/expirou/);
    expect(() => doenteIdentificado(req(t.slice(0, -2) + 'xx'))).toThrow(/expirou/);
  });

  it('expira ao fim de 5 minutos', () => {
    jest.useFakeTimers({ now: new Date('2026-11-20T10:00:00Z') });
    const t = emitirIdentificacao('d1', 'consulta');
    jest.setSystemTime(new Date('2026-11-20T10:05:30Z'));
    expect(() => doenteIdentificado(req(t))).toThrow(/expirou/);
    jest.useRealTimers();
  });

  it('nome abreviado: primeiro nome e inicial do último', () => {
    expect(nomeAbreviado('Maria Fernanda Costa Silva')).toBe('Maria S.');
    expect(nomeAbreviado('Zulmira')).toBe('Zulmira');
    expect(nomeAbreviado('  ')).toBe('');
  });

  it('data de nascimento: dia civil exato e formato AAAA-MM-DD', () => {
    const d = new Date('1960-01-31T00:00:00.000Z');
    expect(mesmaDataNascimento(d, '1960-01-31')).toBe(true);
    expect(mesmaDataNascimento(d, '1960-01-30')).toBe(false);
    expect(mesmaDataNascimento(d, '31/01/1960')).toBe(false);
    expect(mesmaDataNascimento(null, '1960-01-31')).toBe(false);
  });
});

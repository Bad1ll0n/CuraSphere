/**
 * PERF-10 — o Sentry do cliente só é descarregado com DSN, e os erros anteriores ao arranque
 * não se perdem. A limpeza RGPD (sem corpo nem cookies do pedido) continua no beforeSend.
 */
const sentry = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
};
jest.mock('@sentry/nextjs', () => sentry);

function carregarModulo(dsn?: string) {
  if (dsn) process.env['NEXT_PUBLIC_SENTRY_DSN'] = dsn;
  else delete process.env['NEXT_PUBLIC_SENTRY_DSN'];
  let mod!: typeof import('./monitorizacao');
  jest.isolateModules(() => { mod = require('./monitorizacao'); });
  return mod;
}

describe('monitorização no cliente (PERF-10)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sem DSN não carrega o SDK nem guarda nada', async () => {
    const m = carregarModulo();
    m.reportarErro(new Error('x'));
    expect(await m.carregarMonitorizacao()).toBeNull();
    expect(sentry.init).not.toHaveBeenCalled();
    expect(m._paraTestes.pendentes).toHaveLength(0);
  });

  it('com DSN, um erro antes do arranque fica em fila e é enviado depois do init', async () => {
    const m = carregarModulo('https://chave@exemplo.invalid/1');
    const erro = new Error('falhou antes do SDK');
    m.reportarErro(erro, { ecra: 'mar' });
    await m.carregarMonitorizacao();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(erro, { extra: { ecra: 'mar' } });
    m.reportarMensagem('socket em baixo', 'warning');
    expect(sentry.captureMessage).toHaveBeenCalledWith('socket em baixo', 'warning');
  });

  it('o beforeSend retira o corpo e os cookies do pedido (RGPD)', async () => {
    const m = carregarModulo('https://chave@exemplo.invalid/1');
    await m.carregarMonitorizacao();
    const { beforeSend } = sentry.init.mock.calls[0][0];
    const ev = beforeSend({ request: { url: '/x', data: '{"nome":"Doente"}', cookies: { s: '1' } } });
    expect(ev.request).toEqual({ url: '/x' });
  });
});

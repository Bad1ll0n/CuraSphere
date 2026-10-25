import { construirCsp, construirPermissionsPolicy } from './csp';

function directiva(csp: string, nome: string): string[] {
  const parte = csp.split('; ').find((p) => p.startsWith(`${nome} `));
  return parte ? parte.split(' ').slice(1) : [];
}

describe('Content-Security-Policy', () => {
  const producao = construirCsp({
    nonce: 'abc123',
    apiUrl: 'https://curasphere.hospital.pt/api',
    jitsiServer: 'https://jitsi.hospital.pt',
    storageOrigin: 'https://s3.hospital.pt',
    sentryDsn: 'https://chave@o1.ingest.sentry.io/42',
  });

  it('só executa scripts com o nonce do pedido — nada de inline arbitrário nem eval', () => {
    const script = directiva(producao, 'script-src');
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it('só em desenvolvimento admite eval (React Refresh)', () => {
    expect(directiva(construirCsp({ nonce: 'n', dev: true }), 'script-src')).toContain("'unsafe-eval'");
  });

  it('as ligações vão só para a API, o seu WebSocket, o armazenamento e o Sentry — não para qualquer https:', () => {
    const connect = directiva(producao, 'connect-src');
    expect(connect).toEqual([
      "'self'",
      'https://curasphere.hospital.pt',
      'wss://curasphere.hospital.pt',
      'https://s3.hospital.pt',
      'https://o1.ingest.sentry.io',
    ]);
    expect(connect).not.toContain('https:');
  });

  it('documentos e fotografias assinadas abrem-se a partir do armazenamento; a teleconsulta a partir do Jitsi', () => {
    expect(directiva(producao, 'img-src')).toContain('https://s3.hospital.pt');
    expect(directiva(producao, 'frame-src')).toEqual(["'self'", 'blob:', 'https://s3.hospital.pt', 'https://jitsi.hospital.pt']);
  });

  it('não pode ser embebida noutro site, nem trocar a base, nem submeter formulários para fora', () => {
    expect(directiva(producao, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directiva(producao, 'object-src')).toEqual(["'none'"]);
    expect(directiva(producao, 'base-uri')).toEqual(["'self'"]);
    expect(directiva(producao, 'form-action')).toEqual(["'self'"]);
  });

  it('o relatório vai para a API com o caminho completo, sem barra dupla', () => {
    expect(directiva(construirCsp({ nonce: 'n', apiUrl: 'https://h.pt/api/' }), 'report-uri')).toEqual([
      'https://h.pt/api/v1/csp-report',
    ]);
  });

  it('sem configuração não gera origens vazias nem valores "null"', () => {
    const csp = construirCsp({ nonce: 'n', storageOrigin: 'não é um url' });
    expect(csp).not.toMatch(/null|undefined|false/);
    expect(directiva(csp, 'frame-src')).toContain('https://meet.jit.si');
  });
});

describe('Permissions-Policy', () => {
  it('delega câmara e microfone ao Jitsi — `camera=()` deixava a teleconsulta sem imagem', () => {
    const politica = construirPermissionsPolicy('https://jitsi.hospital.pt/');
    expect(politica).toContain('camera=(self "https://jitsi.hospital.pt")');
    expect(politica).toContain('microphone=(self "https://jitsi.hospital.pt")');
    expect(politica).toContain('payment=()');
  });
});

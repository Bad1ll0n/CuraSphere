import { dirname } from 'path';
import { Writable } from 'stream';
import { CAMINHOS_REDACT, CENSURA } from './redact-log';

// O pino vem por nestjs-pino → pino-http (o pnpm não o expõe à api diretamente).
const pinoHttp = require.resolve('pino-http', { paths: [dirname(require.resolve('nestjs-pino'))] });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pino = require(require.resolve('pino', { paths: [dirname(pinoHttp)] }));

function logar(obj: object): string {
  let saida = '';
  const destino = new Writable({ write(chunk, _enc, cb) { saida += chunk.toString(); cb(); } });
  const logger = pino({ redact: { paths: CAMINHOS_REDACT, censor: CENSURA } }, destino);
  logger.info(obj, 'teste');
  return saida;
}

describe('SEC-21 — redact dos logs', () => {
  it('o pino aceita todos os caminhos (um caminho inválido rebentava no arranque)', () => {
    expect(() => logar({})).not.toThrow();
  });

  it('segredos e PII em qualquer profundidade', () => {
    const linha = logar({
      senha: 'S3gredo-do-portal',
      dto: { novaPassword: 'outra-password-x', totpCode: '123456' },
      doente: { nome: 'Maria Antónia', contacto: { telefone: '912345678', email: 'maria@exemplo.pt' } },
      lista: [{ nome: 'João', nif: '123456789' }],
      clinico: { episodio: { registo: { diagnosticoPrincipal: 'Neoplasia' } } },
    });
    for (const s of ['S3gredo-do-portal', 'outra-password-x', '123456', 'Maria Antónia', '912345678', 'maria@exemplo.pt', 'João', '123456789', 'Neoplasia']) {
      expect(linha).not.toContain(s);
    }
    expect(linha).toContain(CENSURA);
  });

  it('o pedido agarrado a um erro do axios não vai para o log', () => {
    const linha = logar({ err: { message: 'falhou', config: { data: '{"nome":"Rui"}', headers: { Authorization: 'Bearer abc.def' } } } });
    expect(linha).not.toContain('Rui');
    expect(linha).not.toContain('abc.def');
    expect(linha).toContain('falhou');
  });

  it('o que não é sensível continua legível', () => {
    expect(logar({ estado: 'internado', statusCode: 201 })).toContain('internado');
  });
});

import * as jwt from 'jsonwebtoken';
import { ThrottlerPorUtilizadorGuard } from './throttler-por-utilizador.guard';
import { JWT_ISSUER } from '../auth/token-audiences';

/**
 * PERF-02: o limite global contava por IP — atrás do nginx, um único balde para o hospital.
 * Estes testes fixam a chave: utilizador de uma sessão VERIFICADA, ou o IP.
 */
describe('ThrottlerPorUtilizadorGuard — chave do limite', () => {
  const SEGREDO = 'segredo-de-teste-com-pelo-menos-32-caracteres!!';
  let anterior: string | undefined;
  const guard = Object.create(ThrottlerPorUtilizadorGuard.prototype) as any;
  const chave = (req: Record<string, any>) => guard.getTracker(req);

  beforeAll(() => {
    anterior = process.env['JWT_SECRET'];
    process.env['JWT_SECRET'] = SEGREDO;
  });
  afterAll(() => {
    if (anterior === undefined) delete process.env['JWT_SECRET'];
    else process.env['JWT_SECRET'] = anterior;
  });

  const token = (opcoes: jwt.SignOptions = {}, segredo = SEGREDO) =>
    jwt.sign({ sub: 'u-123', tipo: 'pessoal' }, segredo, {
      algorithm: 'HS256', issuer: JWT_ISSUER, audience: 'curasphere', expiresIn: '5m', ...opcoes,
    });

  it('com sessão válida no cookie, conta por utilizador — dois postos atrás do mesmo NAT não partilham balde', async () => {
    await expect(chave({ ip: '10.0.0.5', cookies: { access_token: token() } })).resolves.toBe('u:u-123');
  });

  it('aceita também o token no cabeçalho Authorization', async () => {
    await expect(chave({ ip: '10.0.0.5', headers: { authorization: `Bearer ${token()}` } })).resolves.toBe('u:u-123');
  });

  it('sem sessão (login, MFA), conta por IP', async () => {
    await expect(chave({ ip: '10.0.0.5', cookies: {} })).resolves.toBe('ip:10.0.0.5');
  });

  it('um token com assinatura inválida NÃO escolhe o balde (cai no IP) — nunca se confia num JWT só descodificado', async () => {
    const forjado = token({}, 'outro-segredo-qualquer-com-32-caracteres!!');
    await expect(chave({ ip: '10.0.0.5', cookies: { access_token: forjado } })).resolves.toBe('ip:10.0.0.5');
  });

  it('um token de outra audiência (ex.: MFA ou portal) conta por IP', async () => {
    await expect(chave({ ip: '10.0.0.5', cookies: { access_token: token({ audience: 'curasphere-mfa' }) } })).resolves.toBe('ip:10.0.0.5');
  });
});

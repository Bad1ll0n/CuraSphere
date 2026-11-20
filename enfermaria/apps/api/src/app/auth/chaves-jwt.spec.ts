import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';
import { chavesJwt, opcoesModuloJwt } from './chaves-jwt';

const par = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    privada: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publica: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
};

describe('chaves dos tokens (SEC-11)', () => {
  const a = par();

  it('com o par, assina ES256 com a privada e verifica com a pública', () => {
    const svc = new JwtService(opcoesModuloJwt('15m', 'curasphere', { JWT_PRIVATE_KEY: a.privada, JWT_PUBLIC_KEY: a.publica } as any));
    const token = svc.sign({ sub: 'u1', tipo: 'pessoal' });
    expect(jwt.decode(token, { complete: true })?.header.alg).toBe('ES256');
    expect(svc.verify(token).sub).toBe('u1');
    // Quem só tem a pública (o web) verifica…
    expect((jwt.verify(token, a.publica, { algorithms: ['ES256'] }) as any).sub).toBe('u1');
    // …mas um token HS256 assinado com a "pública" como segredo (algorithm confusion) é recusado.
    const forjado = jwt.sign({ sub: 'atacante' }, 'qualquer-segredo-com-32-caracteres-xx', { algorithm: 'HS256', issuer: 'curasphere-api', audience: 'curasphere' });
    expect(() => svc.verify(forjado)).toThrow();
  });

  it('aceita o PEM numa linha com \\n escritos', () => {
    const c = chavesJwt({ JWT_PRIVATE_KEY: a.privada.replace(/\n/g, '\\n'), JWT_PUBLIC_KEY: a.publica.replace(/\n/g, '\\n') } as any);
    expect(c.algoritmo).toBe('ES256');
    expect(c.verificacao).toContain('-----BEGIN PUBLIC KEY-----\n');
  });

  it('recusa chaves que não formam par, só uma das duas, ou de outro tipo', () => {
    const b = par();
    expect(() => chavesJwt({ JWT_PRIVATE_KEY: a.privada, JWT_PUBLIC_KEY: b.publica } as any)).toThrow(/não corresponde/);
    expect(() => chavesJwt({ JWT_PRIVATE_KEY: a.privada } as any)).toThrow(/juntas/);
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    expect(() => chavesJwt({
      JWT_PRIVATE_KEY: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      JWT_PUBLIC_KEY: rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    } as any)).toThrow(/P-256/);
    expect(() => chavesJwt({ JWT_PRIVATE_KEY: 'lixo', JWT_PUBLIC_KEY: 'lixo' } as any)).toThrow(/PEM/);
  });

  it('em produção o par é obrigatório; fora dela cai no HS256 com JWT_SECRET', () => {
    expect(() => chavesJwt({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) } as any)).toThrow(/ES256/);
    expect(chavesJwt({ NODE_ENV: 'test', JWT_SECRET: 'segredo' } as any)).toEqual({ algoritmo: 'HS256', assinatura: 'segredo', verificacao: 'segredo' });
  });
});

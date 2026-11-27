import * as jwt from 'jsonwebtoken';
import { ServiceUnavailableException } from '@nestjs/common';
import { configJitsi, dadosSala, novaSalaJitsi, problemaConfigJitsi, tokenJitsi } from './jitsi';

// SEC-16 — teleconsulta em servidor próprio, sala imprevisível e entrada por token.
describe('SEC-16 — Jitsi', () => {
  const VARS = ['NODE_ENV', 'JITSI_SERVER', 'JITSI_APP_ID', 'JITSI_APP_SECRET'] as const;
  const antes: Record<string, string | undefined> = {};
  beforeEach(() => { for (const v of VARS) antes[v] = process.env[v]; });
  afterEach(() => { for (const v of VARS) { if (antes[v] === undefined) delete process.env[v]; else process.env[v] = antes[v]; } });
  const env = (o: Partial<Record<(typeof VARS)[number], string>>) => {
    for (const v of VARS) delete process.env[v];
    Object.assign(process.env, o);
  };

  it('sala de 128 bits, diferente a cada chamada', () => {
    const a = novaSalaJitsi(), b = novaSalaJitsi();
    expect(a).toMatch(/^cs-[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  it('produção sem JITSI_SERVER: teleconsulta indisponível, mas o arranque não falha', () => {
    env({ NODE_ENV: 'production' });
    expect(problemaConfigJitsi()).toBeNull();
    expect(() => configJitsi()).toThrow(ServiceUnavailableException);
  });

  it('produção com meet.jit.si: o arranque falha', () => {
    env({ NODE_ENV: 'production', JITSI_SERVER: 'https://meet.jit.si', JITSI_APP_ID: 'a', JITSI_APP_SECRET: 's' });
    expect(problemaConfigJitsi()).toMatch(/público/);
    expect(() => configJitsi()).toThrow(ServiceUnavailableException);
  });

  it('produção sem segredo de token: o arranque falha', () => {
    env({ NODE_ENV: 'production', JITSI_SERVER: 'https://video.hospital.pt' });
    expect(problemaConfigJitsi()).toMatch(/JITSI_APP_SECRET/);
  });

  it('desenvolvimento sem configuração usa o Jitsi público e não emite token', () => {
    env({ NODE_ENV: 'development' });
    const cfg = configJitsi();
    expect(cfg.servidor).toBe('https://meet.jit.si');
    expect(tokenJitsi(cfg, 'cs-x', { nome: 'M', moderador: true })).toBeUndefined();
  });

  it('servidor próprio sem credenciais fora de produção: salas sem token; URL inválido é um problema', () => {
    env({ NODE_ENV: 'development', JITSI_SERVER: 'https://video.hospital.test///' });
    const cfg = configJitsi();
    expect(cfg).toEqual({ servidor: 'https://video.hospital.test', host: 'video.hospital.test', appId: undefined, segredo: undefined });
    expect(tokenJitsi(cfg, 'cs-x', { nome: 'M', moderador: false })).toBeUndefined();
    expect(dadosSala(cfg, 'cs-x', undefined)).toEqual({ videoRoomId: 'cs-x', servidor: 'https://video.hospital.test', jwt: null, roomUrl: 'https://video.hospital.test/cs-x' });
    env({ NODE_ENV: 'production', JITSI_SERVER: 'não é um url', JITSI_APP_ID: 'a', JITSI_APP_SECRET: 's' });
    expect(problemaConfigJitsi()).toMatch(/inválido/);
  });

  it('token limitado à sala, com moderador só para o médico', () => {
    env({ NODE_ENV: 'production', JITSI_SERVER: 'https://video.hospital.pt/', JITSI_APP_ID: 'curasphere', JITSI_APP_SECRET: 'segredo-de-teste' });
    expect(problemaConfigJitsi()).toBeNull();
    const cfg = configJitsi();
    const sala = novaSalaJitsi();
    const tMed = tokenJitsi(cfg, sala, { nome: 'Dr. X', moderador: true, id: 'u1' })!;
    const tDoe = tokenJitsi(cfg, sala, { nome: 'Doente', moderador: false })!;
    const pMed = jwt.verify(tMed, 'segredo-de-teste', { audience: 'jitsi', issuer: 'curasphere' }) as any;
    const pDoe = jwt.verify(tDoe, 'segredo-de-teste') as any;
    expect(pMed).toMatchObject({ room: sala, sub: 'video.hospital.pt', moderator: true });
    expect(pDoe.moderator).toBe(false);
    expect(pDoe.context.user.moderator).toBe('false');
    expect(pMed.exp - pMed.iat).toBeLessThanOrEqual(3 * 3600);
    const d = dadosSala(cfg, sala, tDoe);
    expect(d.roomUrl).toBe(`https://video.hospital.pt/${sala}?jwt=${encodeURIComponent(tDoe)}`);
  });
});

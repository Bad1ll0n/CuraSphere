import { BadRequestException } from '@nestjs/common';
import {
  eRegistoDiferido, exigirCertosSeDiferido, janelaRegistoDiferidoMs, minutosAoRegistoMaisProximo, resolverHoraDoAto,
} from './hora-do-ato';

/** PROD-16 — a hora do ato declarada à cabeceira (offline) e a janela em que é aceite. */
describe('hora do ato', () => {
  const agora = new Date('2026-11-18T07:45:00Z');
  const h = (horas: number) => new Date(agora.getTime() - horas * 3_600_000);
  afterEach(() => delete process.env['JANELA_REGISTO_DIFERIDO_H']);

  it('sem hora declarada, é agora', () => {
    expect(resolverHoraDoAto(undefined, agora)).toBe(agora);
    expect(resolverHoraDoAto('', agora)).toBe(agora);
  });

  it('a morfina das 03:10 sincronizada às 07:45 fica às 03:10', () => {
    const ato = new Date('2026-11-18T03:10:00Z');
    expect(resolverHoraDoAto(ato.toISOString(), agora)).toEqual(ato);
    expect(eRegistoDiferido(ato, agora)).toBe(true);
  });

  it('aceita até 5 min no futuro (relógio) e recusa além disso', () => {
    expect(() => resolverHoraDoAto(new Date(agora.getTime() + 4 * 60_000), agora)).not.toThrow();
    expect(() => resolverHoraDoAto(new Date(agora.getTime() + 6 * 60_000), agora)).toThrow(/futuro/);
  });

  it('recusa mais antigo do que a janela (12 h por omissão, configurável)', () => {
    expect(() => resolverHoraDoAto(h(11.9), agora)).not.toThrow();
    expect(() => resolverHoraDoAto(h(12.1), agora)).toThrow(/nota retrospetiva/);
    process.env['JANELA_REGISTO_DIFERIDO_H'] = '2';
    expect(janelaRegistoDiferidoMs()).toBe(2 * 3_600_000);
    expect(() => resolverHoraDoAto(h(3), agora)).toThrow(BadRequestException);
    process.env['JANELA_REGISTO_DIFERIDO_H'] = 'lixo';
    expect(janelaRegistoDiferidoMs()).toBe(12 * 3_600_000);
  });

  it('recusa uma hora inválida', () => {
    expect(() => resolverHoraDoAto('ontem à noite', agora)).toThrow(/inválida/);
  });

  it('só é "diferido" com mais de 10 min de atraso', () => {
    expect(eRegistoDiferido(new Date(agora.getTime() - 9 * 60_000), agora)).toBe(false);
    expect(eRegistoDiferido(new Date(agora.getTime() - 11 * 60_000), agora)).toBe(true);
  });

  it('registo diferido sem 5 certos confirmados é recusado; com evidência ou a tempo, passa', () => {
    expect(() => exigirCertosSeDiferido(h(2), false, agora)).toThrow(/REGISTO_DIFERIDO/);
    expect(() => exigirCertosSeDiferido(h(2), true, agora)).not.toThrow();
    expect(() => exigirCertosSeDiferido(agora, false, agora)).not.toThrow();
  });

  it('distância à administração mais próxima — antes ou depois do ato', () => {
    expect(minutosAoRegistoMaisProximo([], agora)).toBeNull();
    expect(minutosAoRegistoMaisProximo([h(6), h(-0.5)], h(1))).toBe(90);
  });
});

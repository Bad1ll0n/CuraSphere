import { OrigensPermitidas, erroOrigens } from './origens-permitidas';

describe('SEC-22 — origens permitidas (HL7)', () => {
  const o = new OrigensPermitidas('10.20.0.5, 10.30.0.0/16, fd00::/8');

  it('IP exato, rede CIDR e IPv6', () => {
    expect(o.permite('10.20.0.5')).toBe(true);
    expect(o.permite('10.30.200.1')).toBe(true);
    expect(o.permite('fd00::1')).toBe(true);
  });

  it('recusa o que está fora', () => {
    expect(o.permite('10.20.0.6')).toBe(false);
    expect(o.permite('192.168.1.1')).toBe(false);
    expect(o.permite('2001:db8::1')).toBe(false);
    expect(o.permite(undefined)).toBe(false);
    expect(o.permite('não-é-ip')).toBe(false);
  });

  it('IPv4 mapeado em IPv6 conta como o IPv4 (como chega do Express)', () => {
    expect(o.permite('::ffff:10.20.0.5')).toBe(true);
    expect(o.permite('::ffff:192.168.1.1')).toBe(false);
  });

  it('lista vazia fica marcada; formatos inválidos são erro', () => {
    expect(new OrigensPermitidas('').vazia).toBe(true);
    expect(erroOrigens('10.0.0.0/33')).toMatch(/Prefixo/);
    expect(erroOrigens('hospital.local')).toMatch(/inválida/);
    expect(erroOrigens('10.0.0.1, ::1')).toBeNull();
  });
});

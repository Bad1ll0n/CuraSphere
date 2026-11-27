import { assertUrlDestinoPublico, exigirSemRedireccionamento, isPrivateOrReservedIp } from './ssrf-guard';
import { semDadosPessoais } from '../webhooks/webhooks.service';

/** SEC-10 — a guarda de SSRF decide pelos bits do endereço, não pela forma escrita. */
describe('guarda de SSRF', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '0:0:0:0:0:ffff:7f00:0001', '::7f00:1', '64:ff9b::a9fe:a9fe',
    '2002:7f00:1::', 'fe80::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1',
  ])('bloqueia %s', (ip) => expect(isPrivateOrReservedIp(ip)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:808:808', '2002:808:808::'])('permite %s', (ip) => expect(isPrivateOrReservedIp(ip)).toBe(false));

  it('o URL com IPv6 mapeado (que o parser converte para hexadecimal) é recusado', async () => {
    expect(new URL('http://[::ffff:127.0.0.1]/').hostname).toBe('[::ffff:7f00:1]');
    await expect(assertUrlDestinoPublico('http://[::ffff:127.0.0.1]:6379/')).rejects.toThrow(/interno/);
    await expect(assertUrlDestinoPublico('http://[::ffff:169.254.169.254]/latest/meta-data')).rejects.toThrow(/interno/);
    await expect(assertUrlDestinoPublico('http://2130706433/')).rejects.toThrow(/interno/); // 127.0.0.1 em decimal
  });

  it('um redireccionamento não é seguido', () => {
    expect(() => exigirSemRedireccionamento({ status: 302 })).toThrow(/redireccionamento/);
    expect(() => exigirSemRedireccionamento({ status: 0, type: 'opaqueredirect' })).toThrow();
    expect(() => exigirSemRedireccionamento({ status: 200 })).not.toThrow();
  });

  it('o webhook não leva dados pessoais do doente', () => {
    expect(semDadosPessoais({ doenteId: 'd1', nome: 'Maria', numeroSNS: '1', evento: 'x' })).toEqual({ doenteId: 'd1', evento: 'x' });
  });
});

import { RedisService } from './redis.service';

/** PERF-07 — o que vai para o Redis com PII vai cifrado; e um valor ilegível é um miss. */
describe('RedisService — cache cifrada', () => {
  const guardado = new Map<string, unknown>();
  const svc = Object.create(RedisService.prototype) as RedisService;
  (svc as any).get = async (k: string) => guardado.get(k) ?? null;
  (svc as any).set = async (k: string, v: unknown) => { guardado.set(k, v); };

  it('guarda cifrado (sem o nome em claro) e devolve o objeto', async () => {
    await svc.setCifrado('k', [{ nome: 'Zulmira Antunes', diagnostico: 'Pneumonia' }], 30);
    const bruto = String(guardado.get('k'));
    expect(bruto.startsWith('enc:')).toBe(true);
    expect(bruto).not.toContain('Zulmira');
    expect(await svc.getCifrado('k')).toEqual([{ nome: 'Zulmira Antunes', diagnostico: 'Pneumonia' }]);
  });

  it('ausente ou ilegível → null (miss), nunca uma exceção', async () => {
    expect(await svc.getCifrado('nao-existe')).toBeNull();
    guardado.set('lixo', 'enc:naoebase64valido');
    expect(await svc.getCifrado('lixo')).toBeNull();
  });
});

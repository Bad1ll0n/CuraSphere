import { ThrottlerRedisStorage } from './throttler-redis.storage';

/** ARQ-17/OPS-09 — a contagem é partilhada (Redis) e, sem Redis, cai para a contagem local. */
describe('ThrottlerRedisStorage', () => {
  const cliente = (eval_: jest.Mock, status = 'ready') => ({ status, eval: eval_, connect: jest.fn().mockResolvedValue(undefined), on: jest.fn(), quit: jest.fn().mockResolvedValue(undefined) }) as any;

  it('converte a resposta do script (ms) no registo do throttler (s)', async () => {
    const ev = jest.fn().mockResolvedValue([3, 59_500, -2]);
    const s = new ThrottlerRedisStorage(undefined, cliente(ev));
    expect(await s.increment('ip', 60_000, 5, 60_000, 'default')).toEqual({ totalHits: 3, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 });
    expect(ev).toHaveBeenCalledWith(expect.any(String), 2, 'throttle:default:ip', 'throttle:default:ip:bloqueado', 60_000, 5, 60_000);
  });

  it('acima do limite fica bloqueado durante blockDuration', async () => {
    const s = new ThrottlerRedisStorage(undefined, cliente(jest.fn().mockResolvedValue([6, 40_000, 600_000])));
    expect(await s.increment('ip', 60_000, 5, 600_000, 'default')).toMatchObject({ isBlocked: true, timeToBlockExpire: 600 });
  });

  it('se o Redis falhar, conta localmente (nunca fica sem limite)', async () => {
    const s = new ThrottlerRedisStorage(undefined, cliente(jest.fn().mockRejectedValue(new Error('down'))));
    let r;
    for (let i = 0; i < 3; i++) r = await s.increment('ip', 60_000, 2, 60_000, 'default');
    expect(r).toMatchObject({ totalHits: 3, isBlocked: true });
  });

  it('com o Redis ainda a ligar, conta localmente', async () => {
    const ev = jest.fn();
    const s = new ThrottlerRedisStorage(undefined, cliente(ev, 'connecting'));
    expect((await s.increment('ip', 60_000, 5, 0, 'default')).totalHits).toBe(1);
    expect(ev).not.toHaveBeenCalled();
  });
});

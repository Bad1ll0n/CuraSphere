import { ConflictException } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * O cenário que isto protege: a app móvel reenvia uma administração de medicação porque
 * a resposta do primeiro envio se perdeu. Sem memória no servidor, o medicamento fica
 * registado duas vezes.
 */
function contexto(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

function pedido(over: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    url: '/medicacao/registar',
    route: { path: '/medicacao/registar' },
    headers: { 'idempotency-key': 'chave-1' },
    user: { sub: 'enf-1' },
    ...over,
  };
}

class RedisFalso {
  guardado = new Map<string, unknown>();
  set = jest.fn(async (k: string, v: unknown) => {
    this.guardado.set(k, v);
  });
  get = jest.fn(async (k: string) => (this.guardado.has(k) ? this.guardado.get(k) : null));
  del = jest.fn(async (...ks: string[]) => {
    for (const k of ks) this.guardado.delete(k);
  });
  setIfNotExists = jest.fn(async (k: string, v: string, _ttl?: number) => {
    if (this.guardado.has(k)) return false;
    this.guardado.set(k, v);
    return true;
  });
}

describe('IdempotencyInterceptor', () => {
  let redis: RedisFalso;
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    redis = new RedisFalso();
    interceptor = new IdempotencyInterceptor(redis as any);
  });

  it('executa normalmente quando não há cabeçalho', async () => {
    const handler = { handle: jest.fn(() => of({ id: 'registo-1' })) };
    const req = pedido({ headers: {} });

    await firstValueFrom(interceptor.intercept(contexto(req), handler as any));

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(redis.setIfNotExists).not.toHaveBeenCalled();
  });

  it('não toca em pedidos de leitura', async () => {
    const handler = { handle: jest.fn(() => of([])) };
    const req = pedido({ method: 'GET' });

    await firstValueFrom(interceptor.intercept(contexto(req), handler as any));

    expect(redis.setIfNotExists).not.toHaveBeenCalled();
  });

  it('executa uma vez e devolve a resposta guardada no reenvio', async () => {
    const handler = { handle: jest.fn(() => of({ id: 'registo-1' })) };

    const primeira = await firstValueFrom(
      interceptor.intercept(contexto(pedido()), handler as any),
    );
    const segunda = await firstValueFrom(
      interceptor.intercept(contexto(pedido()), handler as any),
    );

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(primeira).toEqual({ id: 'registo-1' });
    expect(segunda).toEqual({ id: 'registo-1' });
  });

  it('recusa com 409 enquanto o pedido original ainda está a decorrer', async () => {
    // Reserva feita, resposta ainda não guardada — é o estado de dois reenvios em
    // paralelo. Executar o segundo criaria o registo duplicado que queremos evitar.
    const handler = { handle: jest.fn(() => of({ id: 'registo-1' })) };
    await redis.setIfNotExists(
      'idem:enf-1:POST:/medicacao/registar:chave-1',
      '__em_curso__',
      60,
    );

    await expect(
      firstValueFrom(interceptor.intercept(contexto(pedido()), handler as any)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('não memoriza um pedido que falhou — o cliente pode repetir com a mesma chave', async () => {
    const falha = { handle: jest.fn(() => throwError(() => new Error('rebentou'))) };

    await expect(
      firstValueFrom(interceptor.intercept(contexto(pedido()), falha as any)),
    ).rejects.toThrow('rebentou');

    expect(redis.del).toHaveBeenCalled();

    const sucesso = { handle: jest.fn(() => of({ id: 'registo-1' })) };
    const r = await firstValueFrom(interceptor.intercept(contexto(pedido()), sucesso as any));

    expect(sucesso.handle).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ id: 'registo-1' });
  });

  it('com o Redis em baixo, executa na mesma em vez de recusar', async () => {
    // A cadeia que isto quebra: `setIfNotExists` devolve `null` com o Redis em baixo →
    // o interceptor devolvia 409 → a fila offline da app classificava 409 como definitivo
    // → a administração de medicação era descartada para sempre, em silêncio. O Redis é
    // uma dependência declarada NÃO-crítica; não pode apagar registo clínico.
    redis.setIfNotExists.mockResolvedValueOnce(null as any);
    const handler = { handle: jest.fn(() => of({ id: 'registo-1' })) };

    const r = await firstValueFrom(
      interceptor.intercept(contexto(pedido()), handler as any),
    );

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ id: 'registo-1' });
  });

  it('a mesma chave de enfermeiros diferentes são operações diferentes', async () => {
    const handler = { handle: jest.fn(() => of({ id: 'registo' })) };

    await firstValueFrom(interceptor.intercept(contexto(pedido()), handler as any));
    await firstValueFrom(
      interceptor.intercept(contexto(pedido({ user: { sub: 'enf-2' } })), handler as any),
    );

    expect(handler.handle).toHaveBeenCalledTimes(2);
  });

  it('a mesma chave em rotas diferentes são operações diferentes', async () => {
    const handler = { handle: jest.fn(() => of({ id: 'registo' })) };

    await firstValueFrom(interceptor.intercept(contexto(pedido()), handler as any));
    await firstValueFrom(
      interceptor.intercept(
        contexto(pedido({ route: { path: '/sinais-vitais' } })),
        handler as any,
      ),
    );

    expect(handler.handle).toHaveBeenCalledTimes(2);
  });
});

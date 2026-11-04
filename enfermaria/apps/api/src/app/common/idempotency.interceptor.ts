import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../redis/redis.service';

/** Métodos que criam ou alteram estado. Um GET repetido nunca precisa disto. */
const METODOS_COM_ESTADO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Tempo durante o qual um reenvio é reconhecido. Cobre com folga uma fila offline. */
const TTL_SEGUNDOS = 24 * 60 * 60;

/** Marcador de pedido em curso, para o caso de dois reenvios chegarem ao mesmo tempo. */
const EM_CURSO = '__em_curso__';

interface RespostaGuardada {
  corpo: unknown;
}

/**
 * Idempotência por `Idempotency-Key` (MB-02).
 *
 * A app móvel enfileira actos clínicos feitos sem rede — administrações de medicação,
 * sinais vitais — e reenvia-os ao reconectar. O problema que isto resolve é o clássico
 * da entrega à-menos-uma-vez: se o pedido chega ao servidor mas a resposta se perde no
 * caminho de volta, o cliente não tem como distinguir isso de "não chegou", e reenvia.
 * Sem memória do lado do servidor, a administração fica registada duas vezes.
 *
 * O cliente manda a mesma chave em todas as retentativas da mesma operação. Aqui,
 * a primeira execução guarda a resposta; qualquer reenvio recebe a resposta guardada
 * sem voltar a executar nada.
 *
 * A chave é sempre qualificada pelo utilizador e pela rota: uma chave gerada no
 * dispositivo de um enfermeiro nunca pode colidir com a de outro, nem servir para
 * um endpoint diferente.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly redis: RedisService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();

    if (!METODOS_COM_ESTADO.has(req.method)) return next.handle();

    const chaveCliente: string | undefined =
      req.headers?.['idempotency-key'] ?? req.headers?.['Idempotency-Key'];

    // Sem cabeçalho, o comportamento é exactamente o de antes — isto não muda a
    // semântica de nenhum cliente que não peça idempotência.
    if (!chaveCliente || typeof chaveCliente !== 'string') return next.handle();

    const actor = req.user?.sub ?? req.user?.doenteId ?? 'anonimo';
    const chave = `idem:${actor}:${req.method}:${req.route?.path ?? req.url}:${chaveCliente}`;

    return from(this.redis.setIfNotExists(chave, EM_CURSO, TTL_SEGUNDOS)).pipe(
      switchMap((reservou) => {
        // Três respostas possíveis, e tratá-las como duas apagava registo clínico:
        //   true  → a chave é nova; executar.
        //   false → a chave já existe; é um reenvio.
        //   null  → o REDIS ESTÁ EM BAIXO e nada se sabe.
        //
        // O Redis é uma dependência declarada não-crítica (o health check devolve
        // `degraded`, não 503). Tratar `null` como reenvio devolvia 409, a fila offline
        // da app classificava 409 como definitivo e descartava a operação — uma
        // administração de medicação registada sem rede desaparecia porque uma
        // dependência não-crítica caiu.
        //
        // Sem Redis não há como impor idempotência. Entre um duplicado possível, que fica
        // visível no registo de auditoria, e uma perda garantida e silenciosa, escolhe-se
        // o duplicado: segue sem idempotência.
        if (reservou === null) {
          this.logger.warn(
            `Redis indisponível — pedido idempotente executado SEM protecção contra ` +
              `duplicação (${req.method} ${req.route?.path ?? req.url}).`,
          );
          return next.handle();
        }

        if (reservou) {
          // Primeira vez que esta chave aparece: executa e guarda o resultado.
          return next.handle().pipe(
            tap({
              next: (corpo) => {
                void this.redis.set(chave, { corpo } as RespostaGuardada, TTL_SEGUNDOS);
              },
              error: () => {
                // Um pedido falhado não deve ficar memorizado: o cliente tem de poder
                // tentar outra vez com a mesma chave.
                void this.redis.del(chave);
              },
            }),
          );
        }

        return from(this.redis.get<RespostaGuardada | string>(chave)).pipe(
          switchMap((guardado) => {
            if (guardado && typeof guardado === 'object' && 'corpo' in guardado) {
              return of(guardado.corpo);
            }
            // A chave existe mas ainda não tem resposta: o pedido original está a
            // decorrer neste momento. Devolver 409 é preferível a executar em paralelo
            // — o cliente reenvia daqui a pouco e recebe a resposta guardada.
            throw new ConflictException(
              'Pedido com a mesma Idempotency-Key ainda em processamento',
            );
          }),
        );
      }),
    );
  }
}

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { criarClienteComEncriptacao } from './encryption.middleware';
import { RequestContextService } from './request-context.service';

const SLOW_QUERY_MS = 500;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SlowQuery');
  private readonly encClient: any;

  constructor(private readonly reqCtx: RequestContextService) {
    const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    const adapter = new PrismaPg(pool);
    super({ adapter, log: [{ emit: 'event', level: 'query' }] });
    (this as any).$on('query', (e: { duration: number; query: string }) => {
      if (e.duration > SLOW_QUERY_MS) {
        this.logger.warn(`${e.duration}ms — ${e.query.slice(0, 200)}`);
      }
    });
    // `$extends` returns a new client rather than mutating `this` — reassigned
    // onto `this.doente`/`this.contacto` below (plain runtime property swap,
    // not a class member override, to sidestep TS's override-checking on
    // Prisma's heavily-generic base class type) so every existing
    // `this.prisma.doente...`/`.contacto...` call site elsewhere in the app
    // keeps working unchanged while getting encrypt/decrypt behavior.
    this.encClient = criarClienteComEncriptacao(this);
    (this as any).doente = this.encClient.doente;
    (this as any).contacto = this.encClient.contacto;
    // CRÍTICO (PII): o swap acima só encripta `this.doente.create()` DIRETO. Dentro de uma
    // transação interativa, `tx.doente` era o delegate CRU → nomes de doentes gravados EM CLARO
    // (ver doentes.service admitir/darAlta). Encaminhar `$transaction` para o cliente estendido
    // faz o `tx` da callback ser encriptado — fecha essa fuga e torna a auditoria por triggers
    // (que precisa de transações) segura para PII.
    const encTx = this.encClient.$transaction.bind(this.encClient);
    const reqCtxRef = this.reqCtx;
    // AUDITORIA: na forma de callback, injeta o contexto do pedido (quem/de-onde) como GUCs
    // transaction-local (SET LOCAL via set_config(...,true) → auto-reseta, seguro com pool).
    // Os triggers de auditoria leem estes GUCs para atribuir a escrita. As 36 ações compostas
    // (admitir, alta, prescrever, transfusão…) passam a ser atribuídas sem qualquer refactoring.
    (this as any).$transaction = function (arg: any, opts: any) {
      if (typeof arg === 'function') {
        return encTx(async (tx: any) => {
          const ctx = reqCtxRef.get();
          if (ctx?.userId) {
            await tx.$executeRawUnsafe(
              "SELECT set_config('curasphere.user_id',$1,true), set_config('curasphere.user_nome',$2,true), set_config('curasphere.user_role',$3,true), set_config('curasphere.ip',$4,true), set_config('curasphere.correlation',$5,true)",
              ctx.userId, ctx.nome ?? '', ctx.role ?? '', ctx.ip ?? '', ctx.correlationId ?? '',
            );
          }
          return arg(tx);
        }, opts);
      }
      return encTx(arg, opts); // forma de array — passa-se tal e qual
    };
  }

  /**
   * Escrita única atribuída: envolve uma operação de escrita numa transação que define o
   * contexto (quem/de-onde) para os triggers de auditoria. Usar em escritas fora de transação
   * que precisem de atribuição (as compostas já a têm via $transaction). `fn` recebe o `tx`.
   */
  escritaAuditada<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return (this as any).$transaction(fn);
  }

  /**
   * Eleição de líder para tarefas @Cron: com várias instâncias da API, sem isto cada tarefa
   * dispararia em TODAS (relatórios/lembretes/IA duplicados). Devolve `true` só a UMA instância por
   * disparo. O claim é atómico (advisory-lock transacional, como o checkpointer) + uma lease temporal
   * (`cron_locks`) que evita re-execução dentro do TTL, mesmo com as instâncias a disparar em
   * simultâneo. Uso: `if (!(await this.prisma.tryBecomeLeader('nome', ttlMs))) return;` no topo do cron.
   * `ttlMs` deve ser < intervalo do cron (barra o disparo simultâneo, liberta para o próximo).
   */
  async tryBecomeLeader(nome: string, ttlMs: number): Promise<boolean> {
    try {
      return await (this as any).$transaction(async (tx: any) => {
        const [{ locked }] = (await tx.$queryRawUnsafe(
          'SELECT pg_try_advisory_xact_lock(hashtext($1)::int8) AS locked', nome,
        )) as { locked: boolean }[];
        if (!locked) return false; // outra instância está a reclamar neste instante
        const rows = (await tx.$queryRawUnsafe(
          'SELECT "expiraEm" FROM cron_locks WHERE nome = $1', nome,
        )) as { expiraEm: Date }[];
        if (rows[0] && new Date(rows[0].expiraEm) > new Date()) return false; // já corrido no disparo
        await tx.$executeRawUnsafe(
          'INSERT INTO cron_locks (nome, "expiraEm") VALUES ($1, $2) ON CONFLICT (nome) DO UPDATE SET "expiraEm" = $2',
          nome, new Date(Date.now() + ttlMs),
        );
        return true;
      });
    } catch (e) {
      this.logger.warn(`tryBecomeLeader(${nome}) falhou: ${(e as Error)?.message ?? String(e)}`);
      return false; // sem BD → não é líder (não corre, em vez de correr em todas às cegas)
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  forTenant(tenantId: string) {
    return this.$extends({
      query: {
        utilizador: {
          async $allOperations({ args, query }: { args: any; query: (a: any) => Promise<any> }) {
            if (args.where) args.where.tenantId = tenantId;
            else args.where = { tenantId };
            return query(args);
          },
        },
        doente: {
          async $allOperations({ args, query }: { args: any; query: (a: any) => Promise<any> }) {
            if (args.where) args.where.tenantId = tenantId;
            else args.where = { tenantId };
            return query(args);
          },
        },
        cama: {
          async $allOperations({ args, query }: { args: any; query: (a: any) => Promise<any> }) {
            if (args.where) args.where.tenantId = tenantId;
            else args.where = { tenantId };
            return query(args);
          },
        },
        medicacao: {
          async $allOperations({ args, query }: { args: any; query: (a: any) => Promise<any> }) {
            if (args.where) args.where.tenantId = tenantId;
            else args.where = { tenantId };
            return query(args);
          },
        },
      },
    });
  }
}

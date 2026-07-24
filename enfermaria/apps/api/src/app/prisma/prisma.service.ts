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

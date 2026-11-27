import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { criarClienteComEncriptacao, delegatesDoCliente } from './encryption.middleware';
import { RequestContextService } from './request-context.service';
import { comRetentativas } from '../common/transacao';

const SLOW_QUERY_MS = 500;

/** Operações dos delegates que escrevem (ARQ-02: todas atribuídas ao utilizador do pedido). */
const OPERACOES_ESCRITA = new Set([
  'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn',
  'upsert', 'delete', 'deleteMany',
]);

/** GUCs transaction-local lidos pelos triggers de auditoria (`set_config(..., true)`). */
const SQL_CONTEXTO =
  "SELECT set_config('curasphere.user_id',$1,true), set_config('curasphere.user_nome',$2,true), " +
  "set_config('curasphere.user_role',$3,true), set_config('curasphere.ip',$4,true), set_config('curasphere.correlation',$5,true)";

/** Há autoria a registar: um utilizador, ou (portal do doente) só nome e papel — SEC-19. */
function comAutoria(ctx: { userId: string | null; nome: string | null } | undefined | null): boolean {
  return !!(ctx?.userId || ctx?.nome);
}

function valoresContexto(ctx: { userId: string | null; nome: string | null; role: string | null; ip: string | null; correlationId: string | null }) {
  return [ctx.userId ?? '', ctx.nome ?? '', ctx.role ?? '', ctx.ip ?? '', ctx.correlationId ?? ''];
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SlowQuery');
  private readonly encClient: any;

  constructor(private readonly reqCtx: RequestContextService) {
    // PERF-01: o `pg` ignora `connection_limit`/`pool_timeout` (eram do motor Rust antigo do
    // Prisma) — o pool real era de 10 e a espera por uma ligação livre era INFINITA. Agora:
    // tamanho configurável, falha rápida quando o pool está esgotado, e um tecto por query.
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: Number(process.env['DB_POOL_MAX'] ?? 20),
      connectionTimeoutMillis: Number(process.env['DB_POOL_TIMEOUT_MS'] ?? 10_000),
      idleTimeoutMillis: 30_000,
      statement_timeout: Number(process.env['DB_STATEMENT_TIMEOUT_MS'] ?? 15_000),
    });
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
    // ARQ-01/QA-03: aqui trocavam-se à mão `doente` e `contacto` — e `contacto` não existe.
    // `contactoEmergencia` e `ficheiroPessoalDoente` ficavam com o delegate cru e gravavam
    // telefones, moradas e emails EM CLARO. Agora trocam-se TODOS os delegates, gerados do
    // próprio cliente: os cifrados cifram, e todos decifram as relações que trazem PII.
    for (const delegate of delegatesDoCliente(this)) {
      if (this.encClient[delegate]) (this as any)[delegate] = this.encClient[delegate];
    }
    // CRÍTICO (PII): o swap acima só encripta `this.doente.create()` DIRETO. Dentro de uma
    // transação interativa, `tx.doente` era o delegate CRU → nomes de doentes gravados EM CLARO
    // (ver doentes.service admitir/darAlta). Encaminhar `$transaction` para o cliente estendido
    // faz o `tx` da callback ser encriptado — fecha essa fuga e torna a auditoria por triggers
    // (que precisa de transações) segura para PII.
    const encClient = this.encClient;
    const encTx = this.encClient.$transaction.bind(this.encClient);
    const reqCtxRef = this.reqCtx;
    // AUDITORIA: na forma de callback, injeta o contexto do pedido (quem/de-onde) como GUCs
    // transaction-local (SET LOCAL via set_config(...,true) → auto-reseta, seguro com pool).
    // Os triggers de auditoria leem estes GUCs para atribuir a escrita. As 36 ações compostas
    // (admitir, alta, prescrever, transfusão…) passam a ser atribuídas sem qualquer refactoring.
    (this as any).$transaction = function (arg: any, opts: any) {
      if (typeof arg === 'function') {
        const executar = () => encTx(async (tx: any) => {
          const ctx = reqCtxRef.get();
          if (ctx && comAutoria(ctx)) {
            await tx.$queryRawUnsafe(SQL_CONTEXTO, ...valoresContexto(ctx));
          }
          return arg(tx);
        }, opts);
        // F4: o Postgres aborta uma das transacções concorrentes com 40001 (P2034 no Prisma).
        // Não é um erro do pedido — é o preço do isolamento — e sem retentativa chegava ao
        // enfermeiro como um 500 opaco. Só a forma de callback se repete: um array de
        // PrismaPromise não se reexecuta.
        return opts?.isolationLevel === 'Serializable'
          ? comRetentativas(executar, { rotulo: 'transacção Serializable' })
          : executar();
      }
      // Forma de array: ARQ-02 — com utilizador no contexto, a primeira instrução do lote
      // define os GUCs (`set_config(..., true)` vale até ao fim da transacção), e as escritas
      // do lote ficam atribuídas. O resultado dessa instrução é retirado da resposta.
      const ctx = reqCtxRef.get();
      if (Array.isArray(arg) && ctx && comAutoria(ctx)) {
        const definir = encClient.$queryRawUnsafe(SQL_CONTEXTO, ...valoresContexto(ctx));
        return encTx([definir, ...arg], opts).then((r: unknown[]) => r.slice(1));
      }
      return encTx(arg, opts);
    };

    // ARQ-02 — escritas directas (fora de `$transaction`) também atribuídas.
    // Antes, só as escritas dentro de `$transaction` levavam o "quem" para os triggers de
    // auditoria: as ~300 escritas directas (`this.prisma.alergia.create(...)`, notas, exames,
    // eventos adversos…) ficavam registadas sem utilizador. Cada operação de escrita de cada
    // delegate passa a devolver um PrismaPromise que, ao ser executado sozinho, corre numa
    // transacção curta com o contexto; dentro de uma transacção em array (`requestTransaction`)
    // comporta-se como o original — aí o contexto já vem da instrução inicial do lote.
    const self = this as any;
    for (const nome of delegatesDoCliente(this)) {
      const delegate = self[nome];
      if (!delegate) continue;
      self[nome] = new Proxy(delegate, {
        get(alvo, prop, receptor) {
          const original = Reflect.get(alvo, prop, receptor);
          if (typeof prop !== 'string' || !OPERACOES_ESCRITA.has(prop) || typeof original !== 'function') return original;
          return (args: unknown) => {
            const promessa = original.call(alvo, args);
            if (!comAutoria(reqCtxRef.get())) return promessa; // sem pedido autenticado: igual
            const correr = () => self.$transaction((tx: any) => tx[nome][prop](args));
            return {
              then: (ok: any, falha: any) => correr().then(ok, falha),
              catch: (falha: any) => correr().catch(falha),
              finally: (fim: any) => correr().finally(fim),
              requestTransaction: (t: unknown) => promessa.requestTransaction(t),
              [Symbol.toStringTag]: 'PrismaPromise',
            };
          };
        },
      });
    }
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

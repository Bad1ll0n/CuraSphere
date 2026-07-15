import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { criarClienteComEncriptacao } from './encryption.middleware';

const SLOW_QUERY_MS = 500;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SlowQuery');
  private readonly encClient: any;

  constructor() {
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

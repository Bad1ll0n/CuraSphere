import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { aplicarEncriptacaoPrisma } from './encryption.middleware';

const SLOW_QUERY_MS = 500;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SlowQuery');

  constructor() {
    const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    const adapter = new PrismaPg(pool);
    super({ adapter, log: [{ emit: 'event', level: 'query' }] });
    (this as any).$on('query', (e: { duration: number; query: string }) => {
      if (e.duration > SLOW_QUERY_MS) {
        this.logger.warn(`${e.duration}ms — ${e.query.slice(0, 200)}`);
      }
    });
    aplicarEncriptacaoPrisma(this);
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

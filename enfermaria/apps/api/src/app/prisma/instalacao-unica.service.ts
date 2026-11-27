import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TENANT_UNICO } from './tenant-context.service';

/** Tabelas que ainda têm `tenantId` (herança de uma multi-tenancy que nunca ficou completa). */
const TABELAS_COM_TENANT = ['utilizadores', 'camas', 'doentes', 'medicacoes', 'bolsas_sangue', 'episodios_internamento'];

/**
 * ARQ-21 — uma instalação, um hospital.
 *
 * A multi-tenancy ficou a meio: `tenantId` em 6 tabelas, filtro em meia dúzia de serviços, e as
 * restantes ~150 tabelas (medicação, vitais, notas…) sem separação nenhuma. Dois hospitais na
 * mesma base de dados misturavam-se. O modelo real de instalação já é uma instância (e uma BD)
 * por hospital, por isso fica explícito e fechado:
 *  - o contexto do pedido e a sessão só aceitam o tenant desta instalação (`default`);
 *  - no arranque, se houver registos de outro tenant, a api recusa iniciar — em vez de servir
 *    dados de dois hospitais como se fossem um.
 */
@Injectable()
export class InstalacaoUnicaService implements OnModuleInit {
  private readonly logger = new Logger(InstalacaoUnicaService.name);
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const estranhos: string[] = [];
    for (const tabela of TABELAS_COM_TENANT) {
      try {
        const r = await this.prisma.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM "${tabela}" WHERE "tenantId" <> $1`, TENANT_UNICO,
        );
        if ((r[0]?.n ?? 0) > 0) estranhos.push(`${tabela}: ${r[0].n}`);
      } catch (e) {
        // Tabela/coluna inexistente numa BD antiga: não é dado de outro hospital.
        this.logger.warn(`Verificação de tenant em ${tabela} não correu: ${(e as Error).message}`);
      }
    }
    if (estranhos.length > 0) {
      throw new Error(
        `ARQ-21: esta instalação serve um único hospital (tenant "${TENANT_UNICO}"), mas há registos de outro tenant (${estranhos.join(', ')}). ` +
        'Separe-os numa instalação própria antes de arrancar.',
      );
    }
  }
}

export { TABELAS_COM_TENANT };

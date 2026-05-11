import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ti', 'qualidade', 'direcao')
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  async logs(
    @Query('utilizadorId') utilizadorId?: string,
    @Query('acao') acao?: string,
    @Query('entidadeTipo') entidadeTipo?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('page') page = '1',
  ) {
    const take = 20;
    const skip = (parseInt(page) - 1) * take;

    const where: Record<string, any> = {};
    if (utilizadorId) where['utilizadorId'] = utilizadorId;
    if (acao) where['acao'] = { contains: acao, mode: 'insensitive' };
    if (entidadeTipo) where['entidadeTipo'] = entidadeTipo;
    if (de || ate) {
      where['createdAt'] = {};
      if (de) where['createdAt']['gte'] = new Date(de);
      if (ate) where['createdAt']['lte'] = new Date(ate);
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { utilizador: { select: { id: true, nome: true, role: true } } },
      }),
    ]);

    return { total, pagina: parseInt(page), totalPaginas: Math.ceil(total / take), logs };
  }

  @Get('conformidade')
  async conformidade() {
    const trinta = new Date();
    trinta.setDate(trinta.getDate() - 30);

    const sete = new Date();
    sete.setDate(sete.getDate() - 7);

    const [acessosDoentes, acoesAltoRisco, utilizadoresUnicos, acessosPorDia] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entidadeTipo: 'Doente', createdAt: { gte: trinta } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { utilizador: { select: { id: true, nome: true, role: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: {
          acao: { in: ['DELETE Doente', 'PATCH Doente', 'DELETE Medicacao', 'DELETE Alta'] },
          createdAt: { gte: trinta },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { utilizador: { select: { id: true, nome: true, role: true } } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['utilizadorId'],
        where: { entidadeTipo: 'Doente', createdAt: { gte: trinta } },
        _count: { id: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['createdAt'],
        where: { entidadeTipo: 'Doente', createdAt: { gte: sete } },
        _count: { id: true },
      }),
    ]);

    const acessosPorDiaAgrupados: Record<string, number> = {};
    for (const r of acessosPorDia) {
      const dia = new Date(r.createdAt).toISOString().split('T')[0];
      acessosPorDiaAgrupados[dia] = (acessosPorDiaAgrupados[dia] ?? 0) + r._count.id;
    }

    return {
      acessosDoentes,
      acoesAltoRisco,
      totalUtilizadoresUnicos: utilizadoresUnicos.length,
      totalAcessos30dias: acessosDoentes.length,
      acessosPorDia: Object.entries(acessosPorDiaAgrupados)
        .map(([dia, total]) => ({ dia, total }))
        .sort((a, b) => a.dia.localeCompare(b.dia)),
    };
  }
}

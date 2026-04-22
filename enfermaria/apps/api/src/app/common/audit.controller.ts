import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ti', 'qualidade')
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  async logs(
    @Query('utilizadorId') utilizadorId?: string,
    @Query('acao') acao?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('page') page = '1',
  ) {

    const take = 20;
    const skip = (parseInt(page) - 1) * take;

    const where: Record<string, any> = {};
    if (utilizadorId) where['utilizadorId'] = utilizadorId;
    if (acao) where['acao'] = { contains: acao, mode: 'insensitive' };
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
}

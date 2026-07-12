import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsDateString, IsOptional, MaxLength } from 'class-validator';

export class CriarOutcomeDto {
  @IsString() doenteId: string;
  @IsString() tipo: string; // 'readmissao_30d' | 'obito_intra' | 'complicacao' | 'melhoria'
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsDateString() dataOcorrido: string;
  @IsOptional() @IsString() relacionadoAiDecisaoId?: string;
}

@Injectable()
export class OutcomesService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CriarOutcomeDto, userId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: dto.doenteId } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    return this.prisma.outcomeClinico.create({
      data: {
        doenteId: dto.doenteId,
        tipo: dto.tipo,
        descricao: dto.descricao,
        dataOcorrido: new Date(dto.dataOcorrido),
        relacionadoAiDecisaoId: dto.relacionadoAiDecisaoId ?? null,
        registadoPorId: userId,
      },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async listarPorDoente(doenteId: string) {
    return this.prisma.outcomeClinico.findMany({
      where: { doenteId },
      orderBy: { dataOcorrido: 'desc' },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async dashboard() {
    const agora = new Date();
    const inicio30d = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalOutcomes, readmissoes30d, porTipo, correlacaoIA] = await Promise.all([
      this.prisma.outcomeClinico.count(),

      this.prisma.outcomeClinico.count({
        where: { tipo: 'readmissao_30d', criadoEm: { gte: inicio30d } },
      }),

      this.prisma.outcomeClinico.groupBy({
        by: ['tipo'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      this.prisma.outcomeClinico.groupBy({
        by: ['relacionadoAiDecisaoId'],
        where: { relacionadoAiDecisaoId: { not: null } },
        _count: { id: true },
      }),
    ]);

    const altas30d = await this.prisma.sumarioAlta.count({
      where: { criadoEm: { gte: inicio30d } },
    }).catch(() => 0);

    const taxaReadmissao = altas30d > 0
      ? Math.round((readmissoes30d / altas30d) * 100 * 10) / 10
      : 0;

    const decisoesComOutcome = correlacaoIA.length;
    const decisoesAceites = await this.prisma.aiDecisao.count({
      where: { aceite: true, id: { in: correlacaoIA.map(c => c.relacionadoAiDecisaoId!).filter(Boolean) } },
    }).catch(() => 0);

    return {
      totalOutcomes,
      readmissoes30d,
      taxaReadmissao30d: taxaReadmissao,
      porTipo: porTipo.map(t => ({ tipo: t.tipo, total: t._count.id })),
      correlacaoIA: {
        outcomesComDecisaoIA: decisoesComOutcome,
        decisoesIAAceites: decisoesAceites,
      },
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EquipamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(search?: string, estado?: string) {
    return this.prisma.equipamento.findMany({
      where: {
        ...(estado ? { estado } : {}),
        ...(search ? { OR: [
          { nome: { contains: search, mode: 'insensitive' as any } },
          { localizacao: { contains: search, mode: 'insensitive' as any } },
          { numeroSerie: { contains: search, mode: 'insensitive' as any } },
        ] } : {}),
      },
      include: {
        manutencoes: {
          where: { estado: { in: ['pendente', 'em_curso'] } },
          select: { id: true, tipo: true, estado: true, prioridade: true, descricao: true },
          orderBy: { dataReporte: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ estado: 'asc' }, { nome: 'asc' }],
    });
  }

  async criar(dto: { nome: string; tipo: string; numeroSerie?: string; localizacao?: string; proximaManutencao?: string }) {
    return this.prisma.equipamento.create({
      data: {
        nome: dto.nome,
        tipo: dto.tipo,
        numeroSerie: dto.numeroSerie ?? null,
        localizacao: dto.localizacao ?? null,
        proximaManutencao: dto.proximaManutencao ? new Date(dto.proximaManutencao) : null,
      },
    });
  }

  async atualizar(id: string, dto: { nome?: string; tipo?: string; numeroSerie?: string; localizacao?: string; estado?: string; proximaManutencao?: string }) {
    const eq = await this.prisma.equipamento.findUnique({ where: { id }, select: { id: true } });
    if (!eq) throw new NotFoundException('Equipamento não encontrado');
    return this.prisma.equipamento.update({
      where: { id },
      data: {
        ...(dto.nome && { nome: dto.nome }),
        ...(dto.tipo && { tipo: dto.tipo }),
        ...(dto.numeroSerie !== undefined && { numeroSerie: dto.numeroSerie || null }),
        ...(dto.localizacao !== undefined && { localizacao: dto.localizacao || null }),
        ...(dto.estado && { estado: dto.estado }),
        ...(dto.proximaManutencao ? { proximaManutencao: new Date(dto.proximaManutencao) } : {}),
      },
    });
  }

  async listarManutencoes(equipamentoId?: string) {
    return this.prisma.manutencao.findMany({
      where: equipamentoId ? { equipamentoId } : {},
      include: {
        equipamento: { select: { id: true, nome: true, tipo: true, localizacao: true } },
        reportadoPor: { select: { nome: true, role: true } },
        tecnico: { select: { nome: true, role: true } },
      },
      orderBy: [{ estado: 'asc' }, { dataReporte: 'desc' }],
    });
  }

  async criarManutencao(
    equipamentoId: string,
    dto: { tipo: string; descricao: string; prioridade?: string; observacoes?: string },
    reportadoPorId: string,
  ) {
    const eq = await this.prisma.equipamento.findUnique({ where: { id: equipamentoId }, select: { id: true, estado: true } });
    if (!eq) throw new NotFoundException('Equipamento não encontrado');

    const manutencao = await this.prisma.manutencao.create({
      data: {
        equipamentoId,
        tipo: dto.tipo,
        descricao: dto.descricao,
        prioridade: dto.prioridade ?? 'normal',
        observacoes: dto.observacoes ?? null,
        reportadoPorId,
      },
      include: {
        equipamento: { select: { id: true, nome: true, tipo: true } },
        reportadoPor: { select: { nome: true, role: true } },
      },
    });

    // Se corretiva, marca o equipamento como em manutenção
    if (dto.tipo === 'corretiva' && eq.estado === 'operacional') {
      await this.prisma.equipamento.update({ where: { id: equipamentoId }, data: { estado: 'em_manutencao' } });
    }

    return manutencao;
  }

  async alertasManutencao() {
    const agora = new Date();
    const em30Dias = new Date(agora);
    em30Dias.setDate(em30Dias.getDate() + 30);
    return this.prisma.equipamento.findMany({
      where: {
        proximaManutencao: { lte: em30Dias },
        estado: { not: 'abatido' },
      },
      orderBy: { proximaManutencao: 'asc' },
    });
  }

  async atualizarManutencao(
    id: string,
    dto: { estado?: string; observacoes?: string; tecnicoId?: string },
  ) {
    const man = await this.prisma.manutencao.findUnique({
      where: { id },
      select: { id: true, equipamentoId: true, estado: true },
    });
    if (!man) throw new NotFoundException('Manutenção não encontrada');

    const atualizado = await this.prisma.manutencao.update({
      where: { id },
      data: {
        ...(dto.estado && { estado: dto.estado }),
        ...(dto.observacoes !== undefined && { observacoes: dto.observacoes }),
        ...(dto.tecnicoId && { tecnicoId: dto.tecnicoId }),
        ...(dto.estado === 'concluida' && { dataConclusao: new Date() }),
      },
      include: {
        equipamento: { select: { id: true, nome: true } },
      },
    });

    // Se concluída, liberta o equipamento
    if (dto.estado === 'concluida') {
      await this.prisma.equipamento.update({
        where: { id: man.equipamentoId },
        data: { estado: 'operacional', ultimaManutencao: new Date() },
      });
    }

    return atualizado;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IacsService {
  constructor(private readonly prisma: PrismaService) {}

  async registarCultura(dto: {
    doenteId: string; dataColheita: string; tipoAmostra: string;
    agente?: string; antibiograma?: object; resultado?: string;
    servico?: string; observacoes?: string;
  }, userId: string) {
    return this.prisma.culturaMicrobiologica.create({
      data: {
        doenteId: dto.doenteId,
        dataColheita: new Date(dto.dataColheita),
        tipoAmostra: dto.tipoAmostra,
        agente: dto.agente ?? null,
        antibiograma: dto.antibiograma ?? undefined,
        resultado: (dto.resultado ?? 'pendente') as any,
        servico: dto.servico ?? null,
        observacoes: dto.observacoes ?? null,
        registadoPorId: userId,
      },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  async listarCulturas(params: { doenteId?: string; agente?: string; resultado?: string }) {
    const where: any = {};
    if (params.doenteId) where.doenteId = params.doenteId;
    if (params.agente) where.agente = { contains: params.agente, mode: 'insensitive' };
    if (params.resultado) where.resultado = params.resultado;
    return this.prisma.culturaMicrobiologica.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  async atualizarCultura(id: string, dto: { agente?: string; antibiograma?: object; resultado?: string; observacoes?: string }) {
    const existe = await this.prisma.culturaMicrobiologica.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException(`Cultura (ID ${id}) não encontrada`);
    return this.prisma.culturaMicrobiologica.update({
      where: { id },
      data: {
        agente: dto.agente !== undefined ? dto.agente : undefined,
        antibiograma: dto.antibiograma !== undefined ? (dto.antibiograma as any) : undefined,
        resultado: dto.resultado !== undefined ? (dto.resultado as any) : undefined,
        observacoes: dto.observacoes !== undefined ? dto.observacoes : undefined,
      },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  async registarSurto(dto: {
    agente: string; servico: string; dataInicio: string;
    numCasos?: number; medidas?: object; observacoes?: string;
  }, userId: string) {
    return this.prisma.surtoIACS.create({
      data: {
        agente: dto.agente,
        servico: dto.servico,
        dataInicio: new Date(dto.dataInicio),
        numCasos: dto.numCasos ?? 1,
        medidas: dto.medidas ?? undefined,
        observacoes: dto.observacoes ?? null,
        registadoPorId: userId,
      },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async listarSurtos(params: { estado?: string }) {
    const where: any = {};
    if (params.estado) where.estado = params.estado;
    return this.prisma.surtoIACS.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async atualizarSurto(id: string, dto: { estado?: string; numCasos?: number; dataFim?: string; medidas?: object; observacoes?: string }) {
    const existe = await this.prisma.surtoIACS.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException(`Surto (ID ${id}) não encontrado`);
    return this.prisma.surtoIACS.update({
      where: { id },
      data: {
        estado: dto.estado !== undefined ? (dto.estado as any) : undefined,
        numCasos: dto.numCasos !== undefined ? dto.numCasos : undefined,
        dataFim: dto.dataFim !== undefined ? new Date(dto.dataFim) : undefined,
        medidas: dto.medidas !== undefined ? (dto.medidas as any) : undefined,
        observacoes: dto.observacoes !== undefined ? dto.observacoes : undefined,
      },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async dashboard() {
    const [isolados, culturasPositivas, surtosActivos, culturasPendentes] = await Promise.all([
      this.prisma.doente.count({ where: { emIsolamento: true, ativo: true } }),
      this.prisma.culturaMicrobiologica.count({ where: { resultado: 'positivo' } }),
      this.prisma.surtoIACS.findMany({
        where: { estado: 'activo' },
        orderBy: { dataInicio: 'desc' },
        include: { registadoPor: { select: { id: true, nome: true } } },
      }),
      this.prisma.culturaMicrobiologica.count({ where: { resultado: 'pendente' } }),
    ]);

    const ultimasCulturasPositivas = await this.prisma.culturaMicrobiologica.findMany({
      where: { resultado: 'positivo' },
      orderBy: { criadoEm: 'desc' },
      take: 5,
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true } },
      },
    });

    return { isolados, culturasPositivas, culturasPendentes, surtosActivos, ultimasCulturasPositivas };
  }
}

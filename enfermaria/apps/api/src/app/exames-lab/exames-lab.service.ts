import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';
import { CriarResultadoDto } from './dto/criar-resultado.dto';

@Injectable()
export class ExamesLabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  async listarPorDoente(doenteId: string, painel?: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    return this.prisma.resultadoAnalise.findMany({
      where: { doenteId, ...(painel ? { painel } : {}) },
      orderBy: { registadoEm: 'desc' },
      take: 100,
      include: {
        registadoPor: { select: { nome: true, role: true } },
      },
    });
  }

  async criar(dto: CriarResultadoDto, registadoPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: dto.doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    const alterado = dto.alterado ?? (
      dto.refMin != null && dto.refMax != null
        ? dto.valor < dto.refMin || dto.valor > dto.refMax
        : false
    );

    const resultado = await this.prisma.resultadoAnalise.create({
      data: {
        doenteId: dto.doenteId,
        parametro: dto.parametro,
        valor: dto.valor,
        unidade: dto.unidade,
        refMin: dto.refMin,
        refMax: dto.refMax,
        alterado,
        critico: dto.critico ?? false,
        painel: dto.painel,
        observacoes: dto.observacoes,
        registadoPorId,
      },
      include: {
        registadoPor: { select: { nome: true, role: true } },
      },
    });

    if (resultado.critico) {
      this.gateway.server?.to(`doente:${dto.doenteId}`).emit('resultado-critico', {
        parametro: resultado.parametro,
        valor: resultado.valor,
        unidade: resultado.unidade,
        critico: true,
      });
    }

    return resultado;
  }

  async criarLote(resultados: CriarResultadoDto[], registadoPorId: string) {
    return Promise.all(resultados.map(r => this.criar(r, registadoPorId)));
  }

  async obterResumo(doenteId: string) {
    const todos = await this.prisma.resultadoAnalise.findMany({
      where: { doenteId },
      orderBy: { registadoEm: 'desc' },
      take: 200,
    });

    const paineis = [...new Set(todos.map(r => r.painel).filter(Boolean))];
    const criticos = todos.filter(r => r.critico);
    const alterados = todos.filter(r => r.alterado && !r.critico);

    return {
      totalResultados: todos.length,
      paineis,
      criticos: criticos.slice(0, 10),
      alterados: alterados.slice(0, 10),
      ultimoRegisto: todos[0]?.registadoEm ?? null,
    };
  }
}

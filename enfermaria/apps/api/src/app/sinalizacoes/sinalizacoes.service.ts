import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { EventsGateway } from '../gateway/events.gateway';
import { CriarSinalizacaoDto } from './dto/criar-sinalizacao.dto';

@Injectable()
export class SinalizacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
    private readonly gateway: EventsGateway,
  ) {}

  async criar(doenteId: string, dto: CriarSinalizacaoDto, criadaPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true, nome: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    const ativa = await this.prisma.sinalizacaoPreocupante.findFirst({
      where: { doenteId, resolvida: false },
      select: { id: true },
    });
    if (ativa) throw new BadRequestException('Já existe uma sinalização activa para este doente');

    const sinal = await this.prisma.sinalizacaoPreocupante.create({
      data: { doenteId, criadaPorId, motivo: dto.motivo, nivelUrgencia: dto.nivelUrgencia ?? 'normal' },
      include: { criadaPor: { select: { id: true, nome: true, role: true } } },
    });

    const urgencia = dto.nivelUrgencia === 'urgente' ? 'alta' : 'media';
    await this.alertas.criarAlerta(
      doenteId,
      'sinalizacao_preocupante',
      `⚠ Sinalizado como preocupante por ${sinal.criadaPor.nome}${dto.nivelUrgencia === 'urgente' ? ' [URGENTE]' : ''}: ${dto.motivo}`,
    ).catch(() => null);

    this.gateway.server?.to(`doente:${doenteId}`).emit('doente:estado', {
      doenteId,
      sinalizada: true,
      nivelUrgencia: sinal.nivelUrgencia,
    });

    return sinal;
  }

  async resolver(id: string, resolvidaPorId: string) {
    const sinal = await this.prisma.sinalizacaoPreocupante.findUnique({ where: { id } });
    if (!sinal) throw new NotFoundException('Sinalização não encontrada');
    if (sinal.resolvida) throw new BadRequestException('Sinalização já foi resolvida');

    const updated = await this.prisma.sinalizacaoPreocupante.update({
      where: { id },
      data: { resolvida: true, resolvidaEm: new Date(), resolvidaPorId },
    });

    this.gateway.server?.to(`doente:${sinal.doenteId}`).emit('doente:estado', {
      doenteId: sinal.doenteId,
      sinalizada: false,
    });

    return updated;
  }

  async listarAtivas(doenteId: string) {
    return this.prisma.sinalizacaoPreocupante.findMany({
      where: { doenteId, resolvida: false },
      orderBy: { criadaEm: 'desc' },
      include: {
        criadaPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async listarTodas(doenteId: string) {
    return this.prisma.sinalizacaoPreocupante.findMany({
      where: { doenteId },
      orderBy: { criadaEm: 'desc' },
      take: 20,
      include: {
        criadaPor: { select: { id: true, nome: true, role: true } },
        resolvidaPor: { select: { id: true, nome: true } },
      },
    });
  }
}

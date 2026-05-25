import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const ITENS_SEPSIS = [
  { descricao: 'Colher hemoculturas (2 sets, aeróbio e anaeróbio)', prazo: 30 },
  { descricao: 'Doseamento de lactato sérico', prazo: 30 },
  { descricao: 'Administrar antibiótico de largo espectro IV', prazo: 60 },
  { descricao: 'Bólus de cristalóides 30ml/kg IV se hipotensão ou lactato ≥4', prazo: 180 },
  { descricao: 'Monitorização de diurese (algaliação se necessário)', prazo: 60 },
];

const ITENS_AVC = [
  { descricao: 'TC-CE urgente sem contraste', prazo: 25 },
  { descricao: 'ECG 12 derivações', prazo: 15 },
  { descricao: 'Colheita de sangue: hemograma, coagulação, glicemia, ionograma', prazo: 20 },
  { descricao: 'Glicemia capilar imediata — corrigir se <60 ou >180 mg/dL', prazo: 10 },
  { descricao: 'Avaliar elegibilidade para trombólise (< 4.5h desde início sintomas)', prazo: 60 },
  { descricao: 'Monitorização: TA, SpO₂, temperatura, glicemia de 4/4h', prazo: 30 },
];

@Injectable()
export class ProtocolosService {
  private readonly logger = new Logger(ProtocolosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async ativarSeNaoAtivo(doenteId: string, tipo: 'sepsis' | 'avc' | 'iamcst', ativadoPorId?: string) {
    const existente = await this.prisma.protocoloClinico.findFirst({
      where: { doenteId, tipo, estadoGeral: 'ativo' },
    });
    if (existente) return existente;

    return this.criar(doenteId, tipo, ativadoPorId);
  }

  async criar(doenteId: string, tipo: string, ativadoPorId?: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    const itensTemplate = tipo === 'sepsis' ? ITENS_SEPSIS : tipo === 'avc' ? ITENS_AVC : [];

    const protocolo = await this.prisma.protocoloClinico.create({
      data: {
        doenteId,
        tipo,
        ativadoPorId,
        itens: { create: itensTemplate },
      },
      include: { itens: true },
    });

    this.notificacoes.enviarParaRole(
      'medico',
      `🔴 Protocolo ${tipo.toUpperCase()} activado`,
      `Protocolo clínico ${tipo.toUpperCase()} activado para ${doente.nome}. ${itensTemplate.length} acções pendentes.`,
      { protocoloId: protocolo.id, doenteId },
    ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    return protocolo;
  }

  async listarPorDoente(doenteId: string) {
    return this.prisma.protocoloClinico.findMany({
      where: { doenteId },
      orderBy: { criadoEm: 'desc' },
      include: {
        itens: {
          include: { concluidoPor: { select: { id: true, nome: true } } },
          orderBy: { prazo: 'asc' },
        },
        ativadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async concluirItem(itemId: string, utilizadorId: string) {
    const item = await this.prisma.itemProtocolo.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Item (ID ${itemId}) não encontrado`);
    if (item.concluido) throw new BadRequestException('Item já concluído');

    return this.prisma.itemProtocolo.update({
      where: { id: itemId },
      data: { concluido: true, concluidoEm: new Date(), concluidoPorId: utilizadorId },
      include: { concluidoPor: { select: { id: true, nome: true } } },
    });
  }

  async cancelar(protocoloId: string) {
    const p = await this.prisma.protocoloClinico.findUnique({ where: { id: protocoloId } });
    if (!p) throw new NotFoundException(`Protocolo (ID ${protocoloId}) não encontrado`);

    return this.prisma.protocoloClinico.update({
      where: { id: protocoloId },
      data: { estadoGeral: 'cancelado' },
    });
  }

  async concluir(protocoloId: string) {
    const p = await this.prisma.protocoloClinico.findUnique({ where: { id: protocoloId } });
    if (!p) throw new NotFoundException(`Protocolo (ID ${protocoloId}) não encontrado`);

    return this.prisma.protocoloClinico.update({
      where: { id: protocoloId },
      data: { estadoGeral: 'concluido' },
    });
  }
}

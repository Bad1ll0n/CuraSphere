import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlocoService {
  constructor(private readonly prisma: PrismaService) {}

  async agendar(dto: {
    doenteId: string; designacao: string; dataHora: string; duracaoPrevista: number;
    sala: string; cirurgiaoId: string; anestesistaId?: string; equipa?: any;
    notasPreOperatorio?: string;
  }) {
    return this.prisma.cirurgiaProgramada.create({
      data: {
        doenteId: dto.doenteId,
        designacao: dto.designacao,
        dataHora: new Date(dto.dataHora),
        duracaoPrevista: dto.duracaoPrevista,
        sala: dto.sala,
        cirurgiaoId: dto.cirurgiaoId,
        anestesistaId: dto.anestesistaId ?? null,
        equipa: dto.equipa ?? undefined,
        notasPreOperatorio: dto.notasPreOperatorio ?? null,
      },
      include: this.includeRelations(),
    });
  }

  async agenda(data?: string, sala?: string) {
    const where: any = {};
    if (data) {
      const d = new Date(data);
      const fim = new Date(d); fim.setDate(fim.getDate() + 1);
      where.dataHora = { gte: d, lt: fim };
    }
    if (sala) where.sala = sala;
    return this.prisma.cirurgiaProgramada.findMany({
      where,
      orderBy: { dataHora: 'asc' },
      include: this.includeRelations(),
    });
  }

  async detalhe(id: string) {
    const c = await this.prisma.cirurgiaProgramada.findUnique({ where: { id }, include: this.includeRelations() });
    if (!c) throw new NotFoundException('Cirurgia não encontrada');
    return c;
  }

  async atualizarEstado(id: string, estado: string) {
    await this.detalhe(id);
    return this.prisma.cirurgiaProgramada.update({ where: { id }, data: { estado: estado as any } });
  }

  async registarNotasPos(id: string, dto: { notasPosOperatorio: string; complicacoes?: string }, userId: string) {
    await this.detalhe(id);
    const cirurgia = await this.prisma.cirurgiaProgramada.update({
      where: { id },
      data: { notasPosOperatorio: dto.notasPosOperatorio, complicacoes: dto.complicacoes ?? null, estado: 'concluida' },
      include: this.includeRelations(),
    });

    // Auto-faturação
    if (cirurgia.doenteId) {
      const jaExiste = await this.prisma.episodioFaturacao.findFirst({ where: { doenteId: cirurgia.doenteId, notas: `cirurgia:${id}` } });
      if (!jaExiste) {
        const episodio = await this.prisma.episodioFaturacao.create({
          data: { doenteId: cirurgia.doenteId, estado: 'pendente', totalBase: 0, totalCobrado: 0, notas: `cirurgia:${id}`, criadoPorId: userId },
        });
        const ato = await this.prisma.atoClinico.findFirst({ where: { categoria: 'procedimento', ativo: true } });
        if (ato) {
          await this.prisma.itemFatura.create({ data: { episodioFaturacaoId: episodio.id, descricao: ato.descricao, categoria: ato.categoria, quantidade: 1, precoUnitario: ato.precoBase, total: ato.precoBase } });
          await this.prisma.episodioFaturacao.update({ where: { id: episodio.id }, data: { totalBase: ato.precoBase, totalCobrado: ato.precoBase } });
        }
      }
    }

    return cirurgia;
  }

  async obterChecklist(cirurgiaId: string) {
    await this.detalhe(cirurgiaId);
    const checklist = await this.prisma.checklistCirurgia.findUnique({
      where: { cirurgiaId },
      include: {
        signInPor: { select: { id: true, nome: true } },
        timeOutPor: { select: { id: true, nome: true } },
        signOutPor: { select: { id: true, nome: true } },
      },
    });
    return checklist ?? { cirurgiaId, signInEm: null, timeOutEm: null, signOutEm: null };
  }

  async completarFase(cirurgiaId: string, fase: 'signIn' | 'timeOut' | 'signOut', utilizadorId: string, dados: any) {
    await this.detalhe(cirurgiaId);
    const agora = new Date();
    const upsertData: any = {};
    if (fase === 'signIn') {
      upsertData.signInEm = agora;
      upsertData.signInPorId = utilizadorId;
      upsertData.signInDados = dados;
    } else if (fase === 'timeOut') {
      upsertData.timeOutEm = agora;
      upsertData.timeOutPorId = utilizadorId;
      upsertData.timeOutDados = dados;
    } else {
      upsertData.signOutEm = agora;
      upsertData.signOutPorId = utilizadorId;
      upsertData.signOutDados = dados;
    }
    return this.prisma.checklistCirurgia.upsert({
      where: { cirurgiaId },
      create: { cirurgiaId, ...upsertData },
      update: upsertData,
      include: {
        signInPor: { select: { id: true, nome: true } },
        timeOutPor: { select: { id: true, nome: true } },
        signOutPor: { select: { id: true, nome: true } },
      },
    });
  }

  private includeRelations() {
    return {
      doente: { select: { id: true, nome: true, numeroProcesso: true } },
      cirurgiao: { select: { id: true, nome: true, role: true } },
      anestesista: { select: { id: true, nome: true, role: true } },
      checklist: { select: { signInEm: true, timeOutEm: true, signOutEm: true } },
    };
  }
}

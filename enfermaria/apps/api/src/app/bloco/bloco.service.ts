import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class BlocoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

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

  async agendaMes(mes: number, ano: number) {
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim    = new Date(Date.UTC(ano, mes, 1));
    const cirurgias = await this.prisma.cirurgiaProgramada.findMany({
      where: { dataHora: { gte: inicio, lt: fim } },
      orderBy: { dataHora: 'asc' },
      select: {
        id: true, designacao: true, dataHora: true,
        duracaoPrevista: true, sala: true, estado: true,
        doente: { select: { id: true, nome: true } },
        cirurgiao: { select: { id: true, nome: true } },
      },
    });
    const porDia: Record<string, typeof cirurgias> = {};
    for (const c of cirurgias) {
      const dia = new Date(c.dataHora).toISOString().split('T')[0];
      if (!porDia[dia]) porDia[dia] = [];
      porDia[dia].push(c);
    }
    return Object.entries(porDia)
      .map(([dia, lista]) => ({ dia, total: lista.length, cirurgias: lista }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
  }

  async detalhe(id: string) {
    const c = await this.prisma.cirurgiaProgramada.findUnique({ where: { id }, include: this.includeRelations() });
    if (!c) throw new NotFoundException(`Cirurgia (ID ${id}) não encontrada`);
    return c;
  }

  async atualizarEstado(id: string, estado: string) {
    await this.detalhe(id);
    const atualizado = await this.prisma.cirurgiaProgramada.update({
      where: { id },
      data: { estado: estado as any },
      include: this.includeRelations(),
    });
    this.gateway.emitirBlocoUpdate({ cirurgiaId: id, estado, sala: atualizado.sala });
    return atualizado;
  }

  async registarNotasPos(id: string, dto: { notasPosOperatorio: string; complicacoes?: string }, userId: string) {
    await this.detalhe(id);
    const cirurgia = await this.prisma.cirurgiaProgramada.update({
      where: { id },
      data: { notasPosOperatorio: dto.notasPosOperatorio, complicacoes: dto.complicacoes ?? null, estado: 'concluida' },
      include: this.includeRelations(),
    });

    // Auto-faturação (transaccional: episodio + item + totais são atómicos)
    if (cirurgia.doenteId) {
      const jaExiste = await this.prisma.episodioFaturacao.findFirst({ where: { doenteId: cirurgia.doenteId, notas: `cirurgia:${id}` } });
      if (!jaExiste) {
        await this.prisma.$transaction(async (tx) => {
          const episodio = await tx.episodioFaturacao.create({
            data: { doenteId: cirurgia.doenteId, estado: 'pendente', totalBase: 0, totalCobrado: 0, notas: `cirurgia:${id}`, criadoPorId: userId },
          });
          const ato = await tx.atoClinico.findFirst({ where: { categoria: 'procedimento', ativo: true } });
          if (ato) {
            await tx.itemFatura.create({ data: { episodioFaturacaoId: episodio.id, descricao: ato.descricao, categoria: ato.categoria, quantidade: 1, precoUnitario: ato.precoBase, total: ato.precoBase } });
            await tx.episodioFaturacao.update({ where: { id: episodio.id }, data: { totalBase: ato.precoBase, totalCobrado: ato.precoBase } });
          }
        });
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

  async salaStatus() {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date(inicioHoje);
    fimHoje.setDate(fimHoje.getDate() + 1);

    // Cirurgias de hoje agendadas ou em curso
    const hoje = await this.prisma.cirurgiaProgramada.findMany({
      where: { dataHora: { gte: inicioHoje, lt: fimHoje }, estado: { in: ['agendada', 'em_curso'] } },
      orderBy: { dataHora: 'asc' },
      include: {
        doente: { select: { id: true, nome: true } },
        cirurgiao: { select: { id: true, nome: true } },
      },
    });

    // Cirurgias de dias anteriores ainda em_curso (cirurgia nocturna, por exemplo)
    const emCursoExtras = await this.prisma.cirurgiaProgramada.findMany({
      where: { estado: 'em_curso', dataHora: { lt: inicioHoje } },
      include: {
        doente: { select: { id: true, nome: true } },
        cirurgiao: { select: { id: true, nome: true } },
      },
    });

    // Todas as salas conhecidas (distintas de todas as cirurgias)
    const salasBD = await this.prisma.cirurgiaProgramada.findMany({
      select: { sala: true },
      distinct: ['sala'],
      orderBy: { sala: 'asc' },
    });

    const salas = salasBD.map(s => s.sala);
    const todas = [...emCursoExtras, ...hoje];

    return salas.map(sala => {
      const emCurso = todas.find(c => c.sala === sala && c.estado === 'em_curso') ?? null;
      const proxima = hoje.find(c => c.sala === sala && c.estado === 'agendada') ?? null;

      let status: 'livre' | 'em_uso' | 'proxima_cirurgia';
      if (emCurso) status = 'em_uso';
      else if (proxima) status = 'proxima_cirurgia';
      else status = 'livre';

      return { sala, status, emCurso, proxima };
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

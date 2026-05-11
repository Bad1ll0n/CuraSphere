import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EventsGateway } from '../gateway/events.gateway';

const ORDEM_TRIAGEM = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };

@Injectable()
export class UrgenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly gateway: EventsGateway,
  ) {}

  async registarEntrada(dto: {
    doenteId?: string; nomeTemporario?: string; queixaPrincipal: string;
    triagem: string; sinaisVitaisTriagem?: object; notas?: string;
  }, triadoPorId: string) {
    return this.prisma.episodioUrgencia.create({
      data: {
        doenteId: dto.doenteId ?? null,
        nomeTemporario: dto.nomeTemporario ?? null,
        queixaPrincipal: dto.queixaPrincipal,
        triagem: dto.triagem as any,
        estadoEpisodio: 'sala_espera',
        triadoPorId,
        sinaisVitaisTriagem: dto.sinaisVitaisTriagem ?? undefined,
        notas: dto.notas ?? null,
      },
      include: { doente: { select: { id: true, nome: true, dataNascimento: true } }, triadoPor: { select: { id: true, nome: true } } },
    });
  }

  async preNotificar(dto: {
    nomeTemporario?: string;
    queixaPrincipal: string;
    triagem: string;
    etaMinutos: number;
    condicaoPrevia?: string;
    sinaisVitaisTriagem?: object;
  }, registadoPorId: string) {
    const episodio = await this.prisma.episodioUrgencia.create({
      data: {
        nomeTemporario: dto.nomeTemporario ?? 'Doente em trânsito',
        queixaPrincipal: dto.queixaPrincipal,
        triagem: dto.triagem as any,
        estadoEpisodio: 'triagem',
        triadoPorId: registadoPorId,
        preNotificacao: true,
        etaMinutos: dto.etaMinutos,
        condicaoPrevia: dto.condicaoPrevia ?? null,
        sinaisVitaisTriagem: dto.sinaisVitaisTriagem ?? undefined,
      },
      include: { triadoPor: { select: { id: true, nome: true } } },
    });

    // Notificar staff de urgência de plantão
    const { tipoTurno, dataHoje, dataFim } = this.turnoAtual();
    const staffPlantao = await this.prisma.horarioTurnoProfissional.findMany({
      where: {
        utilizador: { role: { in: ['medico', 'enfermeiro'] }, servico: 'urgencia' },
        horarioTurno: { tipo: tipoTurno as any, data: { gte: dataHoje, lte: dataFim } },
      },
      include: { utilizador: { select: { id: true } } },
    });

    // Fallback: todos os utilizadores activos em urgência
    const targets =
      staffPlantao.length > 0
        ? staffPlantao.map(s => s.utilizador.id)
        : (await this.prisma.utilizador.findMany({
            where: { role: { in: ['medico', 'enfermeiro'] }, servico: 'urgencia', ativo: true },
            select: { id: true },
          })).map(u => u.id);

    const titulo = `🚑 Ambulância a caminho — ETA: ${dto.etaMinutos} min`;
    const corpo = `${dto.triagem.toUpperCase()} — ${dto.queixaPrincipal}${dto.condicaoPrevia ? `. ${dto.condicaoPrevia}` : ''}`;
    const pushData = { tipo: 'ambulancia', episodioId: episodio.id };

    for (const id of targets) {
      this.notificacoes.enviarParaUtilizador(id, titulo, corpo, pushData).catch(() => {});
    }

    this.gateway.emitirPreNotificacao(episodio.id, dto.triagem, dto.etaMinutos, dto.queixaPrincipal);
    return episodio;
  }

  async completarPreNotificacao(id: string, dto: {
    doenteId?: string; triagem?: string; sinaisVitaisTriagem?: object; notas?: string;
  }) {
    await this.buscar(id);
    return this.prisma.episodioUrgencia.update({
      where: { id },
      data: {
        ...(dto.doenteId ? { doenteId: dto.doenteId } : {}),
        ...(dto.triagem ? { triagem: dto.triagem as any } : {}),
        estadoEpisodio: 'sala_espera',
        sinaisVitaisTriagem: dto.sinaisVitaisTriagem ?? undefined,
        notas: dto.notas ?? undefined,
      },
      include: { doente: { select: { id: true, nome: true, dataNascimento: true } }, triadoPor: { select: { id: true, nome: true } } },
    });
  }

  async listaEspera() {
    const episodios = await this.prisma.episodioUrgencia.findMany({
      where: { estadoEpisodio: { notIn: ['alta_urgencia', 'internado', 'transferido'] } },
      include: {
        doente: { select: { id: true, nome: true, dataNascimento: true } },
        triadoPor: { select: { id: true, nome: true } },
        medicoResponsavel: { select: { id: true, nome: true } },
      },
    });
    return episodios.sort((a, b) => {
      const ordemA = ORDEM_TRIAGEM[a.triagem] ?? 99;
      const ordemB = ORDEM_TRIAGEM[b.triagem] ?? 99;
      if (ordemA !== ordemB) return ordemA - ordemB;
      return a.dataEntrada.getTime() - b.dataEntrada.getTime();
    });
  }

  async atualizarEstado(id: string, estado: string) {
    await this.buscar(id);
    const dataSaida = ['alta_urgencia', 'internado', 'transferido'].includes(estado) ? new Date() : undefined;
    const result = await this.prisma.episodioUrgencia.update({
      where: { id },
      data: { estadoEpisodio: estado as any, ...(dataSaida ? { dataSaida } : {}) },
      include: { doente: { select: { id: true, nome: true } }, medicoResponsavel: { select: { id: true, nome: true } } },
    });
    this.gateway.emitirUrgenciaUpdate({ id, estado });
    return result;
  }

  async atribuirMedico(id: string, medicoResponsavelId: string) {
    await this.buscar(id);
    return this.prisma.episodioUrgencia.update({
      where: { id },
      data: { medicoResponsavelId, estadoEpisodio: 'em_atendimento' },
      include: { doente: { select: { id: true, nome: true } }, medicoResponsavel: { select: { id: true, nome: true } } },
    });
  }

  async dashboard() {
    const episodios = await this.prisma.episodioUrgencia.findMany({
      where: { estadoEpisodio: { notIn: ['alta_urgencia', 'internado', 'transferido'] } },
    });
    const agora = Date.now();
    const tempoMedio = episodios.length
      ? Math.round(episodios.reduce((acc, e) => acc + (agora - e.dataEntrada.getTime()), 0) / episodios.length / 60000)
      : 0;
    const emTransito = episodios.filter(e => e.preNotificacao && e.estadoEpisodio === 'triagem').length;
    return {
      total: episodios.length,
      emTransito,
      porCor: {
        vermelho: episodios.filter(e => e.triagem === 'vermelho').length,
        laranja: episodios.filter(e => e.triagem === 'laranja').length,
        amarelo: episodios.filter(e => e.triagem === 'amarelo').length,
        verde: episodios.filter(e => e.triagem === 'verde').length,
        azul: episodios.filter(e => e.triagem === 'azul').length,
      },
      tempoMedioEsperaMin: tempoMedio,
    };
  }

  private async buscar(id: string) {
    const e = await this.prisma.episodioUrgencia.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Episódio não encontrado');
    return e;
  }

  private turnoAtual() {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipoTurno: string;
    if (min >= 8 * 60 && min < 16 * 60 + 30) tipoTurno = 'manha';
    else if (min >= 16 * 60 && min < 23 * 60 + 30) tipoTurno = 'tarde';
    else tipoTurno = 'noite';
    const diaStr = agora.toISOString().split('T')[0];
    const dataHoje = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(dataHoje.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { tipoTurno, dataHoje, dataFim };
  }
}

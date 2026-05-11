import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class AlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoesService: NotificacoesService,
    private readonly gateway: EventsGateway,
  ) {}

  async listarNaoLidos(doenteId: string) {
    return this.prisma.alertaClinico.findMany({
      where: { doenteId, lido: false },
      orderBy: { criadoEm: 'desc' },
      include: { acusadoPor: { select: { id: true, nome: true } } },
    });
  }

  async marcarLido(id: string) {
    return this.prisma.alertaClinico.update({
      where: { id },
      data: { lido: true },
    });
  }

  async marcarTodosLidos(doenteId: string) {
    return this.prisma.alertaClinico.updateMany({
      where: { doenteId, lido: false },
      data: { lido: true },
    });
  }

  criarAlerta(doenteId: string, tipo: string, mensagem: string): void {
    this.prisma.alertaClinico
      .create({ data: { doenteId, tipo, mensagem } })
      .then(() => {
        this.notificacoesService.enviarParaDoente(doenteId, '🚨 Alerta Clínico', mensagem).catch(() => {});
      })
      .catch(() => {});
  }

  // ─── SOS ──────────────────────────────────────────────────────────────────

  async acionarSOS(doenteId: string, acionadoPorId: string) {
    const alerta = await this.prisma.alertaClinico.create({
      data: {
        doenteId,
        tipo: 'sos',
        mensagem: 'EMERGÊNCIA — Botão SOS acionado. Resposta imediata necessária.',
        urgencia: true,
      },
      include: {
        doente: { select: { id: true, nome: true, cama: { select: { numero: true, quarto: true } } } },
      },
    });

    const doente = alerta.doente as any;
    const localizacao = doente?.cama
      ? `Quarto ${doente.cama.quarto}, Cama ${doente.cama.numero}`
      : 'Localização desconhecida';
    const titulo = `🚨 SOS — ${doente?.nome ?? 'Doente'} (${localizacao})`;
    const corpo = 'EMERGÊNCIA — Resposta imediata necessária. Toque para abrir a ficha.';
    const pushData = { doenteId, tipo: 'sos', alertaId: alerta.id };

    const notificadosIds = new Set<string>();

    // Encontrar turno actual
    const { tipoTurno, dataHoje, dataFim } = this.turnoAtual();

    // Profissionais atribuídos ao doente no turno actual
    const atribuicoes = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        doenteId,
        horarioTurno: { tipo: tipoTurno as any, data: { gte: dataHoje, lte: dataFim } },
      },
      include: { utilizador: { select: { id: true, role: true, subRole: true } } },
    });

    const medicosAtribuidos = atribuicoes.filter(a => a.utilizador.role === 'medico');

    if (medicosAtribuidos.length > 0) {
      for (const a of medicosAtribuidos) {
        notificadosIds.add(a.utilizador.id);
        this.notificacoesService.enviarParaUtilizador(a.utilizador.id, titulo, corpo, pushData).catch(() => {});
      }
    } else {
      // Tentar pelo subRole da especialidade do doente
      const subRoles = [
        ...new Set(atribuicoes.map(a => a.utilizador.subRole).filter(Boolean)),
      ] as string[];

      const candidatos = await this.prisma.horarioTurnoProfissional.findMany({
        where: {
          utilizador: {
            role: 'medico',
            ...(subRoles.length > 0 ? { subRole: { in: subRoles } } : {}),
          },
          horarioTurno: { tipo: tipoTurno as any, data: { gte: dataHoje, lte: dataFim } },
        },
        include: { utilizador: { select: { id: true } } },
      });

      // Fallback: qualquer médico de serviço
      const targets =
        candidatos.length > 0
          ? candidatos
          : await this.prisma.horarioTurnoProfissional.findMany({
              where: {
                utilizador: { role: 'medico' },
                horarioTurno: { tipo: tipoTurno as any, data: { gte: dataHoje, lte: dataFim } },
              },
              include: { utilizador: { select: { id: true } } },
            });

      // Fallback final: todos os médicos activos
      if (targets.length === 0) {
        const todosMedicos = await this.prisma.utilizador.findMany({
          where: { role: 'medico', ativo: true },
          select: { id: true },
        });
        for (const m of todosMedicos) {
          if (!notificadosIds.has(m.id)) {
            notificadosIds.add(m.id);
            this.notificacoesService.enviarParaUtilizador(m.id, titulo, corpo, pushData).catch(() => {});
          }
        }
      } else {
        for (const t of targets) {
          if (!notificadosIds.has(t.utilizador.id)) {
            notificadosIds.add(t.utilizador.id);
            this.notificacoesService.enviarParaUtilizador(t.utilizador.id, titulo, corpo, pushData).catch(() => {});
          }
        }
      }
    }

    // Notificar sempre o chefe do turno actual
    const turno = await this.prisma.turno.findFirst({
      where: { tipo: tipoTurno as any, dataInicio: { lte: new Date() }, dataFim: { gte: new Date() } },
      select: { chefeTurnoId: true },
    });
    if (turno && !notificadosIds.has(turno.chefeTurnoId)) {
      this.notificacoesService.enviarParaUtilizador(turno.chefeTurnoId, titulo, corpo, pushData).catch(() => {});
    }

    // Emitir via WebSocket para todos os médicos/enfermeiros online
    const quarto = (alerta.doente as any)?.cama
      ? `Quarto ${(alerta.doente as any).cama.quarto}, Cama ${(alerta.doente as any).cama.numero}`
      : 'Localização desconhecida';
    this.gateway.emitirSOS(
      doenteId,
      (alerta.doente as any)?.nome ?? 'Doente',
      quarto,
      acionadoPorId,
    );

    return alerta;
  }

  async acusar(id: string, utilizadorId: string) {
    return this.prisma.alertaClinico.update({
      where: { id },
      data: { acusadoPorId: utilizadorId, acusadoEm: new Date(), lido: true },
      include: { acusadoPor: { select: { id: true, nome: true } } },
    });
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

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

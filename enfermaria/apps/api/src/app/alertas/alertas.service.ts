import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoesService: NotificacoesService,
    private readonly gateway: EventsGateway,
  ) {}

  async listarGlobal(opts: { tipo?: string; lido?: boolean; limit?: number }) {
    const where: any = {};
    if (opts.tipo) where.tipo = opts.tipo;
    if (opts.lido !== undefined) where.lido = opts.lido;
    return this.prisma.alertaClinico.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: opts.limit ?? 50,
      include: {
        doente: { select: { id: true, nome: true, cama: { select: { numero: true, quarto: true } } } },
        acusadoPor: { select: { id: true, nome: true } },
      },
    });
  }

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

  async criarAlerta(doenteId: string, tipo: string, mensagem: string): Promise<void> {
    const recente = await this.prisma.alertaClinico.findFirst({
      where: {
        doenteId,
        tipo,
        lido: false,
        criadoEm: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true },
    });

    if (recente) {
      await this.prisma.alertaClinico.update({
        where: { id: recente.id },
        data: { mensagem },
      });
      return;
    }

    await this.prisma.alertaClinico.create({ data: { doenteId, tipo, mensagem } });
    this.notificacoesService.enviarParaDoente(doenteId, '🚨 Alerta Clínico', mensagem)
      .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
  }

  async getDoenteIdByAlertaId(id: string): Promise<string> {
    const alerta = await this.prisma.alertaClinico.findUnique({ where: { id }, select: { doenteId: true } });
    if (!alerta) throw new NotFoundException(`Alerta (ID ${id}) não encontrado`);
    return alerta.doenteId;
  }

  // ─── SOS ──────────────────────────────────────────────────────────────────

  async acionarSOS(doenteId: string, acionadoPorId: string) {
    // Carregar dados clínicos contextuais em paralelo
    const [alerta, ultimoSinal, medicacoesAtivas, alergias] = await Promise.all([
      this.prisma.alertaClinico.create({
        data: {
          doenteId,
          tipo: 'sos',
          mensagem: 'EMERGÊNCIA — Botão SOS acionado. Resposta imediata necessária.',
          urgencia: true,
        },
        include: {
          doente: {
            select: {
              id: true, nome: true,
              diagnosticoPrincipal: true,
              cama: { select: { numero: true, quarto: true } },
            },
          },
        },
      }),
      this.prisma.sinalVital.findFirst({
        where: { doenteId },
        orderBy: { data: 'desc' },
        select: { pressaoSistolica: true, pressaoDiastolica: true, pulso: true, saturacaoO2: true, temperatura: true, news2: true, data: true },
      }),
      this.prisma.medicacao.findMany({
        where: { doenteId, ativo: true },
        select: { nome: true, dose: true, via: true },
        take: 5,
        orderBy: { iniciadoEm: 'desc' },
      }),
      this.prisma.alergia.findMany({
        where: { doenteId },
        select: { alergenio: true, severidade: true },
      }),
    ]);

    const doente = alerta.doente as any;
    const localizacao = doente?.cama
      ? `Quarto ${doente.cama.quarto}, Cama ${doente.cama.numero}`
      : 'Localização desconhecida';
    const titulo = `🚨 SOS — ${doente?.nome ?? 'Doente'} (${localizacao})`;

    // Compor corpo da notificação com contexto clínico
    const linhasContexto: string[] = [];
    if (ultimoSinal) {
      const partes: string[] = [];
      if (ultimoSinal.pressaoSistolica) partes.push(`TA ${ultimoSinal.pressaoSistolica}/${ultimoSinal.pressaoDiastolica ?? '?'}`);
      if (ultimoSinal.pulso) partes.push(`FC ${ultimoSinal.pulso}`);
      if (ultimoSinal.saturacaoO2) partes.push(`SpO₂ ${ultimoSinal.saturacaoO2}%`);
      if (ultimoSinal.news2 != null) partes.push(`NEWS2=${ultimoSinal.news2}`);
      if (partes.length) linhasContexto.push(partes.join(' · '));
    }
    if (alergias.length > 0) {
      linhasContexto.push(`Alergias: ${alergias.map(a => a.alergenio).join(', ')}`);
    }
    if (medicacoesAtivas.length > 0) {
      linhasContexto.push(`Medicações: ${medicacoesAtivas.map(m => m.nome).join(', ')}`);
    }
    const corpo = linhasContexto.length > 0
      ? `EMERGÊNCIA — ${linhasContexto.join(' | ')}`
      : 'EMERGÊNCIA — Resposta imediata necessária.';

    const pushData = {
      doenteId,
      tipo: 'sos',
      alertaId: alerta.id,
      contextoClinico: {
        diagnostico: doente?.diagnosticoPrincipal ?? null,
        news2: ultimoSinal?.news2 ?? null,
        ultimosSinais: ultimoSinal ?? null,
        medicacoesAtivas,
        alergias,
      },
    };

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
      const ids = medicosAtribuidos.map(a => a.utilizador.id);
      ids.forEach(id => notificadosIds.add(id));
      this.notificacoesService.enviarParaUtilizadores(ids, titulo, corpo, pushData)
        .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
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
        const novosIds = todosMedicos.map(m => m.id).filter(id => !notificadosIds.has(id));
        novosIds.forEach(id => notificadosIds.add(id));
        this.notificacoesService.enviarParaUtilizadores(novosIds, titulo, corpo, pushData)
          .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
      } else {
        const novosIds = targets.map(t => t.utilizador.id).filter(id => !notificadosIds.has(id));
        novosIds.forEach(id => notificadosIds.add(id));
        this.notificacoesService.enviarParaUtilizadores(novosIds, titulo, corpo, pushData)
          .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
      }
    }

    // Notificar sempre o chefe do turno actual
    const turno = await this.prisma.turno.findFirst({
      where: { tipo: tipoTurno as any, dataInicio: { lte: new Date() }, dataFim: { gte: new Date() } },
      select: { chefeTurnoId: true },
    });
    if (turno && !notificadosIds.has(turno.chefeTurnoId)) {
      this.notificacoesService.enviarParaUtilizadores([turno.chefeTurnoId], titulo, corpo, pushData)
        .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
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

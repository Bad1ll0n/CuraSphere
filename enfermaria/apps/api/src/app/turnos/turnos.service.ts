import { Injectable, Logger, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TarefasService } from '../tarefas/tarefas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EventsGateway } from '../gateway/events.gateway';
import { TipoTurno } from '../common/enums';
import * as geolib from 'geolib';

@Injectable()
export class TurnosService {
  private readonly logger = new Logger(TurnosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tarefasService: TarefasService,
    private readonly notificacoes: NotificacoesService,
    private readonly gateway: EventsGateway,
  ) {}

  async turnoAtivo() {
    const agora = new Date();
    return this.prisma.turno.findFirst({
      where: { dataInicio: { lte: agora }, dataFim: { gte: agora } },
      include: {
        chefeTurno: { select: { id: true, nome: true } },
        atribuicoes: {
          include: {
            doente: { select: { id: true, nome: true, estado: true, cama: true } },
            enfermeiro: { select: { id: true, nome: true } },
          },
        },
        horariosEntrada: {
          include: { utilizador: { select: { id: true, nome: true, role: true } } },
        },
      },
    });
  }

  async checkIn(utilizadorId: string, opts?: { lat?: number; lon?: number; ip?: string }) {
    const turno = await this.turnoAtivo();
    if (!turno) throw new BadRequestException('Não existe turno ativo neste momento');

    const jaFezCheckIn = await this.prisma.horarioEntrada.findUnique({
      where: { turnoId_utilizadorId: { turnoId: turno.id, utilizadorId } },
    });
    if (jaFezCheckIn) throw new BadRequestException('Check-in já realizado para este turno');

    // HorarioTurno.data é sempre a meia-noite UTC do dia (ver horarios.service.ts) — nunca cai
    // dentro da janela horária precisa do Turno (ex: 08:00-16:30), por isso comparamos por dia + tipo.
    const diaInicio = new Date(turno.dataInicio);
    diaInicio.setUTCHours(0, 0, 0, 0);
    const diaFim = new Date(diaInicio);
    diaFim.setUTCHours(23, 59, 59, 999);
    const noHorario = await this.prisma.horarioTurnoProfissional.findFirst({
      where: {
        utilizadorId,
        horarioTurno: { tipo: turno.tipo, data: { gte: diaInicio, lte: diaFim } },
      },
    });
    if (!noHorario) throw new ForbiddenException('Não está escalado para este turno');

    const entrada = await this.prisma.horarioEntrada.create({
      data: { turnoId: turno.id, utilizadorId },
    });

    // Registar check-in com localização e IP
    let dentroGeofence = true;
    let distancia: number | undefined;

    const hospitalLat = parseFloat(process.env.HOSPITAL_LAT ?? '0');
    const hospitalLon = parseFloat(process.env.HOSPITAL_LON ?? '0');
    const geofenceMetros = parseInt(process.env.HOSPITAL_GEOFENCE_METROS ?? '300');

    if (opts?.lat != null && opts?.lon != null && hospitalLat !== 0) {
      distancia = geolib.getDistance(
        { latitude: opts.lat, longitude: opts.lon },
        { latitude: hospitalLat, longitude: hospitalLon },
      );
      dentroGeofence = distancia <= geofenceMetros;
    } else if (opts?.ip) {
      // Verificação por IP: IPs privados considerados "dentro"
      dentroGeofence = this.ipEhInterno(opts.ip);
    }

    await this.prisma.registoCheckin.create({
      data: {
        utilizadorId,
        turnoId: turno.id,
        lat: opts?.lat ?? null,
        lon: opts?.lon ?? null,
        distanciaHospital: distancia ?? null,
        dentroGeofence,
        ip: opts?.ip ?? null,
      },
    }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    if (!dentroGeofence) {
      const utilizador = await this.prisma.utilizador.findUnique({
        where: { id: utilizadorId }, select: { nome: true },
      });
      await this.notificacoes.enviarParaUtilizador(
        turno.chefeTurnoId,
        'Check-in fora do hospital',
        `${utilizador?.nome ?? 'Profissional'} fez check-in mas parece estar fora do hospital (${distancia != null ? distancia + 'm' : 'IP externo'}).`,
        { utilizadorId, turnoId: turno.id },
      );
    }

    const passagem = await this.gerarPassagemTurno(utilizadorId, turno.id);
    return { entrada, passagem, dentroGeofence };
  }

  private ipEhInterno(ip: string): boolean {
    return (
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') ||
      ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') ||
      ip === '127.0.0.1' ||
      ip === '::1'
    );
  }

  // ── Passagem de turno com desafio de presença real ─────────────────────────

  async iniciarPassagem(solicitadorId: string) {
    const turno = await this.turnoAtivo();
    if (!turno) throw new BadRequestException('Não existe turno ativo');

    // Buscar passagens pendentes do solicitador
    const passagens = await this.prisma.passagemTurno.findMany({
      where: { turnoAtualId: turno.id, estadoDesafio: 'pendente' },
      include: { doente: { select: { id: true, nome: true, cama: true } } },
    });

    if (passagens.length === 0) throw new BadRequestException('Sem passagens pendentes');

    // Encontrar profissionais escalados no turno atual que ainda não fizeram check-in
    const escaladosNoTurno = await this.prisma.horarioTurnoProfissional.findMany({
      where: {
        horarioTurno: { data: { gte: turno.dataInicio, lte: turno.dataFim } },
        NOT: { utilizadorId: solicitadorId },
      },
      include: { utilizador: { select: { id: true, nome: true, role: true } } },
    });

    // Verificar quais estão online
    const receptoresOnline: string[] = [];
    for (const e of escaladosNoTurno) {
      const online = await this.gateway.estaOnline(e.utilizadorId);
      if (online) receptoresOnline.push(e.utilizadorId);
    }

    if (receptoresOnline.length === 0) {
      throw new ConflictException('Nenhum profissional do próximo turno está com sessão activa. A passagem de turno requer presença confirmada.');
    }

    const turnoInfo = {
      id: turno.id,
      tipo: turno.tipo,
      passagens: passagens.map(p => ({
        id: p.id,
        doente: p.doente,
      })),
    };

    // Emitir desafio a todos os receptores online
    const now = new Date();
    for (const receptorId of receptoresOnline) {
      await this.prisma.passagemTurno.updateMany({
        where: { turnoAtualId: turno.id, estadoDesafio: 'pendente' },
        data: { desafioEnviadoEm: now },
      }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

      this.gateway.emitirPassagemDesafio(receptorId, passagens[0].id, turnoInfo);
    }

    // Timeout de 5 minutos — expirar passagens não aceites
    setTimeout(async () => {
      const pendentes = await this.prisma.passagemTurno.findMany({
        where: { turnoAtualId: turno.id, estadoDesafio: 'pendente' },
      });
      if (pendentes.length > 0) {
        await this.prisma.passagemTurno.updateMany({
          where: { turnoAtualId: turno.id, estadoDesafio: 'pendente' },
          data: { estadoDesafio: 'expirado', desafioExpiradoEm: new Date() },
        });
        await this.notificacoes.enviarParaUtilizador(
          solicitadorId,
          'Passagem de turno expirada',
          'Nenhum profissional aceitou a passagem de turno em 5 minutos. Por favor tente novamente.',
        );
      }
    }, 5 * 60 * 1000);

    return {
      mensagem: `Desafio de passagem enviado a ${receptoresOnline.length} profissional(ais) online`,
      receptores: receptoresOnline.length,
    };
  }

  async confirmarPassagemTurno(utilizadorId: string) {
    const turno = await this.turnoAtivo();
    if (!turno) throw new BadRequestException('Não existe turno ativo');

    await this.prisma.horarioEntrada.update({
      where: { turnoId_utilizadorId: { turnoId: turno.id, utilizadorId } },
      data: { passagemTurnoVista: true },
    });

    return { mensagem: 'Passagem de turno confirmada' };
  }

  async inatividade() {
    const turno = await this.turnoAtivo();
    if (!turno) return { profissionais: [] };

    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const horariosEntrada = await this.prisma.horarioEntrada.findMany({
      where: { turnoId: turno.id },
      include: { utilizador: { select: { id: true, nome: true, role: true } } },
    });

    const resultado = [];
    for (const h of horariosEntrada) {
      const ultimaAccao = await this.prisma.auditLog.findFirst({
        where: { utilizadorId: h.utilizadorId },
        orderBy: { createdAt: 'desc' },
      });
      const inativo = !ultimaAccao || ultimaAccao.createdAt < duasHorasAtras;
      if (inativo) {
        resultado.push({
          utilizador: h.utilizador,
          ultimaAccao: ultimaAccao?.createdAt ?? null,
          minutosInativo: ultimaAccao
            ? Math.floor((Date.now() - ultimaAccao.createdAt.getTime()) / 60000)
            : null,
        });
      }
    }

    return { turnoId: turno.id, profissionais: resultado };
  }

  private async gerarPassagemTurno(utilizadorId: string, turnoAtualId: string) {
    const turnoAtual = await this.prisma.turno.findUnique({ where: { id: turnoAtualId } });
    if (!turnoAtual) return null;

    const turnoAnterior = await this.prisma.turno.findFirst({
      where: { dataFim: { lte: turnoAtual.dataInicio } },
      orderBy: { dataFim: 'desc' },
    });

    if (!turnoAnterior) return null;

    const atribuicoes = await this.prisma.atribuicaoDoente.findMany({
      where: { turnoId: turnoAtualId, enfermeiroId: utilizadorId },
      include: { doente: true },
    });

    const passagens = [];
    for (const atribuicao of atribuicoes) {
      const existente = await this.prisma.passagemTurno.findFirst({
        where: { doenteId: atribuicao.doenteId, turnoAtualId },
      });

      if (!existente) {
        const passagem = await this.prisma.passagemTurno.create({
          data: {
            turnoAnteriorId: turnoAnterior.id,
            turnoAtualId,
            doenteId: atribuicao.doenteId,
          },
        });
        passagens.push(passagem);
      }
    }

    await this.tarefasService.transitarParaTurno(turnoAnterior.id, turnoAtualId);
    return passagens;
  }

  async passagemTurno(utilizadorId: string) {
    const turno = await this.turnoAtivo();
    if (!turno) throw new BadRequestException('Não existe turno ativo');

    const turnoAnterior = await this.prisma.turno.findFirst({
      where: { dataFim: { lte: turno.dataInicio } },
      orderBy: { dataFim: 'desc' },
    });

    const atribuicoes = await this.prisma.atribuicaoDoente.findMany({
      where: { turnoId: turno.id, enfermeiroId: utilizadorId },
      include: {
        doente: {
          include: {
            cama: true,
            tarefas: { where: { estado: { in: ['pendente', 'em_progresso'] } } },
            notasTurno: {
              where: turnoAnterior ? { turnoId: turnoAnterior.id } : {},
              include: { autor: { select: { nome: true, role: true } } },
              orderBy: { criadaEm: 'desc' },
            },
            medicacoes: { where: { ativo: true } },
          },
        },
      },
    });

    return atribuicoes.map((a) => ({
      doente: a.doente,
      tarefasPendentes: a.doente.tarefas,
      notasAnteriores: a.doente.notasTurno,
      medicacoesAtivas: a.doente.medicacoes,
    }));
  }

  async atribuirDoentes(turnoId: string, atribuicoes: { doenteId: string; enfermeiroId: string }[]) {
    return this.prisma.$transaction([
      this.prisma.atribuicaoDoente.deleteMany({ where: { turnoId } }),
      this.prisma.atribuicaoDoente.createMany({
        data: atribuicoes.map((a) => ({ ...a, turnoId })),
      }),
    ]);
  }

  async adicionarNota(data: { turnoId: string; doenteId: string; autorId: string; texto: string }) {
    return this.prisma.notaTurno.create({
      data,
      include: { autor: { select: { id: true, nome: true, role: true } } },
    });
  }

  async criar(data: { tipo: TipoTurno; dataInicio: Date; dataFim: Date; chefeTurnoId: string }) {
    return this.prisma.turno.create({
      data: {
        tipo: data.tipo,
        dataInicio: new Date(data.dataInicio),
        dataFim: new Date(data.dataFim),
        chefeTurnoId: data.chefeTurnoId,
      },
      include: { chefeTurno: { select: { id: true, nome: true } } },
    });
  }
}

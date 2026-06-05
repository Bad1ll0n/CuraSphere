import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EventsGateway } from '../gateway/events.gateway';
import { calcularNEWS2 } from '../common/news2.helper';
import { PreNotificacaoDto } from './dto/pre-notificacao.dto';
import { ReTriagemDto } from './dto/re-triagem.dto';
import { AdicionarAtualizacaoDto } from './dto/adicionar-atualizacao.dto';
import { ActivarEspecialidadeDto } from './dto/activar-especialidade.dto';

const ORDEM_TRIAGEM: Record<string, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };

const SLA_MINUTOS: Record<string, number> = {
  vermelho: 0,
  laranja: 10,
  amarelo: 30,
  verde: 120,
  azul: 240,
};

const ESPECIALIDADE_TARGETS: Record<string, { subRoles?: string[]; servicos?: string[] }> = {
  stemi: { subRoles: ['cardiologista'], servicos: ['cardiologia'] },
  avc:   { subRoles: ['neurologista'], servicos: ['neurologia'] },
  trauma: { servicos: ['cirurgia', 'anestesiologia', 'bloco_operatorio'] },
};

@Injectable()
export class UrgenciaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UrgenciaService.name);
  private readonly urgenciaSubject = new Subject<{ data: string; type: string }>();
  private slaAlertados = new Map<string, number>(); // episodioId → last alerted ts
  private slaInterval: NodeJS.Timeout | null = null;

  eventStream() { return this.urgenciaSubject.asObservable(); }
  private emit(type: string, payload: unknown) { this.urgenciaSubject.next({ type, data: JSON.stringify(payload) }); }

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly gateway: EventsGateway,
  ) {}

  onModuleInit() {
    // Verificar SLAs a cada 2 minutos
    this.slaInterval = setInterval(() => this.verificarSLAs(), 2 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.slaInterval) clearInterval(this.slaInterval);
  }

  async registarEntrada(dto: {
    doenteId?: string; nomeTemporario?: string; queixaPrincipal: string;
    triagem: string; sinaisVitaisTriagem?: object; notas?: string;
  }, triadoPorId: string) {
    const news2 = this.news2FromVitals(dto.sinaisVitaisTriagem);

    const episodio = await this.prisma.episodioUrgencia.create({
      data: {
        doenteId: dto.doenteId ?? null,
        nomeTemporario: dto.nomeTemporario ?? null,
        queixaPrincipal: dto.queixaPrincipal,
        triagem: dto.triagem as any,
        estadoEpisodio: 'sala_espera',
        triadoPorId,
        sinaisVitaisTriagem: dto.sinaisVitaisTriagem ?? undefined,
        notas: dto.notas ?? null,
        ...(news2 != null ? { news2Triagem: news2 } : {}),
      },
      include: {
        doente: { select: { id: true, nome: true, dataNascimento: true } },
        triadoPor: { select: { id: true, nome: true } },
      },
    });
    this.emit('urgencia_nova', { id: episodio.id, triagem: episodio.triagem, queixaPrincipal: episodio.queixaPrincipal });
    return episodio;
  }

  async preNotificar(dto: PreNotificacaoDto, registadoPorId: string) {
    const news2 = this.news2FromRouteVitals(dto);

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
        idadeAproximada: dto.idadeAproximada ?? null,
        sexo: dto.sexo ?? null,
        consciente: dto.consciente ?? null,
        glasgow: dto.glasgow ?? null,
        mecanismo: dto.mecanismo ?? null,
        vitalsPASistolica: dto.vitalsPASistolica ?? null,
        vitalsPADiastolica: dto.vitalsPADiastolica ?? null,
        vitalsFC: dto.vitalsFC ?? null,
        vitalsSpO2: dto.vitalsSpO2 ?? null,
        vitalsFR: dto.vitalsFR ?? null,
        intervencoes: dto.intervencoes ?? [],
        ...(news2 != null ? { news2Triagem: news2 } : {}),
      },
      include: { triadoPor: { select: { id: true, nome: true } } },
    });

    await this.notificarStaffUrgencia(dto, episodio.id);
    this.gateway.emitirPreNotificacao(episodio.id, dto.triagem, dto.etaMinutos, dto.queixaPrincipal);
    return episodio;
  }

  async completarPreNotificacao(id: string, dto: {
    doenteId?: string; triagem?: string; sinaisVitaisTriagem?: object; notas?: string;
  }) {
    await this.buscar(id);
    const news2 = this.news2FromVitals(dto.sinaisVitaisTriagem);
    const resultado = await this.prisma.episodioUrgencia.update({
      where: { id },
      data: {
        ...(dto.doenteId ? { doenteId: dto.doenteId } : {}),
        ...(dto.triagem ? { triagem: dto.triagem as any } : {}),
        estadoEpisodio: 'sala_espera',
        sinaisVitaisTriagem: dto.sinaisVitaisTriagem ?? undefined,
        notas: dto.notas ?? undefined,
        ...(news2 != null ? { news2Triagem: news2 } : {}),
      },
      include: {
        doente: { select: { id: true, nome: true, dataNascimento: true } },
        triadoPor: { select: { id: true, nome: true } },
        atualizacoes: { orderBy: { criadaEm: 'asc' }, include: { registadoPor: { select: { id: true, nome: true } } } },
      },
    });
    this.emit('urgencia_atualizada', { id, estado: 'sala_espera' });
    return resultado;
  }

  async listaEspera() {
    const episodios = await this.prisma.episodioUrgencia.findMany({
      where: { estadoEpisodio: { notIn: ['alta_urgencia', 'internado', 'transferido'] } },
      include: {
        doente: { select: { id: true, nome: true, dataNascimento: true } },
        triadoPor: { select: { id: true, nome: true } },
        medicoResponsavel: { select: { id: true, nome: true } },
        atualizacoes: {
          orderBy: { criadaEm: 'asc' },
          include: { registadoPor: { select: { id: true, nome: true } } },
        },
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
    const iniciadoAtendimentoEm = estado === 'em_atendimento' ? new Date() : undefined;
    const result = await this.prisma.episodioUrgencia.update({
      where: { id },
      data: {
        estadoEpisodio: estado as any,
        ...(dataSaida ? { dataSaida } : {}),
        ...(iniciadoAtendimentoEm ? { iniciadoAtendimentoEm } : {}),
      },
      include: { doente: { select: { id: true, nome: true } }, medicoResponsavel: { select: { id: true, nome: true } } },
    });
    this.gateway.emitirUrgenciaUpdate({ id, estado });
    this.emit('urgencia_atualizada', { id, estado });
    return result;
  }

  async atribuirMedico(id: string, medicoResponsavelId: string, salaAtendimento?: string) {
    await this.buscar(id);
    const resultado = await this.prisma.episodioUrgencia.update({
      where: { id },
      data: {
        medicoResponsavelId,
        estadoEpisodio: 'em_atendimento',
        iniciadoAtendimentoEm: new Date(),
        ...(salaAtendimento ? { salaAtendimento } : {}),
      },
      include: {
        doente: { select: { id: true, nome: true } },
        medicoResponsavel: { select: { id: true, nome: true } },
      },
    });
    this.gateway.emitirUrgenciaUpdate({ id, estado: 'em_atendimento', salaAtendimento });
    this.emit('urgencia_atualizada', { id, estado: 'em_atendimento', salaAtendimento });
    return resultado;
  }

  async reTriar(id: string, dto: ReTriagemDto, userId: string) {
    const episodio = await this.buscar(id);
    if (episodio.estadoEpisodio !== 'sala_espera') {
      throw new BadRequestException('Só é possível re-triar episódios em sala de espera');
    }
    const corAnterior = String(episodio.triagem);
    const notaReTriagem = `[Re-triagem ${corAnterior}→${dto.novaTriagem} por ${userId}]: ${dto.motivo}`;
    const notasActuais = episodio.notas ? `${episodio.notas}\n${notaReTriagem}` : notaReTriagem;

    const resultado = await this.prisma.episodioUrgencia.update({
      where: { id },
      data: {
        triagem: dto.novaTriagem as any,
        corAnterior,
        notas: notasActuais,
      },
      include: {
        doente: { select: { id: true, nome: true } },
        triadoPor: { select: { id: true, nome: true } },
        medicoResponsavel: { select: { id: true, nome: true } },
      },
    });
    this.gateway.emitirUrgenciaUpdate({ id, triagem: dto.novaTriagem, corAnterior, reTriagem: true });
    this.emit('urgencia_atualizada', { id, triagem: dto.novaTriagem });
    return resultado;
  }

  async adicionarAtualizacao(episodioId: string, dto: AdicionarAtualizacaoDto, userId: string) {
    await this.buscar(episodioId);

    const atualizacao = await this.prisma.atualizacaoTransporte.create({
      data: { episodioId, registadoPorId: userId, texto: dto.texto, novaETA: dto.novaETA ?? null },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });

    if (dto.novaETA) {
      await this.prisma.episodioUrgencia.update({
        where: { id: episodioId },
        data: { etaMinutos: dto.novaETA },
      });
    }

    this.gateway.emitirUrgenciaUpdate({ id: episodioId, novaAtualizacao: atualizacao, novaETA: dto.novaETA });
    this.emit('urgencia_atualizada', { id: episodioId, novaAtualizacao: true });
    return atualizacao;
  }

  async activarEspecialidade(episodioId: string, dto: ActivarEspecialidadeDto, userId: string) {
    const episodio = await this.buscar(episodioId);
    if (episodio.especialidadeActivada) {
      throw new BadRequestException('Especialidade já activada para este episódio');
    }

    await this.prisma.episodioUrgencia.update({
      where: { id: episodioId },
      data: {
        especialidadeActivada: dto.tipo,
        especialidadeActivadaEm: new Date(),
        especialidadeActivadaPorId: userId,
      },
    });

    // Notificar médicos da especialidade
    const config = ESPECIALIDADE_TARGETS[dto.tipo];
    const destinos = await this.resolverDestinatariosEspecialidade(config);
    const nomes: Record<string, string> = { stemi: 'STEMI', avc: 'Via Verde AVC', trauma: 'Equipa de Trauma' };
    const titulo = `🚨 Activação ${nomes[dto.tipo]} — Urgência`;
    const corpo = `Episódio ${episodio.queixaPrincipal} — Triagem: ${episodio.triagem}`;

    for (const id of destinos) {
      this.notificacoes.enviarParaUtilizador(id, titulo, corpo, { tipo: 'activacao_especialidade', episodioId })
        .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }

    this.gateway.emitirUrgenciaUpdate({ id: episodioId, especialidadeActivada: dto.tipo });
    this.emit('urgencia_atualizada', { id: episodioId, especialidadeActivada: dto.tipo });

    return { episodioId, tipo: dto.tipo, destinatariosNotificados: destinos.length };
  }

  async dashboard() {
    const episodios = await this.prisma.episodioUrgencia.findMany({
      where: { estadoEpisodio: { notIn: ['alta_urgencia', 'internado', 'transferido'] } },
    });
    const agora = Date.now();
    const emEspera = episodios.filter(e => e.estadoEpisodio === 'sala_espera');
    const tempoMedio = emEspera.length
      ? Math.round(emEspera.reduce((acc, e) => acc + (agora - e.dataEntrada.getTime()), 0) / emEspera.length / 60000)
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

  private async verificarSLAs() {
    try {
      const emEspera = await this.prisma.episodioUrgencia.findMany({
        where: { estadoEpisodio: 'sala_espera' },
        select: { id: true, triagem: true, dataEntrada: true, nomeTemporario: true, doente: { select: { nome: true } } },
      });

      const agora = Date.now();
      const cincoMinutos = 5 * 60 * 1000;

      for (const ep of emEspera) {
        const slaMax = SLA_MINUTOS[String(ep.triagem)];
        if (slaMax == null) continue;
        const minutosEspera = (agora - ep.dataEntrada.getTime()) / 60000;
        if (minutosEspera <= slaMax) continue;

        const ultimoAlerta = this.slaAlertados.get(ep.id) ?? 0;
        if (agora - ultimoAlerta < cincoMinutos) continue;

        this.slaAlertados.set(ep.id, agora);
        const nomeDoente = ep.doente?.nome ?? ep.nomeTemporario ?? 'Doente';
        const payload = {
          episodioId: ep.id,
          triagem: ep.triagem,
          minutosEspera: Math.round(minutosEspera),
          slaMax,
          nomeDoente,
        };
        this.gateway.emitirSLAExcedido(payload);
        this.emit('urgencia_sla_excedido', payload);
      }
    } catch (err) {
      this.logger.warn('Erro na verificação de SLAs', err?.message ?? String(err));
    }
  }

  private news2FromVitals(vitais?: object | null): number | null {
    if (!vitais) return null;
    const v = vitais as Record<string, unknown>;
    return calcularNEWS2({
      frequenciaRespiratoria: typeof v['frequenciaRespiratoria'] === 'number' ? v['frequenciaRespiratoria'] : null,
      saturacaoO2: typeof v['saturacaoO2'] === 'number' ? v['saturacaoO2'] : null,
      temperatura: typeof v['temperatura'] === 'number' ? v['temperatura'] : null,
      pressaoSistolica: typeof v['pressaoSistolica'] === 'number' ? v['pressaoSistolica'] : null,
      pulso: typeof v['pulso'] === 'number' ? v['pulso'] : null,
      avpu: typeof v['avpu'] === 'string' ? v['avpu'] : null,
    });
  }

  private news2FromRouteVitals(dto: PreNotificacaoDto): number | null {
    return calcularNEWS2({
      frequenciaRespiratoria: dto.vitalsFR ?? null,
      saturacaoO2: dto.vitalsSpO2 ?? null,
      pressaoSistolica: dto.vitalsPASistolica ?? null,
      pulso: dto.vitalsFC ?? null,
    });
  }

  private async notificarStaffUrgencia(dto: { triagem: string; queixaPrincipal: string; etaMinutos: number; condicaoPrevia?: string }, episodioId: string) {
    const { tipoTurno, dataHoje, dataFim } = this.turnoAtual();
    const staffPlantao = await this.prisma.horarioTurnoProfissional.findMany({
      where: {
        utilizador: { role: { in: ['medico', 'enfermeiro'] }, servico: 'urgencia' },
        horarioTurno: { tipo: tipoTurno as any, data: { gte: dataHoje, lte: dataFim } },
      },
      include: { utilizador: { select: { id: true } } },
    });

    const targets =
      staffPlantao.length > 0
        ? staffPlantao.map(s => s.utilizador.id)
        : (await this.prisma.utilizador.findMany({
            where: { role: { in: ['medico', 'enfermeiro'] }, servico: 'urgencia', ativo: true },
            select: { id: true },
          })).map(u => u.id);

    const titulo = `🚑 Ambulância a caminho — ETA: ${dto.etaMinutos} min`;
    const corpo = `${dto.triagem.toUpperCase()} — ${dto.queixaPrincipal}${dto.condicaoPrevia ? `. ${dto.condicaoPrevia}` : ''}`;

    for (const id of targets) {
      this.notificacoes.enviarParaUtilizador(id, titulo, corpo, { tipo: 'ambulancia', episodioId })
        .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }
  }

  private async resolverDestinatariosEspecialidade(config: { subRoles?: string[]; servicos?: string[] }) {
    const ids = new Set<string>();

    if (config.subRoles?.length) {
      const users = await this.prisma.utilizador.findMany({
        where: { subRole: { in: config.subRoles }, ativo: true },
        select: { id: true },
      });
      users.forEach(u => ids.add(u.id));
    }

    if (config.servicos?.length) {
      const users = await this.prisma.utilizador.findMany({
        where: { role: 'medico', servico: { in: config.servicos as any }, ativo: true },
        select: { id: true },
      });
      users.forEach(u => ids.add(u.id));
    }

    return [...ids];
  }

  private async buscar(id: string) {
    const e = await this.prisma.episodioUrgencia.findUnique({ where: { id } });
    if (!e) throw new NotFoundException(`Episódio de urgência (ID ${id}) não encontrado`);
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

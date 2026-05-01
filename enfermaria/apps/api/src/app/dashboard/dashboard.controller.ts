import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SubRoles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('analytics')
  async analytics() {
    const agora = new Date();

    // ── Ocupação diária nos últimos 14 dias ──────────────────────────────────
    const ocupacaoDiaria: Array<{ data: string; total: number; ocupadas: number }> = [];
    const totalCamas = await this.prisma.cama.count();

    for (let i = 13; i >= 0; i--) {
      const dia = new Date(agora);
      dia.setDate(dia.getDate() - i);
      dia.setHours(23, 59, 59, 999);

      const iniciodia = new Date(dia);
      iniciodia.setHours(0, 0, 0, 0);

      const ocupadas = await this.prisma.doente.count({
        where: {
          dataAdmissao: { lte: dia },
          OR: [
            { dataAlta: null },
            { dataAlta: { gte: iniciodia } },
          ],
        },
      });

      ocupacaoDiaria.push({
        data: iniciodia.toISOString().split('T')[0],
        total: totalCamas,
        ocupadas,
      });
    }

    // ── Carga dos enfermeiros no turno atual ─────────────────────────────────
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipoTurno: string;
    const dataRef = new Date(agora);
    if (min >= 8 * 60 && min < 16 * 60 + 30)      tipoTurno = 'manha';
    else if (min >= 16 * 60 && min < 23 * 60 + 30) tipoTurno = 'tarde';
    else {
      tipoTurno = 'noite';
      if (min < 8 * 60 + 30) dataRef.setDate(dataRef.getDate() - 1);
    }

    const diaStr = dataRef.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFimDia = new Date(diaStr + 'T23:59:59.999Z');

    const atribuicoesTurno = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        horarioTurno: {
          tipo: tipoTurno as any,
          data: { gte: dataInicio, lte: dataFimDia },
        },
        utilizador: {
          role: { in: ['enfermeiro'] },
        },
      },
      include: {
        utilizador: { select: { id: true, nome: true } },
      },
    });

    // Agrupar doentes por enfermeiro
    const mapaEnfermeiro = new Map<string, { nome: string; numDoentes: number }>();
    for (const a of atribuicoesTurno) {
      const id = a.utilizadorId;
      if (!mapaEnfermeiro.has(id)) {
        mapaEnfermeiro.set(id, { nome: a.utilizador.nome, numDoentes: 0 });
      }
      mapaEnfermeiro.get(id)!.numDoentes++;
    }

    // Tarefas pendentes por responsável
    const tarefasPendentes = await this.prisma.tarefa.groupBy({
      by: ['responsavelId'],
      where: {
        estado: { in: ['pendente', 'em_progresso'] },
        responsavelId: { in: [...mapaEnfermeiro.keys()] },
      },
      _count: { id: true },
    });

    const mapaTarefas = new Map(tarefasPendentes.map((t) => [t.responsavelId, t._count.id]));

    const cargaEnfermeiros = [...mapaEnfermeiro.entries()].map(([id, v]) => ({
      nome: v.nome,
      numDoentes: v.numDoentes,
      tarefasPendentes: mapaTarefas.get(id) ?? 0,
    })).sort((a, b) => b.numDoentes - a.numDoentes);

    // ── Tarefas de hoje ──────────────────────────────────────────────────────
    const inicioDia = new Date(agora);
    inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(agora);
    fimDia.setHours(23, 59, 59, 999);

    const [tarefasTotal, tarefasConcluidas, urgentesAtraso] = await Promise.all([
      this.prisma.tarefa.count({
        where: { prazo: { gte: inicioDia, lte: fimDia } },
      }),
      this.prisma.tarefa.count({
        where: { prazo: { gte: inicioDia, lte: fimDia }, estado: 'concluida' },
      }),
      this.prisma.tarefa.count({
        where: {
          prioridade: 'urgente',
          estado: { in: ['pendente', 'em_progresso'] },
          prazo: { lt: agora },
        },
      }),
    ]);

    return {
      ocupacaoDiaria,
      cargaEnfermeiros,
      tarefasHoje: { total: tarefasTotal, concluidas: tarefasConcluidas, urgentesAtraso },
    };
  }

  @Get('ti')
  @Roles('ti', 'direcao')
  async dashboardTI() {
    const agora = new Date();
    const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
    const semanaAtras = new Date(agora); semanaAtras.setDate(semanaAtras.getDate() - 7);

    const [
      totalUtilizadores,
      utilizadoresPorRole,
      sessoesMobile,
      acoesHoje,
      acoesUltimaSemana,
      acoesRecentes,
      incidentesAbertos,
      incidentesEmAnalise,
      incidentesCriticos,
      incidentesResolvidosHoje,
      incidentesPorSubRole,
      incidentesPorTipo,
      incidentesRecentes,
    ] = await Promise.all([
      this.prisma.utilizador.count({ where: { ativo: true } }),
      this.prisma.utilizador.groupBy({ by: ['role'], where: { ativo: true }, _count: { id: true } }),
      this.prisma.dispositivoToken.count(),
      this.prisma.auditLog.count({ where: { createdAt: { gte: hoje } } }),
      this.prisma.auditLog.groupBy({
        by: ['acao'],
        where: { createdAt: { gte: semanaAtras } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.findMany({
        where: { createdAt: { gte: hoje } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { utilizador: { select: { nome: true, role: true } } },
      }),
      this.prisma.incidenteTI.count({ where: { estado: 'aberto' } }),
      this.prisma.incidenteTI.count({ where: { estado: 'em_analise' } }),
      this.prisma.incidenteTI.count({ where: { prioridade: 'critica', estado: { in: ['aberto', 'em_analise'] } } }),
      this.prisma.incidenteTI.count({ where: { estado: 'resolvido', atualizadoEm: { gte: hoje } } }),
      this.prisma.incidenteTI.groupBy({
        by: ['subRoleAlvo'],
        where: { estado: { in: ['aberto', 'em_analise'] } },
        _count: { id: true },
      }),
      this.prisma.incidenteTI.groupBy({
        by: ['tipo'],
        where: { estado: { in: ['aberto', 'em_analise'] } },
        _count: { id: true },
      }),
      this.prisma.incidenteTI.findMany({
        orderBy: { criadoEm: 'desc' },
        take: 10,
        include: { criadoPor: { select: { id: true, nome: true, role: true } } },
      }),
    ]);

    return {
      utilizadores: {
        total: totalUtilizadores,
        porRole: utilizadoresPorRole.map(r => ({ role: r.role, total: r._count.id })),
        sessoesMobile,
      },
      auditoria: {
        acoesHoje,
        topAcoes: acoesUltimaSemana.map(a => ({ acao: a.acao, total: a._count.id })),
        recentes: acoesRecentes.map(a => ({
          id: a.id,
          acao: a.acao,
          entidadeTipo: a.entidadeTipo,
          utilizador: a.utilizador,
          createdAt: a.createdAt,
          ip: a.ip,
        })),
      },
      incidentes: {
        abertos: incidentesAbertos,
        emAnalise: incidentesEmAnalise,
        criticos: incidentesCriticos,
        resolvidosHoje: incidentesResolvidosHoje,
        porSubRole: incidentesPorSubRole.map(g => ({ subRole: g.subRoleAlvo ?? 'sem_atribuicao', total: g._count.id })),
        porTipo: incidentesPorTipo.map(g => ({ tipo: g.tipo, total: g._count.id })),
        recentes: incidentesRecentes,
      },
    };
  }

  @Get('executivo')
  @Roles('direcao', 'administrativo')
  async dashboardExecutivo() {
    const agora = new Date();
    const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const [
      internados,
      ambulatorio,
      pendenteCama,
      todasCamas,
      camasOcupadas,
      camasLimpeza,
      camasReservadas,
      faturacaoMes,
      consultasHoje,
      trocasPendentes,
      utilizadoresPorRole,
    ] = await Promise.all([
      this.prisma.doente.count({ where: { estadoRegisto: 'internado', ativo: true } }),
      this.prisma.doente.count({ where: { estadoRegisto: 'ambulatorio', ativo: true } }),
      this.prisma.doente.count({ where: { estadoRegisto: 'pendente_cama', ativo: true } }),
      this.prisma.cama.count(),
      this.prisma.cama.count({ where: { estado: 'ocupada' } }),
      this.prisma.cama.count({ where: { estado: 'em_limpeza' } }),
      this.prisma.cama.count({ where: { estado: 'reservada' } }),
      this.prisma.episodioFaturacao.findMany({
        where: { criadoEm: { gte: inicioMes } },
        select: { totalCobrado: true, estado: true, tipoCobertura: true },
      }),
      this.prisma.consulta.findMany({
        where: { dataHora: { gte: hoje, lt: amanha } },
        select: { estado: true },
      }),
      this.prisma.pedidoTrocaTurno.count({ where: { estado: 'pendente' } }),
      this.prisma.utilizador.groupBy({ by: ['role'], where: { ativo: true }, _count: { id: true } }),
    ]);

    // Calcular média de internamento em dias
    const doentesCama = await this.prisma.doente.findMany({
      where: { estadoRegisto: 'internado', ativo: true },
      select: { dataAdmissao: true },
    });
    const mediaInternamento = doentesCama.length > 0
      ? Math.round(doentesCama.reduce((acc, d) => acc + (agora.getTime() - d.dataAdmissao.getTime()) / (1000 * 60 * 60 * 24), 0) / doentesCama.length)
      : 0;

    // Faturação breakdown
    const totalMes = faturacaoMes.reduce((a, f) => a + f.totalCobrado, 0);
    const pagoMes = faturacaoMes.filter(f => f.estado === 'paga').reduce((a, f) => a + f.totalCobrado, 0);
    const pendenteMes = faturacaoMes.filter(f => f.estado === 'pendente').reduce((a, f) => a + f.totalCobrado, 0);
    const porCobertura = { sns: 0, seguro: 0, particular: 0 };
    for (const f of faturacaoMes) {
      const k = (f.tipoCobertura ?? 'sns') as keyof typeof porCobertura;
      if (k in porCobertura) porCobertura[k] += f.totalCobrado;
    }

    // Consultas hoje
    const totalConsultas = consultasHoje.length;
    const faltaram = consultasHoje.filter(c => c.estado === 'faltou').length;

    return {
      doentes: {
        internados,
        ambulatorio,
        pendenteCama,
        mediaInternamento,
      },
      camas: {
        total: todasCamas,
        ocupadas: camasOcupadas,
        livres: todasCamas - camasOcupadas - camasLimpeza - camasReservadas,
        limpeza: camasLimpeza,
        reservadas: camasReservadas,
        taxaOcupacao: todasCamas > 0 ? Math.round((camasOcupadas / todasCamas) * 100) : 0,
      },
      faturacao: {
        totalMes: Math.round(totalMes * 100) / 100,
        pagoMes: Math.round(pagoMes * 100) / 100,
        pendenteMes: Math.round(pendenteMes * 100) / 100,
        porCobertura,
      },
      consultasHoje: {
        total: totalConsultas,
        faltaram,
        taxaNoShow: totalConsultas > 0 ? Math.round((faltaram / totalConsultas) * 100) : 0,
      },
      trocasPendentes,
      pessoal: {
        utilizadoresPorRole: utilizadoresPorRole.reduce((acc, r) => {
          acc[r.role] = r._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    };
  }

  @Get('pessoal')
  @Roles('direcao', 'administrativo')
  async dashboardPessoal() {
    const agora = new Date();
    const seteDiasAtras = new Date(agora); seteDiasAtras.setDate(agora.getDate() - 7);
    const trintaDiasAtras = new Date(agora); trintaDiasAtras.setDate(agora.getDate() - 30);

    const [utilizadoresPorRole, trocas30d, horariosTurno7d] = await Promise.all([
      this.prisma.utilizador.groupBy({ by: ['role'], where: { ativo: true }, _count: { id: true } }),
      this.prisma.pedidoTrocaTurno.groupBy({
        by: ['estado'],
        where: { criadoEm: { gte: trintaDiasAtras } },
        _count: { id: true },
      }),
      this.prisma.horarioTurno.findMany({
        where: { data: { gte: seteDiasAtras } },
        include: { profissionais: { select: { id: true } } },
      }),
    ]);

    const turnosCobertos = horariosTurno7d.filter(t => t.profissionais.length > 0).length;

    return {
      utilizadoresPorRole: utilizadoresPorRole.reduce((acc, r) => {
        acc[r.role] = r._count.id;
        return acc;
      }, {} as Record<string, number>),
      turnosCobertos7d: turnosCobertos,
      turnosSemCobertura7d: horariosTurno7d.length - turnosCobertos,
      trocas30d: {
        pendente: trocas30d.find(t => t.estado === 'pendente')?._count.id ?? 0,
        aprovado: trocas30d.find(t => t.estado === 'aprovado')?._count.id ?? 0,
        recusado: trocas30d.find(t => t.estado === 'recusado')?._count.id ?? 0,
      },
    };
  }

  @Get('workload-turno')
  @Roles('enfermeiro', 'medico', 'auxiliar')
  async workloadTurno(@Request() req: any) {
    const agora = new Date();
    const oitoHorasAtras = new Date(agora.getTime() - 8 * 60 * 60 * 1000);
    const min = agora.getHours() * 60 + agora.getMinutes();
    const dataRef = new Date(agora);
    let tipoTurno: string;
    if (min >= 8 * 60 && min < 16 * 60 + 30)       tipoTurno = 'manha';
    else if (min >= 16 * 60 && min < 23 * 60 + 30)  tipoTurno = 'tarde';
    else {
      tipoTurno = 'noite';
      if (min < 8 * 60 + 30) dataRef.setDate(dataRef.getDate() - 1);
    }
    const diaStr = dataRef.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFimDia = new Date(diaStr + 'T23:59:59.999Z');

    // Encontrar doentes atribuídos ao utilizador no turno atual
    const atribuicoes = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        utilizadorId: req.user.sub,
        horarioTurno: {
          tipo: tipoTurno as any,
          data: { gte: dataInicio, lte: dataFimDia },
        },
      },
      include: {
        doente: {
          select: {
            id: true, nome: true,
            cama: { select: { numero: true, quarto: true } },
          },
        },
      },
    });

    const doenteIds = atribuicoes.filter(a => a.doente).map(a => a.doenteId!);

    if (doenteIds.length === 0) return [];

    const resultado = await Promise.all(doenteIds.map(async (doenteId) => {
      const doente = atribuicoes.find(a => a.doenteId === doenteId)?.doente;

      const [medicacoesPendentes, tarefasAtrasadas, alertasNaoLidos, ultimoSinalVital] = await Promise.all([
        this.prisma.medicacao.count({
          where: {
            doenteId,
            estado: 'pendente',
            registos: { none: { administradoEm: { gte: oitoHorasAtras } } },
          },
        }),
        this.prisma.tarefa.count({
          where: {
            doenteId,
            estado: { in: ['pendente', 'em_progresso'] },
            prazo: { lt: agora },
          },
        }),
        this.prisma.alertaClinico.count({ where: { doenteId, lido: false } }),
        this.prisma.sinalVital.findFirst({
          where: { doenteId },
          orderBy: { registadoEm: 'desc' },
          select: { registadoEm: true },
        }),
      ]);

      return {
        doente: {
          id: doenteId,
          nome: doente?.nome ?? '',
          cama: doente?.cama?.numero ?? null,
          quarto: doente?.cama?.quarto ?? null,
        },
        medicacoesPendentes,
        tarefasAtrasadas,
        alertasNaoLidos,
        ultimoSinalVital: ultimoSinalVital?.registadoEm?.toISOString() ?? null,
      };
    }));

    return resultado;
  }

  @Get('qualidade')
  @Roles('qualidade', 'direcao', 'medico', 'enfermeiro')
  async dashboardQualidade() {
    const agora = new Date();
    const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
    const tresDiasAtras = new Date(agora); tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
    const seteDiasAtras = new Date(agora); seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const trintaDiasAtras = new Date(agora); trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const [
      // IACS
      totalIsolados,
      isoladosPorMotivo,
      // Alertas clínicos
      alertasNaoLidos,
      alertasPorTipo,
      alertasRecentes,
      // Avaliações de risco
      avaliacoesAltoRisco,
      avaliacoesPorTipo,
      // Doentes críticos
      doentesCriticos,
      doentesInstáveis,
      // Taxa alta
      doentesComAlta30Dias,
      doentesComSumarioAlta,
      // Medicação
      medicacaoPendenteHoje,
      medicacaoAdministradaHoje,
      // Ocupação atual
      totalCamas,
      camasOcupadas,
    ] = await Promise.all([
      // IACS
      this.prisma.doente.count({ where: { emIsolamento: true, ativo: true } }),
      this.prisma.doente.groupBy({
        by: ['motivoIsolamento'],
        where: { emIsolamento: true, ativo: true },
        _count: { id: true },
      }),
      // Alertas
      this.prisma.alertaClinico.count({ where: { lido: false } }),
      this.prisma.alertaClinico.groupBy({
        by: ['tipo'],
        where: { lido: false },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.alertaClinico.findMany({
        where: { lido: false },
        orderBy: { criadoEm: 'desc' },
        take: 10,
        include: { doente: { select: { id: true, nome: true, numeroProcesso: true } } },
      }),
      // Avaliações de risco
      this.prisma.avaliacaoRisco.count({ where: { risco: { in: ['alto', 'critico'] }, criadaEm: { gte: seteDiasAtras } } }),
      this.prisma.avaliacaoRisco.groupBy({
        by: ['tipo'],
        where: { criadaEm: { gte: seteDiasAtras } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Doentes críticos
      this.prisma.doente.count({ where: { estado: 'critico', ativo: true } }),
      this.prisma.doente.count({ where: { estado: 'instavel', ativo: true } }),
      // Taxa de alta com sumário
      this.prisma.doente.count({ where: { dataAlta: { gte: trintaDiasAtras }, ativo: false } }),
      this.prisma.sumarioAlta.count({ where: { criadoEm: { gte: trintaDiasAtras } } }),
      // Medicação
      this.prisma.medicacao.count({
        where: {
          estado: 'pendente',
          doente: { ativo: true },
        },
      }),
      this.prisma.registoMedicacao.count({ where: { administradoEm: { gte: hoje } } }),
      // Camas
      this.prisma.cama.count(),
      this.prisma.doente.count({ where: { ativo: true } }),
    ]);

    // Tendência de isolamentos nos últimos 7 dias
    const tendenciaIsolamentos: Array<{ data: string; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dia = new Date(agora);
      dia.setDate(dia.getDate() - i);
      dia.setHours(23, 59, 59, 999);
      const iniciodia = new Date(dia); iniciodia.setHours(0, 0, 0, 0);
      const count = await this.prisma.doente.count({
        where: {
          emIsolamento: true,
          dataAdmissao: { lte: dia },
          OR: [{ dataAlta: null }, { dataAlta: { gte: iniciodia } }],
        },
      });
      tendenciaIsolamentos.push({ data: iniciodia.toISOString().split('T')[0], total: count });
    }

    const taxaAlta = doentesComAlta30Dias > 0
      ? Math.round((doentesComSumarioAlta / doentesComAlta30Dias) * 100)
      : 0;

    return {
      iacs: {
        totalIsolados,
        porMotivo: isoladosPorMotivo.map(g => ({ motivo: g.motivoIsolamento ?? 'Desconhecido', total: g._count.id })),
        tendencia: tendenciaIsolamentos,
      },
      alertas: {
        naoLidos: alertasNaoLidos,
        porTipo: alertasPorTipo.map(g => ({ tipo: g.tipo, total: g._count.id })),
        recentes: alertasRecentes,
      },
      riscos: {
        altoRisco7Dias: avaliacoesAltoRisco,
        porTipo: avaliacoesPorTipo.map(g => ({ tipo: g.tipo, total: g._count.id })),
      },
      doentes: {
        criticos: doentesCriticos,
        instaveis: doentesInstáveis,
        ocupacao: { total: totalCamas, ocupadas: camasOcupadas, taxa: totalCamas > 0 ? Math.round((camasOcupadas / totalCamas) * 100) : 0 },
      },
      alta: {
        altas30Dias: doentesComAlta30Dias,
        comSumario: doentesComSumarioAlta,
        taxaComplitude: taxaAlta,
      },
      medicacao: {
        pendentes: medicacaoPendenteHoje,
        administradasHoje: medicacaoAdministradaHoje,
      },
    };
  }
}

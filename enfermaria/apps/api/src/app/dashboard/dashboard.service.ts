import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private turnoAtual() {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    const dataRef = new Date(agora);
    let tipoTurno: string;
    if (min >= 8 * 60 && min < 16 * 60 + 30)      tipoTurno = 'manha';
    else if (min >= 16 * 60 && min < 23 * 60 + 30) tipoTurno = 'tarde';
    else {
      tipoTurno = 'noite';
      if (min < 8 * 60 + 30) dataRef.setDate(dataRef.getDate() - 1);
    }
    const diaStr = dataRef.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFimDia = new Date(diaStr + 'T23:59:59.999Z');
    return { tipoTurno, dataInicio, dataFimDia, agora };
  }

  async analytics() {
    const agora = new Date();

    // Ocupação diária nos últimos 14 dias — 1 query por dia (14 queries total, paralelas)
    const totalCamas = await this.prisma.cama.count();
    const diasOcupacao = await Promise.all(
      Array.from({ length: 14 }, (_, i) => {
        const dia = new Date(agora);
        dia.setDate(dia.getDate() - (13 - i));
        dia.setHours(23, 59, 59, 999);
        const iniciodia = new Date(dia);
        iniciodia.setHours(0, 0, 0, 0);
        return this.prisma.doente.count({
          where: {
            dataAdmissao: { lte: dia },
            OR: [{ dataAlta: null }, { dataAlta: { gte: iniciodia } }],
          },
        }).then((ocupadas) => ({
          data: iniciodia.toISOString().split('T')[0],
          total: totalCamas,
          ocupadas,
        }));
      }),
    );

    // Carga dos enfermeiros no turno actual
    const { tipoTurno, dataInicio, dataFimDia } = this.turnoAtual();
    const atribuicoesTurno = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        horarioTurno: { tipo: tipoTurno as any, data: { gte: dataInicio, lte: dataFimDia } },
        utilizador: { role: { in: ['enfermeiro'] } },
      },
      include: { utilizador: { select: { id: true, nome: true } } },
    });

    const mapaEnfermeiro = new Map<string, { nome: string; numDoentes: number }>();
    for (const a of atribuicoesTurno) {
      const id = a.utilizadorId;
      if (!mapaEnfermeiro.has(id)) mapaEnfermeiro.set(id, { nome: a.utilizador.nome, numDoentes: 0 });
      mapaEnfermeiro.get(id)!.numDoentes++;
    }

    const tarefasPendentesGrupo = await this.prisma.tarefa.groupBy({
      by: ['responsavelId'],
      where: { estado: { in: ['pendente', 'em_progresso'] }, responsavelId: { in: [...mapaEnfermeiro.keys()] } },
      _count: { id: true },
    });
    const mapaTarefas = new Map(tarefasPendentesGrupo.map((t) => [t.responsavelId, t._count.id]));
    const cargaEnfermeiros = [...mapaEnfermeiro.entries()]
      .map(([id, v]) => ({ nome: v.nome, numDoentes: v.numDoentes, tarefasPendentes: mapaTarefas.get(id) ?? 0 }))
      .sort((a, b) => b.numDoentes - a.numDoentes);

    // Tarefas do dia
    const inicioDia = new Date(agora); inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(agora); fimDia.setHours(23, 59, 59, 999);
    const [tarefasTotal, tarefasConcluidas, urgentesAtraso] = await Promise.all([
      this.prisma.tarefa.count({ where: { prazo: { gte: inicioDia, lte: fimDia } } }),
      this.prisma.tarefa.count({ where: { prazo: { gte: inicioDia, lte: fimDia }, estado: 'concluida' } }),
      this.prisma.tarefa.count({ where: { prioridade: 'urgente', estado: { in: ['pendente', 'em_progresso'] }, prazo: { lt: agora } } }),
    ]);

    return {
      ocupacaoDiaria: diasOcupacao,
      cargaEnfermeiros,
      tarefasHoje: { total: tarefasTotal, concluidas: tarefasConcluidas, urgentesAtraso },
    };
  }

  async dashboardTI() {
    const agora = new Date();
    const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
    const semanaAtras = new Date(agora); semanaAtras.setDate(semanaAtras.getDate() - 7);

    const [
      totalUtilizadores, utilizadoresPorRole, sessoesMobile,
      acoesHoje, acoesUltimaSemana, acoesRecentes,
      incidentesAbertos, incidentesEmAnalise, incidentesCriticos,
      incidentesResolvidosHoje, incidentesPorSubRole, incidentesPorTipo, incidentesRecentes,
    ] = await Promise.all([
      this.prisma.utilizador.count({ where: { ativo: true } }),
      this.prisma.utilizador.groupBy({ by: ['role'], where: { ativo: true }, _count: { id: true } }),
      this.prisma.dispositivoToken.count(),
      this.prisma.auditLog.count({ where: { createdAt: { gte: hoje } } }),
      this.prisma.auditLog.groupBy({ by: ['acao'], where: { createdAt: { gte: semanaAtras } }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
      this.prisma.auditLog.findMany({ where: { createdAt: { gte: hoje } }, orderBy: { createdAt: 'desc' }, take: 20, include: { utilizador: { select: { nome: true, role: true } } } }),
      this.prisma.incidenteTI.count({ where: { estado: 'aberto' } }),
      this.prisma.incidenteTI.count({ where: { estado: 'em_analise' } }),
      this.prisma.incidenteTI.count({ where: { prioridade: 'critica', estado: { in: ['aberto', 'em_analise'] } } }),
      this.prisma.incidenteTI.count({ where: { estado: 'resolvido', atualizadoEm: { gte: hoje } } }),
      this.prisma.incidenteTI.groupBy({ by: ['subRoleAlvo'], where: { estado: { in: ['aberto', 'em_analise'] } }, _count: { id: true } }),
      this.prisma.incidenteTI.groupBy({ by: ['tipo'], where: { estado: { in: ['aberto', 'em_analise'] } }, _count: { id: true } }),
      this.prisma.incidenteTI.findMany({ orderBy: { criadoEm: 'desc' }, take: 10, include: { criadoPor: { select: { id: true, nome: true, role: true } } } }),
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
        recentes: acoesRecentes.map(a => ({ id: a.id, acao: a.acao, entidadeTipo: a.entidadeTipo, utilizador: a.utilizador, createdAt: a.createdAt, ip: a.ip })),
      },
      incidentes: {
        abertos: incidentesAbertos, emAnalise: incidentesEmAnalise, criticos: incidentesCriticos,
        resolvidosHoje: incidentesResolvidosHoje,
        porSubRole: incidentesPorSubRole.map(g => ({ subRole: g.subRoleAlvo ?? 'sem_atribuicao', total: g._count.id })),
        porTipo: incidentesPorTipo.map(g => ({ tipo: g.tipo, total: g._count.id })),
        recentes: incidentesRecentes,
      },
    };
  }

  async dashboardExecutivo() {
    const agora = new Date();
    const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const [
      internados, ambulatorio, pendenteCama,
      todasCamas, camasOcupadas, camasLimpeza, camasReservadas,
      faturacaoMes, consultasHoje, trocasPendentes, utilizadoresPorRole,
      episodiosUrgenciaHoje, cirurgiasMesRaw, ausenciasAtivas,
    ] = await Promise.all([
      this.prisma.doente.count({ where: { estadoRegisto: 'internado', ativo: true } }),
      this.prisma.doente.count({ where: { estadoRegisto: 'ambulatorio', ativo: true } }),
      this.prisma.doente.count({ where: { estadoRegisto: 'pendente_cama', ativo: true } }),
      this.prisma.cama.count(),
      this.prisma.cama.count({ where: { estado: 'ocupada' } }),
      this.prisma.cama.count({ where: { estado: 'em_limpeza' } }),
      this.prisma.cama.count({ where: { estado: 'reservada' } }),
      this.prisma.episodioFaturacao.findMany({ where: { criadoEm: { gte: inicioMes } }, select: { totalCobrado: true, estado: true, tipoCobertura: true } }),
      this.prisma.consulta.findMany({ where: { dataHora: { gte: hoje, lt: amanha } }, select: { estado: true } }),
      this.prisma.pedidoTrocaTurno.count({ where: { estado: 'pendente' } }),
      this.prisma.utilizador.groupBy({ by: ['role'], where: { ativo: true }, _count: { id: true } }),
      this.prisma.episodioUrgencia.groupBy({ by: ['estado'], where: { criadoEm: { gte: hoje } }, _count: { id: true } }).catch(() => []),
      this.prisma.cirurgiaProgramada.groupBy({ by: ['estado'], where: { dataHora: { gte: inicioMes } }, _count: { id: true } }).catch(() => []),
      this.prisma.ausencia.count({ where: { estado: 'aprovada', dataInicio: { lte: agora }, dataFim: { gte: agora } } }).catch(() => 0),
    ]);

    // Tendência de ocupação — 14 dias
    const totalCamas = await this.prisma.cama.count();
    const tendenciaOcupacao = await Promise.all(
      Array.from({ length: 14 }, (_, i) => {
        const dia = new Date(agora); dia.setDate(dia.getDate() - (13 - i)); dia.setHours(23, 59, 59, 999);
        const inicioDia = new Date(dia); inicioDia.setHours(0, 0, 0, 0);
        return this.prisma.doente.count({
          where: { dataAdmissao: { lte: dia }, OR: [{ dataAlta: null }, { dataAlta: { gte: inicioDia } }] },
        }).then((ocupadas) => ({
          data: inicioDia.toISOString().split('T')[0],
          ocupadas,
          total: totalCamas,
          taxa: totalCamas > 0 ? Math.round((ocupadas / totalCamas) * 100) : 0,
        }));
      }),
    );

    // Tendência de faturação — 6 meses
    const tendenciaFaturacao = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const data = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1);
        const fimMes = new Date(data.getFullYear(), data.getMonth() + 1, 1);
        return this.prisma.episodioFaturacao.aggregate({
          where: { criadoEm: { gte: data, lt: fimMes } },
          _sum: { totalCobrado: true },
        }).then((r) => ({
          mes: data.toLocaleString('pt-PT', { month: 'short' }),
          total: Math.round((r._sum.totalCobrado ?? 0) * 100) / 100,
        }));
      }),
    );

    const doentesCama = await this.prisma.doente.findMany({
      where: { estadoRegisto: 'internado', ativo: true },
      select: { dataAdmissao: true },
    });
    const mediaInternamento = doentesCama.length > 0
      ? Math.round(doentesCama.reduce((acc, d) => acc + (agora.getTime() - d.dataAdmissao.getTime()) / (1000 * 60 * 60 * 24), 0) / doentesCama.length)
      : 0;

    const totalMes = faturacaoMes.reduce((a, f) => a + f.totalCobrado, 0);
    const pagoMes = faturacaoMes.filter(f => f.estado === 'paga').reduce((a, f) => a + f.totalCobrado, 0);
    const pendenteMes = faturacaoMes.filter(f => f.estado === 'pendente').reduce((a, f) => a + f.totalCobrado, 0);
    const porCobertura = { sns: 0, seguro: 0, particular: 0 };
    for (const f of faturacaoMes) {
      const k = (f.tipoCobertura ?? 'sns') as keyof typeof porCobertura;
      if (k in porCobertura) porCobertura[k] += f.totalCobrado;
    }

    const countUrg = (estado: string) => (episodiosUrgenciaHoje as any[]).find(e => e.estado === estado)?._count?.id ?? 0;
    const countCir = (estado: string) => (cirurgiasMesRaw as any[]).find(e => e.estado === estado)?._count?.id ?? 0;

    const faltaram = consultasHoje.filter(c => c.estado === 'faltou').length;
    return {
      doentes: { internados, ambulatorio, pendenteCama, mediaInternamento },
      camas: {
        total: todasCamas, ocupadas: camasOcupadas,
        livres: todasCamas - camasOcupadas - camasLimpeza - camasReservadas,
        limpeza: camasLimpeza, reservadas: camasReservadas,
        taxaOcupacao: todasCamas > 0 ? Math.round((camasOcupadas / todasCamas) * 100) : 0,
      },
      faturacao: { totalMes: Math.round(totalMes * 100) / 100, pagoMes: Math.round(pagoMes * 100) / 100, pendenteMes: Math.round(pendenteMes * 100) / 100, porCobertura },
      consultasHoje: { total: consultasHoje.length, faltaram, taxaNoShow: consultasHoje.length > 0 ? Math.round((faltaram / consultasHoje.length) * 100) : 0 },
      trocasPendentes,
      pessoal: { utilizadoresPorRole: utilizadoresPorRole.reduce((acc, r) => { acc[r.role] = r._count.id; return acc; }, {} as Record<string, number>) },
      tendenciaOcupacao,
      tendenciaFaturacao,
      urgenciaHoje: {
        total: (episodiosUrgenciaHoje as any[]).reduce((a: number, e: any) => a + (e._count?.id ?? 0), 0),
        emAtendimento: countUrg('em_atendimento') + countUrg('em_observacao'),
        aguardaAlta: countUrg('alta_urgencia') + countUrg('aguarda_resultado'),
        alta: countUrg('alta'),
      },
      cirurgiasMes: {
        total: (cirurgiasMesRaw as any[]).reduce((a: number, e: any) => a + (e._count?.id ?? 0), 0),
        concluidas: countCir('concluida'),
        emCurso: countCir('em_curso'),
        canceladas: countCir('cancelada'),
      },
      ausenciasAtivas,
    };
  }

  async dashboardPessoal() {
    const agora = new Date();
    const seteDiasAtras = new Date(agora); seteDiasAtras.setDate(agora.getDate() - 7);
    const trintaDiasAtras = new Date(agora); trintaDiasAtras.setDate(agora.getDate() - 30);

    const [utilizadoresPorRole, trocas30d, horariosTurno7d] = await Promise.all([
      this.prisma.utilizador.groupBy({ by: ['role'], where: { ativo: true }, _count: { id: true } }),
      this.prisma.pedidoTrocaTurno.groupBy({ by: ['estado'], where: { criadoEm: { gte: trintaDiasAtras } }, _count: { id: true } }),
      this.prisma.horarioTurno.findMany({ where: { data: { gte: seteDiasAtras } }, include: { profissionais: { select: { id: true } } } }),
    ]);

    const turnosCobertos = horariosTurno7d.filter(t => t.profissionais.length > 0).length;
    return {
      utilizadoresPorRole: utilizadoresPorRole.reduce((acc, r) => { acc[r.role] = r._count.id; return acc; }, {} as Record<string, number>),
      turnosCobertos7d: turnosCobertos,
      turnosSemCobertura7d: horariosTurno7d.length - turnosCobertos,
      trocas30d: {
        pendente: trocas30d.find(t => t.estado === 'pendente')?._count.id ?? 0,
        aprovado: trocas30d.find(t => t.estado === 'aprovado')?._count.id ?? 0,
        recusado: trocas30d.find(t => t.estado === 'recusado')?._count.id ?? 0,
      },
    };
  }

  async workloadTurno(utilizadorId: string) {
    const agora = new Date();
    const oitoHorasAtras = new Date(agora.getTime() - 8 * 60 * 60 * 1000);
    const { tipoTurno, dataInicio, dataFimDia } = this.turnoAtual();

    const atribuicoes = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        utilizadorId,
        horarioTurno: { tipo: tipoTurno as any, data: { gte: dataInicio, lte: dataFimDia } },
      },
      include: { doente: { select: { id: true, nome: true, cama: { select: { numero: true, quarto: true } } } } },
    });

    const doenteIds = atribuicoes.filter(a => a.doente).map(a => a.doenteId!);
    if (doenteIds.length === 0) return [];

    return Promise.all(doenteIds.map(async (doenteId) => {
      const doente = atribuicoes.find(a => a.doenteId === doenteId)?.doente;
      const [medicacoesPendentes, tarefasAtrasadas, alertasNaoLidos, ultimoSinalVital] = await Promise.all([
        this.prisma.medicacao.count({
          where: { doenteId, estado: 'pendente', registos: { none: { administradoEm: { gte: oitoHorasAtras } } } },
        }),
        this.prisma.tarefa.count({
          where: { doenteId, estado: { in: ['pendente', 'em_progresso'] }, prazo: { lt: agora } },
        }),
        this.prisma.alertaClinico.count({ where: { doenteId, lido: false } }),
        this.prisma.sinalVital.findFirst({
          where: { doenteId },
          orderBy: { data: 'desc' },
          select: { data: true },
        }),
      ]);
      return {
        doente: { id: doenteId, nome: doente?.nome ?? '', cama: doente?.cama?.numero ?? null, quarto: doente?.cama?.quarto ?? null },
        medicacoesPendentes,
        tarefasAtrasadas,
        alertasNaoLidos,
        ultimoSinalVital: ultimoSinalVital?.data?.toISOString() ?? null,
      };
    }));
  }

  async dashboardQualidade() {
    const agora = new Date();
    const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
    const seteDiasAtras = new Date(agora); seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const trintaDiasAtras = new Date(agora); trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const [
      totalIsolados, isoladosPorMotivo,
      alertasNaoLidos, alertasPorTipo, alertasRecentes,
      avaliacoesAltoRisco, avaliacoesPorTipo,
      doentesCriticos, doentesInstaveis,
      doentesComAlta30Dias, doentesComSumarioAlta,
      medicacaoPendenteHoje, medicacaoAdministradaHoje,
      totalCamas, camasOcupadas,
    ] = await Promise.all([
      this.prisma.doente.count({ where: { emIsolamento: true, ativo: true } }),
      this.prisma.doente.groupBy({ by: ['motivoIsolamento'], where: { emIsolamento: true, ativo: true }, _count: { id: true } }),
      this.prisma.alertaClinico.count({ where: { lido: false } }),
      this.prisma.alertaClinico.groupBy({ by: ['tipo'], where: { lido: false }, _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
      this.prisma.alertaClinico.findMany({ where: { lido: false }, orderBy: { criadoEm: 'desc' }, take: 10, include: { doente: { select: { id: true, nome: true, numeroProcesso: true } } } }),
      this.prisma.avaliacaoRisco.count({ where: { risco: { in: ['alto', 'critico'] }, criadaEm: { gte: seteDiasAtras } } }),
      this.prisma.avaliacaoRisco.groupBy({ by: ['tipo'], where: { criadaEm: { gte: seteDiasAtras } }, _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
      this.prisma.doente.count({ where: { estado: 'critico', ativo: true } }),
      this.prisma.doente.count({ where: { estado: 'grave', ativo: true } }),
      this.prisma.doente.count({ where: { dataAlta: { gte: trintaDiasAtras }, ativo: false } }),
      this.prisma.sumarioAlta.count({ where: { criadoEm: { gte: trintaDiasAtras } } }),
      this.prisma.medicacao.count({ where: { estadoValidacao: 'pendente', doente: { ativo: true } } }),
      this.prisma.registoMedicacao.count({ where: { administradoEm: { gte: hoje } } }),
      this.prisma.cama.count(),
      this.prisma.doente.count({ where: { ativo: true } }),
    ]);

    // Fix N+1: buscar todos os isolados de uma vez e filtrar em memória por data
    const isoladosHistorico = await this.prisma.doente.findMany({
      where: {
        emIsolamento: true,
        dataAdmissao: { lte: agora },
        OR: [{ dataAlta: null }, { dataAlta: { gte: seteDiasAtras } }],
      },
      select: { dataAdmissao: true, dataAlta: true },
    });

    const tendenciaIsolamentos = Array.from({ length: 7 }, (_, i) => {
      const offset = 6 - i;
      const dia = new Date(agora); dia.setDate(dia.getDate() - offset); dia.setHours(23, 59, 59, 999);
      const iniciodia = new Date(dia); iniciodia.setHours(0, 0, 0, 0);
      const total = isoladosHistorico.filter(d =>
        d.dataAdmissao <= dia && (d.dataAlta === null || d.dataAlta >= iniciodia),
      ).length;
      return { data: iniciodia.toISOString().split('T')[0], total };
    });

    const taxaAlta = doentesComAlta30Dias > 0 ? Math.round((doentesComSumarioAlta / doentesComAlta30Dias) * 100) : 0;

    return {
      iacs: {
        totalIsolados,
        porMotivo: isoladosPorMotivo.map(g => ({ motivo: g.motivoIsolamento ?? 'Desconhecido', total: g._count.id })),
        tendencia: tendenciaIsolamentos,
      },
      alertas: { naoLidos: alertasNaoLidos, porTipo: alertasPorTipo.map(g => ({ tipo: g.tipo, total: g._count.id })), recentes: alertasRecentes },
      riscos: { altoRisco7Dias: avaliacoesAltoRisco, porTipo: avaliacoesPorTipo.map(g => ({ tipo: g.tipo, total: g._count.id })) },
      doentes: {
        criticos: doentesCriticos, instaveis: doentesInstaveis,
        ocupacao: { total: totalCamas, ocupadas: camasOcupadas, taxa: totalCamas > 0 ? Math.round((camasOcupadas / totalCamas) * 100) : 0 },
      },
      alta: { altas30Dias: doentesComAlta30Dias, comSumario: doentesComSumarioAlta, taxaComplitude: taxaAlta },
      medicacao: { pendentes: medicacaoPendenteHoje, administradasHoje: medicacaoAdministradaHoje },
    };
  }

  async news2Distribuicao() {
    const doentesAtivos = await this.prisma.doente.findMany({
      where: { ativo: true, deletedAt: null },
      select: {
        id: true,
        estado: true,
        sinaisVitais: {
          where: { news2: { not: null } },
          orderBy: { data: 'desc' },
          take: 1,
          select: { news2: true, data: true },
        },
      },
    });

    const distribuicao = { baixo: 0, medio: 0, alto: 0, semRegisto: 0 };
    const porAcuidade = { estavel: 0, grave: 0, critico: 0 };

    for (const d of doentesAtivos) {
      // Acuidade
      if (d.estado === 'critico') porAcuidade.critico++;
      else if (d.estado === 'grave') porAcuidade.grave++;
      else porAcuidade.estavel++;

      // NEWS2
      const news2 = d.sinaisVitais[0]?.news2 ?? null;
      if (news2 == null) distribuicao.semRegisto++;
      else if (news2 <= 4) distribuicao.baixo++;
      else if (news2 <= 6) distribuicao.medio++;
      else distribuicao.alto++;
    }

    return {
      totalAtivos: doentesAtivos.length,
      news2: distribuicao,
      acuidade: porAcuidade,
    };
  }
}

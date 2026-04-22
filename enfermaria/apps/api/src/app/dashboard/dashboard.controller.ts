import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
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
}

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { chaveDiaClinico } from '../common/clinico/dia-clinico.helper';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { turnoEmCurso } from '../common/clinico/turno-em-curso';
@Injectable()
export class AtribuicoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /**
   * UX-10 — "Pedir atribuição": quem abre a ficha de um doente a que não está atribuído pede à
   * chefia (chefe de enfermagem / chefe de turno ativos) que o atribua. Não devolve nada do doente
   * a quem pede — só confirma que o pedido seguiu, e a quantos.
   */
  async pedirAtribuicao(doenteId: string, utilizadorId: string, nota?: string) {
    const [doente, quem] = await Promise.all([
      this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true, nome: true, cama: { select: { numero: true } } } }),
      this.prisma.utilizador.findUnique({ where: { id: utilizadorId }, select: { nome: true } }),
    ]);
    if (!doente) throw new NotFoundException('Doente não encontrado');
    const chefes = await this.prisma.utilizador.findMany({
      where: { ativo: true, OR: [{ subRole: { in: ['chefe_enfermeiros', 'chefe_turno'] } }, { role: { in: ['chefe_enfermeiros', 'chefe_turno'] } }] },
      select: { id: true },
    });
    const corpo = `${quem?.nome ?? 'Um profissional'} pede para ser atribuído a ${doente.nome}${doente.cama ? ` (cama ${doente.cama.numero})` : ''}.${nota ? ` Nota: ${nota.slice(0, 300)}` : ''}`;
    await this.notificacoes.enviarParaUtilizadores(chefes.map((c) => c.id), 'Pedido de atribuição', corpo, { doenteId, tipo: 'pedido_atribuicao', nivel: 'aviso' });
    return { enviado: chefes.length > 0, destinatarios: chefes.length };
  }

  // Retorna o turno ativo agora (ou do dia de hoje pelo tipo)
  async turnoAtivo() {
    // UX-12: antes "manhã 7–15, tarde 15–23, noite 23–7" — outra definição, só aqui.
    const t = turnoEmCurso();
    const tipo = t.tipo;
    const dataInicio = t.data.gte;
    const dataFim = t.data.lte;

    const turno = await this.prisma.horarioTurno.findFirst({
      where: { tipo: tipo as any, data: { gte: dataInicio, lte: dataFim } },
      include: {
        profissionais: {
          include: {
            utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true, equipa: true } },
          },
        },
        atribuicoes: {
          include: {
            doente: { select: { id: true, nome: true, numeroProcesso: true, estado: true, diagnosticoPrincipal: true, cama: true } },
            utilizador: { select: { id: true, nome: true, role: true } },
          },
        },
      },
    });

    return turno;
  }

  // Retorna turno por id com atribuições
  async buscarTurno(turnoId: string) {
    const turno = await this.prisma.horarioTurno.findUnique({
      where: { id: turnoId },
      include: {
        profissionais: {
          include: {
            utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true, equipa: true } },
          },
        },
        atribuicoes: {
          include: {
            doente: { select: { id: true, nome: true, numeroProcesso: true, estado: true, diagnosticoPrincipal: true, cama: true } },
            utilizador: { select: { id: true, nome: true, role: true } },
          },
        },
      },
    });

    if (!turno) throw new NotFoundException('Turno não encontrado');
    return turno;
  }

  // Chefe do turno = profissional com menor ordemExperiencia no grupo de roles indicado
  chefeDeTurno(turno: any, grupo: string[]): string | null {
    const profissionais = turno.profissionais
      .filter((p: any) => grupo.includes(p.utilizador.role))
      .sort((a: any, b: any) => (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999));
    return profissionais[0]?.utilizador.id ?? null;
  }

  // Atribuir doente a profissional no turno
  async atribuir(turnoId: string, doenteId: string, utilizadorId: string, atribuidoPorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const turno = await tx.horarioTurno.findUnique({
        where: { id: turnoId },
        include: {
          profissionais: {
            include: { utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true, equipa: true } } },
          },
          atribuicoes: {
            include: {
              doente: { select: { id: true, nome: true, numeroProcesso: true, estado: true, diagnosticoPrincipal: true, cama: true } },
              utilizador: { select: { id: true, nome: true, role: true } },
            },
          },
        },
      });
      if (!turno) throw new NotFoundException('Turno não encontrado');

      const u = await tx.utilizador.findUnique({ where: { id: atribuidoPorId }, select: { role: true } });
      const grupoMedico = ['medico', 'chefe_medicos'];
      const grupo = grupoMedico.includes(u?.role ?? '') ? grupoMedico : ['enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'auxiliar'];

      const chefeId = this.chefeDeTurno(turno, grupo);
      if (chefeId !== atribuidoPorId) throw new ForbiddenException('Apenas o chefe de turno pode fazer atribuições');

      const profissionalNoTurno = turno.profissionais.some((p: any) => p.utilizadorId === utilizadorId);
      if (!profissionalNoTurno) throw new ForbiddenException('Utilizador não está neste turno');

      return tx.atribuicaoHorarioTurno.upsert({
        where: { horarioTurnoId_doenteId_utilizadorId: { horarioTurnoId: turnoId, doenteId, utilizadorId } },
        create: { horarioTurnoId: turnoId, doenteId, utilizadorId, atribuidoPorId },
        update: { atribuidoPorId },
      });
    });
  }

  // Remover atribuição
  async remover(turnoId: string, doenteId: string, utilizadorId: string, atribuidoPorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const turno = await tx.horarioTurno.findUnique({
        where: { id: turnoId },
        include: {
          profissionais: {
            include: { utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true, equipa: true } } },
          },
          atribuicoes: {
            include: {
              doente: { select: { id: true, nome: true, numeroProcesso: true, estado: true, diagnosticoPrincipal: true, cama: true } },
              utilizador: { select: { id: true, nome: true, role: true } },
            },
          },
        },
      });
      if (!turno) throw new NotFoundException('Turno não encontrado');

      const u = await tx.utilizador.findUnique({ where: { id: atribuidoPorId }, select: { role: true } });
      const grupoMedico = ['medico', 'chefe_medicos'];
      const grupo = grupoMedico.includes(u?.role ?? '') ? grupoMedico : ['enfermeiro', 'chefe_turno', 'chefe_enfermeiros', 'auxiliar'];

      const chefeId = this.chefeDeTurno(turno, grupo);
      if (chefeId !== atribuidoPorId) throw new ForbiddenException('Apenas o chefe de turno pode remover atribuições');

      await tx.atribuicaoHorarioTurno.deleteMany({ where: { horarioTurnoId: turnoId, doenteId, utilizadorId } });
      return { mensagem: 'Atribuição removida' };
    });
  }

  // Conta pares (utilizadorId, doenteId) em turnos anteriores ao turnoId dado
  async historicoPares(turnoId: string): Promise<Record<string, number>> {
    const pares = await this.prisma.atribuicaoHorarioTurno.groupBy({
      by: ['utilizadorId', 'doenteId'],
      where: { horarioTurnoId: { not: turnoId } },
      _count: { id: true },
    });
    return Object.fromEntries(
      pares.map(p => [`${p.utilizadorId}|${p.doenteId}`, p._count.id]),
    );
  }

  // Lista turnos do dia (para o chefe escolher qual gerir)
  async turnosDoDia(data?: string) {
    const diaStr = data ?? chaveDiaClinico(new Date());
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(diaStr + 'T23:59:59.999Z');

    return this.prisma.horarioTurno.findMany({
      where: { data: { gte: dataInicio, lte: dataFim } },
      include: {
        profissionais: {
          include: {
            utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true, equipa: true } },
          },
        },
        atribuicoes: {
          include: {
            doente: { select: { id: true, nome: true, numeroProcesso: true, estado: true, diagnosticoPrincipal: true, cama: true } },
            utilizador: { select: { id: true, nome: true, role: true } },
          },
        },
      },
      orderBy: { data: 'asc' },
    });
  }
}

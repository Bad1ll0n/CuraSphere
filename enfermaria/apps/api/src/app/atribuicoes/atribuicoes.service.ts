import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AtribuicoesService {
  constructor(private readonly prisma: PrismaService) {}

  // Retorna o turno ativo agora (ou do dia de hoje pelo tipo)
  async turnoAtivo() {
    const agora = new Date();
    const hora = agora.getHours();

    // manha: 7-15, tarde: 15-23, noite: 23-7
    let tipo: string;
    if (hora >= 7 && hora < 15) tipo = 'manha';
    else if (hora >= 15 && hora < 23) tipo = 'tarde';
    else tipo = 'noite';

    const diaStr = agora.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(diaStr + 'T23:59:59.999Z');

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

  // Lista turnos do dia (para o chefe escolher qual gerir)
  async turnosDoDia(data?: string) {
    const diaStr = data ?? new Date().toISOString().split('T')[0];
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

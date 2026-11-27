import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoTurno } from '../common/infra/enums';

import { chaveDiaClinico } from '../common/clinico/dia-clinico.helper';
import { DotacoesService } from '../dotacoes/dotacoes.service';
import { gerarEscala } from '../dotacoes/dotacoes.regras';

@Injectable()
export class HorariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dotacoes: DotacoesService,
  ) {}

  async listar(page = 1, limit = 12) {
    return this.prisma.escala.findMany({
      include: {
        turnos: {
          include: {
            profissionais: {
              include: { utilizador: { select: { id: true, nome: true, role: true, subRole: true, servico: true } } },
            },
          },
          orderBy: { data: 'asc' },
        },
        criadaPor: { select: { id: true, nome: true } },
      },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  async buscarPorMes(mes: number, ano: number, servico = '') {
    const escala = await this.prisma.escala.findUnique({
      where: { mes_ano_servico: { mes, ano, servico } },
      include: {
        turnos: {
          include: {
            profissionais: {
              include: { utilizador: { select: { id: true, nome: true, role: true, subRole: true, servico: true, ordemExperiencia: true } } },
            },
          },
          orderBy: { data: 'asc' },
        },
      },
    });

    if (!escala) throw new NotFoundException(`Escala para ${mes}/${ano} não encontrada`);
    return escala;
  }

  async criar(data: { mes: number; ano: number; servico?: string; criadaPorId: string }) {
    const servico = (data.servico ?? '').trim();
    return this.prisma.$transaction(async (tx) => {
      const existe = await tx.escala.findUnique({
        where: { mes_ano_servico: { mes: data.mes, ano: data.ano, servico } },
      });
      if (existe) throw new ConflictException(`Já existe escala para ${data.mes}/${data.ano}${servico ? ` (${servico})` : ''}`);
      return tx.escala.create({
        data: { ...data, servico },
        include: { criadaPor: { select: { id: true, nome: true } } },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async adicionarTurno(data: {
    escalId: string;
    tipo: TipoTurno;
    data: Date;
    profissionaisIds: string[];
  }) {
    const escala = await this.prisma.escala.findUnique({ where: { id: data.escalId } });
    if (!escala) throw new NotFoundException('Escala não encontrada');

    const diaStr = chaveDiaClinico(new Date(data.data));
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(diaStr + 'T23:59:59.999Z');
    const dataNormalizada = dataInicio;

    // Bloquear profissionais em ausência aprovada nesta data
    const emAusencia = await this.prisma.ausencia.findMany({
      where: {
        utilizadorId: { in: data.profissionaisIds },
        estado: 'aprovada',
        dataInicio: { lte: dataFim },
        dataFim:    { gte: dataInicio },
      },
      include: { utilizador: { select: { nome: true } } },
    });
    if (emAusencia.length > 0) {
      const nomes = emAusencia.map((a) => a.utilizador.nome).join(', ');
      throw new BadRequestException(`Profissional(is) em ausência aprovada nesta data: ${nomes}`);
    }

    // Determinar o grupo dos profissionais a adicionar
    const grupoMedico = ['medico', 'chefe_medicos'];
    const grupoEnfermagem = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar'];
    const profRoles = await this.prisma.utilizador.findMany({
      where: { id: { in: data.profissionaisIds } },
      select: { role: true },
    });
    const isGrupoMedico = profRoles.some((p) => grupoMedico.includes(p.role));
    const rolesDoGrupo = isGrupoMedico ? grupoMedico : grupoEnfermagem;

    // Check-then-create atómico para evitar race conditions
    const turno = await this.prisma.$transaction(async (tx) => {
      const jaExiste = await tx.horarioTurno.findFirst({
        where: {
          escalId: data.escalId,
          tipo: data.tipo,
          data: { gte: dataInicio, lte: dataFim },
          profissionais: {
            some: { utilizador: { role: { in: rolesDoGrupo as any } } },
          },
        },
      });
      if (jaExiste) throw new BadRequestException(`Já existe um turno de ${data.tipo} neste dia para este grupo`);

      return tx.horarioTurno.create({
        data: {
          escalId: data.escalId,
          tipo: data.tipo,
          data: dataNormalizada,
          profissionais: {
            create: data.profissionaisIds.map((id) => ({ utilizadorId: id })),
          },
        },
        include: {
          profissionais: {
            include: { utilizador: { select: { id: true, nome: true, role: true, subRole: true, servico: true, ordemExperiencia: true } } },
          },
        },
      });
    }, { isolationLevel: 'Serializable' });

    return turno;
  }

  async editarTurno(turnoId: string, data: { tipo?: TipoTurno; profissionaisIds?: string[] }) {
    const turno = await this.prisma.horarioTurno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundException('Turno não encontrado');

    if (data.tipo && data.tipo !== turno.tipo) {
      const diaStr = chaveDiaClinico(new Date(turno.data));
      const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
      const dataFim = new Date(diaStr + 'T23:59:59.999Z');

      // Determinar o grupo do turno atual
      const grupoMedico = ['medico', 'chefe_medicos'];
      const grupoEnfermagem = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar'];
      const turnoAtual = await this.prisma.horarioTurno.findUnique({
        where: { id: turnoId },
        include: { profissionais: { include: { utilizador: { select: { role: true } } } } },
      });
      const isGrupoMedico = turnoAtual?.profissionais.some((p) => grupoMedico.includes(p.utilizador.role));
      const rolesDoGrupo = isGrupoMedico ? grupoMedico : grupoEnfermagem;

      const conflito = await this.prisma.horarioTurno.findFirst({
        where: {
          id: { not: turnoId },
          escalId: turno.escalId,
          tipo: data.tipo,
          data: { gte: dataInicio, lte: dataFim },
          profissionais: {
            some: { utilizador: { role: { in: rolesDoGrupo as any } } },
          },
        },
      });
      if (conflito) throw new BadRequestException(`Já existe um turno de ${data.tipo} neste dia para este grupo`);
    }

    if (data.profissionaisIds) {
      const diaStrE = chaveDiaClinico(new Date(turno.data));
      const dataInicioE = new Date(diaStrE + 'T00:00:00.000Z');
      const dataFimE = new Date(diaStrE + 'T23:59:59.999Z');
      const emAusenciaE = await this.prisma.ausencia.findMany({
        where: {
          utilizadorId: { in: data.profissionaisIds },
          estado: 'aprovada',
          dataInicio: { lte: dataFimE },
          dataFim:    { gte: dataInicioE },
        },
        include: { utilizador: { select: { nome: true } } },
      });
      if (emAusenciaE.length > 0) {
        const nomes = emAusenciaE.map((a) => a.utilizador.nome).join(', ');
        throw new BadRequestException(`Profissional(is) em ausência aprovada nesta data: ${nomes}`);
      }
      await this.prisma.$transaction([
        this.prisma.horarioTurnoProfissional.deleteMany({ where: { horarioTurnoId: turnoId } }),
        this.prisma.horarioTurnoProfissional.createMany({
          data: data.profissionaisIds.map((id) => ({ horarioTurnoId: turnoId, utilizadorId: id })),
        }),
      ]);
    }

    return this.prisma.horarioTurno.update({
      where: { id: turnoId },
      data: { ...(data.tipo ? { tipo: data.tipo } : {}) },
      include: {
        profissionais: {
          include: { utilizador: { select: { id: true, nome: true, role: true, subRole: true, servico: true } } },
        },
      },
    });
  }

  async apagarTurno(turnoId: string) {
    const turno = await this.prisma.horarioTurno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundException('Turno não encontrado');
    return this.prisma.$transaction([
      this.prisma.horarioTurnoProfissional.deleteMany({ where: { horarioTurnoId: turnoId } }),
      this.prisma.horarioTurno.delete({ where: { id: turnoId } }),
    ]);
  }

  /**
   * PROD-17 — escala automática POR SERVIÇO, com os mínimos e as regras laborais do serviço
   * (dotacoes.regras.ts › gerarEscala). Antes havia uma só escala por mês para o hospital, com
   * 2 enfermeiros por turno fixos e deduplicação por tipo+data: gerar o serviço A e depois o B
   * não criava nenhum turno de B. O que não se consegue cumprir vem em `faltas`.
   */
  async gerarEscalaAutomatica(mes: number, ano: number, criadaPorId: string, servico?: string) {
    const s = (servico ?? '').trim();
    let escala = await this.prisma.escala.findUnique({ where: { mes_ano_servico: { mes, ano, servico: s } } });
    if (!escala) escala = await this.prisma.escala.create({ data: { mes, ano, servico: s, criadaPorId } });

    // O pessoal do serviço é o colocado nele (`unidade`); a escala geral usa todos os clínicos.
    const profissionais = await this.prisma.utilizador.findMany({
      where: { ativo: true, role: { in: ['medico', 'enfermeiro', 'auxiliar'] }, ...(s ? { unidade: s } : {}) },
      select: { id: true, role: true, competencias: true },
      orderBy: [{ role: 'asc' }, { ordemExperiencia: 'asc' }],
    });
    if (profissionais.length === 0) {
      throw new BadRequestException(s ? `Sem profissionais colocados no serviço "${s}" — defina a unidade dos profissionais.` : 'Sem profissionais disponíveis para gerar escala');
    }

    const mesInicio = new Date(Date.UTC(ano, mes - 1, 1));
    const mesFim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
    const [ausencias, existentes, p] = await Promise.all([
      this.prisma.ausencia.findMany({ where: { estado: 'aprovada', dataInicio: { lte: mesFim }, dataFim: { gte: mesInicio } }, select: { utilizadorId: true, dataInicio: true, dataFim: true } }),
      this.prisma.horarioTurno.findMany({ where: { escalId: escala.id }, select: { tipo: true, data: true } }),
      this.dotacoes.parametros(s || 'geral'),
    ]);
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const dias = Array.from({ length: diasNoMes }, (_, i) => `${ano}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
    const { turnos, faltas } = gerarEscala({
      dias,
      profissionais: profissionais as any,
      ausente: (id, dia) => { const d = new Date(`${dia}T00:00:00.000Z`); return ausencias.some((a) => a.utilizadorId === id && a.dataInicio <= d && a.dataFim >= d); },
      existentes: new Set(existentes.map((t) => `${t.data.toISOString().slice(0, 10)}_${t.tipo}`)),
      p,
    });

    for (const t of turnos) {
      await this.prisma.horarioTurno.create({
        data: { escalId: escala.id, tipo: t.tipo as TipoTurno, data: new Date(`${t.data}T00:00:00.000Z`), profissionais: { create: t.ids.map((id) => ({ utilizadorId: id })) } },
      });
    }
    return { escala: { id: escala.id, mes, ano, servico: s }, turnosCriados: turnos.length, profissionaisUsados: profissionais.length, diasGerados: diasNoMes, faltas };
  }

  async horarioUtilizador(utilizadorId: string, mes: number, ano: number) {
    return this.prisma.horarioTurnoProfissional.findMany({
      where: {
        utilizadorId,
        horarioTurno: {
          escala: { mes, ano },
        },
      },
      include: {
        horarioTurno: { select: { id: true, tipo: true, data: true } },
      },
      orderBy: { horarioTurno: { data: 'asc' } },
    });
  }

  async ausenciasAprovadas(mes: number, ano: number) {
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
    return this.prisma.ausencia.findMany({
      where: {
        estado: 'aprovada',
        dataInicio: { lte: fim },
        dataFim:    { gte: inicio },
      },
      include: { utilizador: { select: { id: true, nome: true } } },
      orderBy: { dataInicio: 'asc' },
    });
  }
}

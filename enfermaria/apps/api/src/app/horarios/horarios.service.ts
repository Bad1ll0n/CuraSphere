import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoTurno } from '../common/enums';

@Injectable()
export class HorariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.escala.findMany({
      include: {
        turnos: {
          include: {
            profissionais: {
              include: { utilizador: { select: { id: true, nome: true, role: true } } },
            },
          },
          orderBy: { data: 'asc' },
        },
        criadaPor: { select: { id: true, nome: true } },
      },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    });
  }

  async buscarPorMes(mes: number, ano: number) {
    const escala = await this.prisma.escala.findUnique({
      where: { mes_ano: { mes, ano } },
      include: {
        turnos: {
          include: {
            profissionais: {
              include: { utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true } } },
            },
          },
          orderBy: { data: 'asc' },
        },
      },
    });

    if (!escala) throw new NotFoundException(`Escala para ${mes}/${ano} não encontrada`);
    return escala;
  }

  async criar(data: { mes: number; ano: number; criadaPorId: string }) {
    const existe = await this.prisma.escala.findUnique({
      where: { mes_ano: { mes: data.mes, ano: data.ano } },
    });
    if (existe) throw new ConflictException(`Já existe escala para ${data.mes}/${data.ano}`);

    return this.prisma.escala.create({
      data,
      include: { criadaPor: { select: { id: true, nome: true } } },
    });
  }

  async adicionarTurno(data: {
    escalId: string;
    tipo: TipoTurno;
    data: Date;
    profissionaisIds: string[];
  }) {
    const escala = await this.prisma.escala.findUnique({ where: { id: data.escalId } });
    if (!escala) throw new NotFoundException('Escala não encontrada');

    const diaStr = new Date(data.data).toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(diaStr + 'T23:59:59.999Z');
    const dataNormalizada = dataInicio;

    // Determinar o grupo dos profissionais a adicionar
    const grupoMedico = ['medico', 'chefe_medicos'];
    const grupoEnfermagem = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar'];
    const profRoles = await this.prisma.utilizador.findMany({
      where: { id: { in: data.profissionaisIds } },
      select: { role: true },
    });
    const isGrupoMedico = profRoles.some((p) => grupoMedico.includes(p.role));
    const rolesDoGrupo = isGrupoMedico ? grupoMedico : grupoEnfermagem;

    // Só bloqueia se já existir turno do mesmo tipo neste dia com profissionais do mesmo grupo
    const jaExiste = await this.prisma.horarioTurno.findFirst({
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

    const turno = await this.prisma.horarioTurno.create({
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
          include: { utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true } } },
        },
      },
    });

    return turno;
  }

  async editarTurno(turnoId: string, data: { tipo?: TipoTurno; profissionaisIds?: string[] }) {
    const turno = await this.prisma.horarioTurno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundException('Turno não encontrado');

    if (data.tipo && data.tipo !== turno.tipo) {
      const diaStr = new Date(turno.data).toISOString().split('T')[0];
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
      await this.prisma.horarioTurnoProfissional.deleteMany({ where: { horarioTurnoId: turnoId } });
      await this.prisma.horarioTurnoProfissional.createMany({
        data: data.profissionaisIds.map((id) => ({ horarioTurnoId: turnoId, utilizadorId: id })),
      });
    }

    return this.prisma.horarioTurno.update({
      where: { id: turnoId },
      data: { ...(data.tipo ? { tipo: data.tipo } : {}) },
      include: {
        profissionais: {
          include: { utilizador: { select: { id: true, nome: true, role: true } } },
        },
      },
    });
  }

  async apagarTurno(turnoId: string) {
    const turno = await this.prisma.horarioTurno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new NotFoundException('Turno não encontrado');
    await this.prisma.horarioTurnoProfissional.deleteMany({ where: { horarioTurnoId: turnoId } });
    return this.prisma.horarioTurno.delete({ where: { id: turnoId } });
  }

  async gerarEscalaAutomatica(mes: number, ano: number, criadaPorId: string, servico?: string) {
    // Criar escala se não existir
    let escala = await this.prisma.escala.findUnique({ where: { mes_ano: { mes, ano } } });
    if (!escala) {
      escala = await this.prisma.escala.create({ data: { mes, ano, criadaPorId } });
    }

    // Buscar profissionais ativos do serviço (enfermeiros + médicos + auxiliares)
    const rolesClinicas = ['medico', 'enfermeiro', 'auxiliar'];
    const profissionais = await this.prisma.utilizador.findMany({
      where: {
        ativo: true,
        role: { in: rolesClinicas },
        ...(servico ? { servico: servico as any } : {}),
      },
      select: { id: true, role: true, ordemExperiencia: true },
      orderBy: [{ role: 'asc' }, { ordemExperiencia: 'asc' }],
    });

    if (profissionais.length === 0) throw new BadRequestException('Sem profissionais disponíveis para gerar escala');

    const medicos = profissionais.filter(p => p.role === 'medico');
    const enfermeiros = profissionais.filter(p => p.role === 'enfermeiro');
    const auxiliares = profissionais.filter(p => p.role === 'auxiliar');

    const diasNoMes = new Date(ano, mes, 0).getDate();
    const tipos: TipoTurno[] = ['manha', 'tarde', 'noite'];
    let turnosCriados = 0;

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dataDia = new Date(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T00:00:00.000Z`);

      for (const tipo of tipos) {
        // Verificar se já existe turno para este dia e tipo
        const jaExiste = await this.prisma.horarioTurno.findFirst({
          where: { escalId: escala.id, tipo, data: dataDia },
        });
        if (jaExiste) continue;

        // Distribuir profissionais em round-robin por tipo de turno
        const turnoIndex = (dia - 1) * 3 + tipos.indexOf(tipo);
        const getProfRoundRobin = (lista: typeof profissionais, n: number) => {
          if (lista.length === 0) return [];
          const min = Math.max(1, Math.ceil(lista.length / 3));
          const inicio = (turnoIndex * min) % lista.length;
          const selecionados: string[] = [];
          for (let i = 0; i < min; i++) {
            selecionados.push(lista[(inicio + i) % lista.length].id);
          }
          return [...new Set(selecionados)];
        };

        const profIds = [
          ...getProfRoundRobin(medicos, 1),
          ...getProfRoundRobin(enfermeiros, 2),
          ...getProfRoundRobin(auxiliares, 1),
        ];

        if (profIds.length === 0) continue;

        await this.prisma.horarioTurno.create({
          data: {
            escalId: escala.id,
            tipo,
            data: dataDia,
            profissionais: { create: profIds.map(id => ({ utilizadorId: id })) },
          },
        });
        turnosCriados++;
      }
    }

    return {
      escala: { id: escala.id, mes, ano },
      turnosCriados,
      profissionaisUsados: profissionais.length,
      diasGerados: diasNoMes,
    };
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
}

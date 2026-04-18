import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoDoente } from '../common/enums';

@Injectable()
export class DoenteService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(utilizadorId: string, role: string, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const restritos = ['enfermeiro', 'medico', 'auxiliar', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'];

    if (!restritos.includes(role)) {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.doente.findMany({
          where: { ativo: true },
          include: { cama: true },
          orderBy: { dataAdmissao: 'desc' },
          take: limit,
          skip,
        }),
        this.prisma.doente.count({ where: { ativo: true } }),
      ]);
      return { data, total, page, limit, totalPaginas: Math.ceil(total / limit) };
    }

    // Determina turno ativo actual
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipo: string;
    if (min >= 8 * 60 && min < 16 * 60 + 30) tipo = 'manha';
    else if (min >= 16 * 60 && min < 23 * 60 + 30) tipo = 'tarde';
    else tipo = 'noite';

    const diaStr = agora.toISOString().split('T')[0];
    const dataHoje = new Date(diaStr + 'T00:00:00.000Z');
    const dataBase = tipo === 'noite' && min < 8 * 60 + 30
      ? new Date(dataHoje.getTime() - 24 * 60 * 60 * 1000)
      : dataHoje;
    const dataFim = new Date(dataBase.getTime() + 24 * 60 * 60 * 1000 - 1);

    const where = {
      ativo: true,
      atribuicoesHorario: {
        some: {
          utilizadorId,
          horarioTurno: {
            tipo: tipo as any,
            data: { gte: dataBase, lte: dataFim },
          },
        },
      },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.doente.findMany({
        where,
        include: { cama: true },
        orderBy: { dataAdmissao: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.doente.count({ where }),
    ]);
    return { data, total, page, limit, totalPaginas: Math.ceil(total / limit) };
  }

  async buscarPorId(id: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id },
      include: {
        cama: true,
        atribuicoes: {
          include: { enfermeiro: { select: { id: true, nome: true, role: true } } },
        },
        atribuicoesHorario: {
          include: {
            utilizador: { select: { id: true, nome: true, role: true } },
            horarioTurno: { select: { tipo: true, data: true } },
          },
          orderBy: { horarioTurno: { data: 'desc' } },
          take: 10,
        },
        tarefas: {
          where: { estado: { not: 'concluida' } },
          include: {
            responsavel: { select: { id: true, nome: true, role: true } },
            criadoPor: { select: { id: true, nome: true, role: true } },
          },
          orderBy: { prioridade: 'asc' },
        },
        medicacoes: { where: { ativo: true } },
        notasTurno: {
          include: { autor: { select: { id: true, nome: true, role: true } } },
          orderBy: { criadaEm: 'desc' },
          take: 20,
        },
      },
    });

    if (!doente) throw new NotFoundException('Doente não encontrado');
    return doente;
  }

  async admitir(data: {
    nome: string;
    dataNascimento: Date;
    diagnosticoPrincipal: string;
    camaId: string;
    dataAltaPrevista?: Date;
    administrativoAdmissaoId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const cama = await tx.cama.findUnique({ where: { id: data.camaId } });
      if (!cama) throw new NotFoundException('Cama não encontrada');
      if (cama.estado !== 'livre' && cama.estado !== 'reservada') {
        throw new BadRequestException('Cama não está disponível');
      }

      const ano = new Date().getFullYear();
      const prefixo = `${ano}-`;
      const ultimo = await tx.doente.findFirst({
        where: { numeroProcesso: { startsWith: prefixo } },
        orderBy: { numeroProcesso: 'desc' },
        select: { numeroProcesso: true },
      });
      const proximoNum = ultimo ? parseInt(ultimo.numeroProcesso.split('-')[1], 10) + 1 : 1;
      const numeroProcesso = `${ano}-${String(proximoNum).padStart(8, '0')}`;

      const doente = await tx.doente.create({
        data: {
          nome: data.nome,
          dataNascimento: new Date(data.dataNascimento),
          numeroProcesso,
          diagnosticoPrincipal: data.diagnosticoPrincipal,
          camaId: data.camaId,
          dataAltaPrevista: data.dataAltaPrevista ? new Date(data.dataAltaPrevista) : undefined,
          administrativoAdmissaoId: data.administrativoAdmissaoId,
        },
        include: { cama: true },
      });

      await tx.cama.update({
        where: { id: data.camaId },
        data: { estado: 'ocupada' },
      });

      return doente;
    }, { isolationLevel: 'Serializable' });
  }

  async editar(id: string, dto: { diagnosticoPrincipal?: string; dataAltaPrevista?: Date | null; numeroProcesso?: string }) {
    await this.buscarPorId(id);
    return this.prisma.doente.update({
      where: { id },
      data: {
        ...(dto.diagnosticoPrincipal !== undefined && { diagnosticoPrincipal: dto.diagnosticoPrincipal }),
        ...(dto.dataAltaPrevista !== undefined && { dataAltaPrevista: dto.dataAltaPrevista ? new Date(dto.dataAltaPrevista) : null }),
        ...(dto.numeroProcesso !== undefined && { numeroProcesso: dto.numeroProcesso }),
      },
      select: { id: true, nome: true, diagnosticoPrincipal: true, dataAltaPrevista: true, numeroProcesso: true },
    });
  }

  async atualizarEstado(id: string, estado: EstadoDoente) {
    await this.buscarPorId(id);
    return this.prisma.doente.update({
      where: { id },
      data: { estado },
      select: { id: true, nome: true, estado: true },
    });
  }

  async darAlta(id: string, administrativoId: string) {
    const doente = await this.buscarPorId(id);

    await this.prisma.$transaction([
      this.prisma.doente.update({
        where: { id },
        data: { ativo: false, dataAlta: new Date(), estado: 'alta_prevista' },
      }),
      this.prisma.cama.update({
        where: { id: doente.camaId },
        data: { estado: 'em_limpeza' },
      }),
    ]);

    return { mensagem: 'Alta registada com sucesso' };
  }

  async adicionarNota(doenteId: string, autorId: string, texto: string) {
    await this.verificarTurnoAtivo(autorId);
    await this.buscarPorId(doenteId);
    return this.prisma.notaTurno.create({
      data: { doenteId, autorId, texto },
      include: { autor: { select: { id: true, nome: true, role: true } } },
    });
  }

  async criarTarefa(doenteId: string, criadoPorId: string, data: {
    descricao: string;
    tipo: string;
    prioridade: string;
    grupoResponsavel: string; // 'medico' | 'enfermeiro' | 'auxiliar'
    prazo?: Date;
  }) {
    await this.verificarTurnoAtivo(criadoPorId);
    await this.buscarPorId(doenteId);

    // Tenta resolver o responsável concreto com base no grupo e turno atual
    const responsavelId = await this.resolverResponsavel(doenteId, data.grupoResponsavel);

    return this.prisma.tarefa.create({
      data: {
        doenteId,
        criadoPorId,
        descricao: data.descricao,
        tipo: data.tipo as any,
        prioridade: data.prioridade as any,
        grupoResponsavel: data.grupoResponsavel,
        responsavelId,
        prazo: data.prazo ? new Date(data.prazo) : undefined,
      },
      include: {
        responsavel: { select: { id: true, nome: true, role: true } },
        criadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  /** Dado um grupo ('medico' | 'enfermeiro' | 'auxiliar') e o doente,
   * encontra o utilizador atribuído ao doente no turno atual com esse grupo de role. */
  private async resolverResponsavel(doenteId: string, grupo: string): Promise<string | null> {
    const rolesMap: Record<string, string[]> = {
      medico:     ['medico', 'chefe_medicos'],
      enfermeiro: ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno'],
      auxiliar:   ['auxiliar'],
    };
    const roles = rolesMap[grupo];
    if (!roles) return null;

    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipo: string;
    const dataRef = new Date(agora);
    if (min >= 8 * 60 && min < 16 * 60 + 30)      { tipo = 'manha'; }
    else if (min >= 16 * 60 && min < 23 * 60 + 30) { tipo = 'tarde'; }
    else {
      tipo = 'noite';
      if (min < 8 * 60 + 30) dataRef.setDate(dataRef.getDate() - 1);
    }

    const diaStr = dataRef.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim    = new Date(diaStr + 'T23:59:59.999Z');

    const atribuicao = await this.prisma.atribuicaoHorarioTurno.findFirst({
      where: {
        doenteId,
        utilizador: { role: { in: roles as any } },
        horarioTurno: { tipo: tipo as any, data: { gte: dataInicio, lte: dataFim } },
      },
      select: { utilizadorId: true },
    });

    return atribuicao?.utilizadorId ?? null;
  }

  /**
   * Calcula o deadline de edição de uma nota com base no turno real:
   *   Manhã  08:00–16:00 → editável até 16:30
   *   Tarde  16:00–23:00 → editável até 23:30
   *   Noite  23:00–08:00 → editável até 08:30 do dia seguinte
   */
  private getDeadlineEdicaoNota(criadaEm: Date): Date {
    const min = criadaEm.getHours() * 60 + criadaEm.getMinutes();
    const deadline = new Date(criadaEm);

    if (min >= 8 * 60 && min < 16 * 60) {
      // Manhã → 16:30 mesmo dia
      deadline.setHours(16, 30, 0, 0);
    } else if (min >= 16 * 60 && min < 23 * 60) {
      // Tarde → 23:30 mesmo dia
      deadline.setHours(23, 30, 0, 0);
    } else if (min >= 23 * 60) {
      // Noite (início) → 08:30 do dia seguinte
      deadline.setDate(deadline.getDate() + 1);
      deadline.setHours(8, 30, 0, 0);
    } else {
      // 00:00–08:30 (continuação da noite anterior) → 08:30 mesmo dia
      deadline.setHours(8, 30, 0, 0);
    }

    return deadline;
  }

  private notaDentroDoTurno(criadaEm: Date): boolean {
    const agora = new Date();
    const criacao = new Date(criadaEm);
    if (agora.getTime() - criacao.getTime() > 10 * 60 * 60 * 1000) return false;
    return agora <= this.getDeadlineEdicaoNota(criacao);
  }

  /** Verifica se o utilizador tem um HorarioTurno ativo neste momento */
  private async verificarTurnoAtivo(utilizadorId: string): Promise<void> {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();

    let tipo: string;
    let dataRef = new Date(agora);

    if (min >= 8 * 60 && min < 16 * 60) {
      tipo = 'manha';
    } else if (min >= 16 * 60 && min < 23 * 60) {
      tipo = 'tarde';
    } else if (min >= 23 * 60) {
      tipo = 'noite';
    } else {
      // 00:00–08:30 → noite de ontem
      tipo = 'noite';
      dataRef.setDate(dataRef.getDate() - 1);
    }

    const diaStr = dataRef.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim    = new Date(diaStr + 'T23:59:59.999Z');

    const turno = await this.prisma.horarioTurnoProfissional.findFirst({
      where: {
        utilizadorId,
        horarioTurno: { tipo: tipo as any, data: { gte: dataInicio, lte: dataFim } },
      },
    });

    if (!turno) throw new ForbiddenException('Não tens turno ativo neste momento');
  }

  async editarNota(notaId: string, autorId: string, texto: string) {
    await this.verificarTurnoAtivo(autorId);
    const nota = await this.prisma.notaTurno.findUnique({ where: { id: notaId } });
    if (!nota) throw new NotFoundException('Nota não encontrada');
    if (nota.autorId !== autorId) throw new ForbiddenException('Sem permissão para editar esta nota');
    if (!this.notaDentroDoTurno(nota.criadaEm))
      throw new ForbiddenException('Nota bloqueada — turno já passou');

    return this.prisma.notaTurno.update({
      where: { id: notaId },
      data: { texto },
      include: { autor: { select: { id: true, nome: true, role: true } } },
    });
  }

  async apagarNota(notaId: string, autorId: string) {
    await this.verificarTurnoAtivo(autorId);
    const nota = await this.prisma.notaTurno.findUnique({ where: { id: notaId } });
    if (!nota) throw new NotFoundException('Nota não encontrada');
    if (nota.autorId !== autorId) throw new ForbiddenException('Sem permissão para apagar esta nota');
    if (!this.notaDentroDoTurno(nota.criadaEm))
      throw new ForbiddenException('Nota bloqueada — turno já passou');

    return this.prisma.notaTurno.delete({ where: { id: notaId } });
  }

  async altaEstruturada(doenteId: string, criadoPorId: string, role: string, body: Record<string, any>) {
    const ROLES_ALTA = ['medico', 'chefe_medicos', 'chefe_turno', 'administrativo', 'chefe_enfermeiros'];
    if (!ROLES_ALTA.includes(role)) throw new ForbiddenException('Sem permissão para dar alta');

    const doente = await this.buscarPorId(doenteId);

    return this.prisma.$transaction(async (tx) => {
      const sumario = await tx.sumarioAlta.create({
        data: {
          doenteId,
          criadoPorId,
          motivoAlta:      body['motivoAlta'] as string,
          destino:         body['destino'] as string | undefined,
          resumoClinical:  body['resumoClinical'] as string,
          prescricaoSaida: body['prescricaoSaida'] as string | undefined,
          medicoFamilia:   body['medicoFamilia'] as string | undefined,
        },
      });

      await tx.doente.update({
        where: { id: doenteId },
        data: { ativo: false, dataAlta: new Date() },
      });

      await tx.cama.update({
        where: { id: doente.camaId },
        data: { estado: 'em_limpeza' },
      });

      return sumario;
    });
  }

  async getSumarioAlta(doenteId: string) {
    return this.prisma.sumarioAlta.findUnique({
      where: { doenteId },
      include: { criadoPor: { select: { nome: true, role: true } } },
    });
  }

  async atualizarIsolamento(id: string, emIsolamento: boolean, motivoIsolamento?: string) {
    await this.buscarPorId(id);
    return this.prisma.doente.update({
      where: { id },
      data: { emIsolamento, motivoIsolamento: emIsolamento ? (motivoIsolamento ?? null) : null },
      select: { id: true, emIsolamento: true, motivoIsolamento: true },
    });
  }

  async listarIsolados() {
    return this.prisma.doente.findMany({
      where: { ativo: true, emIsolamento: true },
      select: {
        id: true, nome: true, emIsolamento: true, motivoIsolamento: true,
        cama: { select: { numero: true, quarto: true } },
        diagnosticoPrincipal: true, estado: true,
      },
      orderBy: { nome: 'asc' },
    });
  }

  async historico(id: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id },
      include: {
        tarefas: { include: { criadoPor: { select: { nome: true, role: true } } }, orderBy: { criadaEm: 'desc' } },
        medicacoes: { include: { registos: { include: { administradoPor: { select: { nome: true } } } } } },
        notasTurno: { include: { autor: { select: { nome: true, role: true } } }, orderBy: { criadaEm: 'desc' } },
      },
    });

    if (!doente) throw new NotFoundException('Doente não encontrado');
    return doente;
  }
}

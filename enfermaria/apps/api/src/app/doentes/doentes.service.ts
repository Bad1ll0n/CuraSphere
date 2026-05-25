import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EstadoDoente } from '../common/enums';

@Injectable()
export class DoenteService {
  private readonly logger = new Logger(DoenteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async listar(utilizadorId: string, role: string, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const restritos = ['enfermeiro', 'medico', 'auxiliar', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'];

    if (!restritos.includes(role)) {
      // Admin e outros roles não clínicos: ver internados + ambulatorio (não pendente_cama)
      const whereBase = { ativo: true, estadoRegisto: { not: 'pendente_cama' } };
      const [data, total] = await this.prisma.$transaction([
        this.prisma.doente.findMany({
          where: whereBase,
          include: { cama: true },
          orderBy: { dataAdmissao: 'desc' },
          take: limit,
          skip,
        }),
        this.prisma.doente.count({ where: whereBase }),
      ]);
      return { data, total, page, limit, totalPaginas: Math.ceil(total / limit) };
    }

    // Clínicos (enfermeiro, médico, auxiliar): apenas doentes internados (com cama)
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
      estadoRegisto: 'internado',
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

    if (!doente) throw new NotFoundException(`Doente (ID ${id}) não encontrado`);
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
      if (!cama) throw new NotFoundException(`Cama (ID ${data.camaId}) não encontrada`);
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

    const ops: any[] = [
      this.prisma.doente.update({
        where: { id },
        data: { ativo: false, dataAlta: new Date(), estado: 'alta_prevista' },
      }),
    ];

    if (doente.camaId) {
      ops.push(this.prisma.cama.update({
        where: { id: doente.camaId },
        data: { estado: 'em_limpeza' },
      }));
    }

    await this.prisma.$transaction(ops);
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
    if (!nota) throw new NotFoundException(`Nota (ID ${notaId}) não encontrada`);
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
    if (!nota) throw new NotFoundException(`Nota (ID ${notaId}) não encontrada`);
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

      if (doente.camaId) {
        const cama = await tx.cama.update({
          where: { id: doente.camaId },
          data: { estado: 'em_limpeza' },
        });
        this.notificacoes.enviarParaRole(
          'auxiliar',
          '🧹 Cama disponível para limpeza',
          `Cama ${cama.quarto}/${cama.numero} — doente teve alta. Por favor efectue a limpeza.`,
          { camaId: cama.id },
        ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
      }

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

  async listarRegistosAdministrativos(search?: string, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const where = {
      estadoRegisto: { in: ['pendente_cama', 'ambulatorio'] },
      ...(search ? { nome: { contains: search, mode: 'insensitive' as any } } : {}),
    };
    const [total, doentes] = await Promise.all([
      this.prisma.doente.count({ where }),
      this.prisma.doente.findMany({
        where,
        select: {
          id: true, nome: true, dataNascimento: true, numeroProcesso: true,
          estadoRegisto: true, tipoVisita: true, dataAdmissao: true,
          ficheiroPessoal: {
            select: { nif: true, numeroSNS: true, telefone: true, tipoCobertura: true },
          },
        },
        orderBy: { dataAdmissao: 'desc' },
        take: limit,
        skip,
      }),
    ]);
    return { total, pagina: page, totalPaginas: Math.ceil(total / limit), doentes };
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

    if (!doente) throw new NotFoundException(`Doente (ID ${id}) não encontrado`);
    return doente;
  }

  async buscarFicheiroPessoal(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    const ficha = await this.prisma.ficheiroPessoalDoente.findUnique({
      where: { doenteId },
      include: { atualizadoPor: { select: { id: true, nome: true } } },
    });

    return ficha ?? { doenteId };
  }

  async atualizarFicheiroPessoal(
    doenteId: string,
    data: {
      nif?: string; numeroSNS?: string; morada?: string; codigoPostal?: string;
      localidade?: string; telefone?: string; email?: string;
      entidadeSeguradora?: string; numeroApolice?: string; tipoCobertura?: string;
    },
    atualizadoPorId: string,
  ) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    return this.prisma.ficheiroPessoalDoente.upsert({
      where: { doenteId },
      create: { doenteId, ...data, atualizadoPorId },
      update: { ...data, atualizadoPorId },
      include: { atualizadoPor: { select: { id: true, nome: true } } },
    });
  }

  private async gerarNumeroProcesso(tx: { doente: { findFirst: (args: any) => Promise<{ numeroProcesso: string } | null> } }) {
    const ano = new Date().getFullYear();
    const prefixo = `${ano}-`;
    const ultimo = await tx.doente.findFirst({
      where: { numeroProcesso: { startsWith: prefixo } },
      orderBy: { numeroProcesso: 'desc' },
      select: { numeroProcesso: true },
    });
    const proximoNum = ultimo ? parseInt(ultimo.numeroProcesso.split('-')[1], 10) + 1 : 1;
    return `${ano}-${String(proximoNum).padStart(8, '0')}`;
  }

  async listarProblemas(doenteId: string) {
    return this.prisma.problemaClinico.findMany({
      where: { doenteId },
      include: { registadoPor: { select: { nome: true, role: true } } },
      orderBy: [{ estado: 'asc' }, { criadoEm: 'desc' }],
    });
  }

  async criarProblema(doenteId: string, dto: { descricao: string; tipo?: string; estado?: string; dataInicio?: string }, registadoPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    return this.prisma.problemaClinico.create({
      data: {
        doenteId,
        descricao: dto.descricao,
        tipo: dto.tipo ?? 'comorbilidade',
        estado: dto.estado ?? 'ativo',
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : null,
        registadoPorId,
      },
      include: { registadoPor: { select: { nome: true, role: true } } },
    });
  }

  async atualizarProblema(id: string, dto: { estado?: string; descricao?: string; dataFim?: string }) {
    return this.prisma.problemaClinico.update({
      where: { id },
      data: {
        ...(dto.estado && { estado: dto.estado }),
        ...(dto.descricao && { descricao: dto.descricao }),
        ...(dto.dataFim ? { dataFim: new Date(dto.dataFim) } : {}),
      },
      include: { registadoPor: { select: { nome: true, role: true } } },
    });
  }

  async registroRapido(
    dto: {
      nome: string;
      tipoVisita?: string;
      dataNascimento: string;
      nif: string;
      numeroSNS: string;
      telefone: string;
      email?: string;
      tipoCobertura?: string;
      morada?: string;
      codigoPostal?: string;
      localidade?: string;
      entidadeSeguradora?: string;
      numeroApolice?: string;
    },
    criadoPorId: string,
  ) {
    if (!dto.nome?.trim()) throw new BadRequestException('Nome é obrigatório');
    if (!dto.dataNascimento) throw new BadRequestException('Data de nascimento é obrigatória');
    if (!dto.nif || !/^\d{9}$/.test(dto.nif)) throw new BadRequestException('NIF inválido — deve ter 9 dígitos');
    if (!dto.telefone || !/^[239]\d{8}$/.test(dto.telefone.replace(/\s/g, '')))
      throw new BadRequestException('Telefone inválido — 9 dígitos, começa com 2, 3 ou 9');
    if (!dto.numeroSNS || !/^\d{9}$/.test(dto.numeroSNS.replace(/\s/g, '')))
      throw new BadRequestException('Número SNS inválido — deve ter 9 dígitos');
    if (dto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email))
      throw new BadRequestException('Email inválido');
    if (dto.tipoCobertura === 'seguro') {
      if (!dto.entidadeSeguradora?.trim()) throw new BadRequestException('Entidade seguradora obrigatória para seguro');
      if (!dto.numeroApolice?.trim()) throw new BadRequestException('Número de apólice obrigatório para seguro');
    }

    return this.prisma.$transaction(async (tx) => {
      const numeroProcesso = await this.gerarNumeroProcesso(tx);
      // Internamento → pendente_cama (aguarda cama clínica); tudo o resto → ambulatorio
      const estadoRegisto = dto.tipoVisita === 'internamento' ? 'pendente_cama' : 'ambulatorio';
      const doente = await tx.doente.create({
        data: {
          nome: dto.nome,
          dataNascimento: dto.dataNascimento ? new Date(dto.dataNascimento) : null,
          numeroProcesso,
          estadoRegisto,
          tipoVisita: dto.tipoVisita ?? null,
          administrativoAdmissaoId: criadoPorId,
        },
      });

      const temDadosAdmin = dto.nif || dto.numeroSNS || dto.telefone || dto.email
        || dto.morada || dto.codigoPostal || dto.localidade
        || dto.entidadeSeguradora || dto.numeroApolice;

      if (temDadosAdmin) {
        await tx.ficheiroPessoalDoente.create({
          data: {
            doenteId: doente.id,
            nif: dto.nif ?? null,
            numeroSNS: dto.numeroSNS ?? null,
            telefone: dto.telefone ?? null,
            email: dto.email ?? null,
            tipoCobertura: dto.tipoCobertura ?? null,
            morada: dto.morada ?? null,
            codigoPostal: dto.codigoPostal ?? null,
            localidade: dto.localidade ?? null,
            entidadeSeguradora: dto.entidadeSeguradora ?? null,
            numeroApolice: dto.numeroApolice ?? null,
            atualizadoPorId: criadoPorId,
          },
        });
      }

      return doente;
    });
  }

  async timeline(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: { id: true, nome: true, dataAdmissao: true, dataAlta: true },
    });
    if (!doente) throw new Error(`Doente (ID ${doenteId}) não encontrado`);

    const [sinaisVitais, medicacoes, registosMed, notasClinicas, tarefas, alertas, exames] = await Promise.all([
      this.prisma.sinalVital.findMany({
        where: { doenteId },
        orderBy: { data: 'desc' },
        take: 30,
        select: { id: true, data: true, pressaoSistolica: true, pressaoDiastolica: true, pulso: true, saturacaoO2: true, temperatura: true, news2: true, registadoPor: { select: { nome: true } } },
      }),
      this.prisma.medicacao.findMany({
        where: { doenteId },
        orderBy: { iniciadoEm: 'desc' },
        take: 20,
        select: { id: true, iniciadoEm: true, nome: true, dose: true, via: true, frequencia: true, ativo: true, prescritoPor: { select: { nome: true } } },
      }),
      this.prisma.registoMedicacao.findMany({
        where: { doenteId },
        orderBy: { administradoEm: 'desc' },
        take: 20,
        select: { id: true, administradoEm: true, naoAdministrada: true, motivoNaoAdmin: true, medicacao: { select: { nome: true, dose: true } }, administradoPor: { select: { nome: true } } },
      }),
      this.prisma.notaClinica.findMany({
        where: { doenteId },
        orderBy: { criadaEm: 'desc' },
        take: 20,
        select: { id: true, criadaEm: true, tipo: true, texto: true, autor: { select: { nome: true, role: true } } },
      }).catch(() => []),
      this.prisma.tarefa.findMany({
        where: { doenteId },
        orderBy: { criadaEm: 'desc' },
        take: 20,
        select: { id: true, criadaEm: true, descricao: true, estado: true, prioridade: true, tipo: true },
      }),
      this.prisma.alertaClinico.findMany({
        where: { doenteId },
        orderBy: { criadoEm: 'desc' },
        take: 15,
        select: { id: true, criadoEm: true, tipo: true, mensagem: true, urgencia: true, lido: true },
      }),
      this.prisma.exame.findMany({
        where: { doenteId },
        orderBy: { criadoEm: 'desc' },
        take: 20,
        select: { id: true, criadoEm: true, tipo: true, descricao: true, estado: true, resultado: true, solicitadoPor: { select: { nome: true } } },
      }).catch(() => []),
    ]);

    const eventos: { id: string; data: string; categoria: string; titulo: string; detalhe?: string; cor: string; icone: string }[] = [];

    if (doente.dataAdmissao) {
      eventos.push({ id: 'admissao', data: doente.dataAdmissao.toISOString(), categoria: 'admissao', titulo: 'Admissão hospitalar', cor: '#2563eb', icone: '🏥' });
    }
    if (doente.dataAlta) {
      eventos.push({ id: 'alta', data: doente.dataAlta.toISOString(), categoria: 'alta', titulo: 'Alta hospitalar', cor: '#059669', icone: '🏠' });
    }
    for (const s of sinaisVitais) {
      const parts: string[] = [];
      if (s.pressaoSistolica) parts.push(`TA ${s.pressaoSistolica}/${s.pressaoDiastolica ?? '?'}`);
      if (s.pulso) parts.push(`FC ${s.pulso}`);
      if (s.saturacaoO2) parts.push(`SpO₂ ${s.saturacaoO2}%`);
      if (s.news2 != null) parts.push(`NEWS2=${s.news2}`);
      eventos.push({ id: s.id, data: new Date(s.data).toISOString(), categoria: 'sinal_vital', titulo: 'Sinais vitais', detalhe: parts.join(' · '), cor: s.news2 != null && s.news2 >= 5 ? '#dc2626' : '#0891b2', icone: '📊' });
    }
    for (const m of medicacoes) {
      eventos.push({ id: m.id, data: new Date(m.iniciadoEm).toISOString(), categoria: 'medicacao', titulo: `Prescrição: ${m.nome} ${m.dose}`, detalhe: `${m.via} · ${m.frequencia}${m.ativo ? '' : ' (descontinuada)'}`, cor: '#7c3aed', icone: '💊' });
    }
    for (const r of registosMed) {
      eventos.push({ id: r.id, data: new Date(r.administradoEm).toISOString(), categoria: 'administracao', titulo: r.naoAdministrada ? `Não administrado: ${r.medicacao.nome}` : `Administrado: ${r.medicacao.nome} ${r.medicacao.dose}`, detalhe: r.naoAdministrada ? `Motivo: ${r.motivoNaoAdmin}` : `Por: ${r.administradoPor.nome}`, cor: r.naoAdministrada ? '#f59e0b' : '#059669', icone: r.naoAdministrada ? '⚠' : '✓' });
    }
    for (const n of notasClinicas as any[]) {
      eventos.push({ id: n.id, data: new Date(n.criadaEm).toISOString(), categoria: 'nota', titulo: `Nota ${n.tipo ?? 'clínica'}`, detalhe: n.texto?.slice(0, 120), cor: '#374151', icone: '📝' });
    }
    for (const t of tarefas) {
      eventos.push({ id: t.id, data: new Date(t.criadaEm).toISOString(), categoria: 'tarefa', titulo: t.descricao, detalhe: `${t.prioridade} · ${t.estado}`, cor: t.prioridade === 'urgente' ? '#dc2626' : '#f59e0b', icone: '✅' });
    }
    for (const a of alertas) {
      eventos.push({ id: a.id, data: new Date(a.criadoEm).toISOString(), categoria: 'alerta', titulo: a.mensagem, detalhe: a.tipo, cor: a.urgencia ? '#dc2626' : '#f59e0b', icone: '🚨' });
    }
    for (const e of exames as any[]) {
      eventos.push({ id: e.id, data: new Date(e.criadoEm).toISOString(), categoria: 'exame', titulo: `Exame: ${e.tipo ?? e.descricao}`, detalhe: e.resultado ? `Resultado: ${e.resultado.slice(0, 80)}` : e.estado, cor: '#0284c7', icone: '🔬' });
    }

    eventos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return { doente: { id: doente.id, nome: doente.nome }, total: eventos.length, eventos };
  }
}

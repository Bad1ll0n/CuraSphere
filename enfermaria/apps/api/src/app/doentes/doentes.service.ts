import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoDoente } from '../common/enums';

@Injectable()
export class DoenteService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(utilizadorId: string, role: string) {
    const restritos = ['enfermeiro', 'medico'];
    const where = restritos.includes(role)
      ? { ativo: true, atribuicoesHorario: { some: { utilizadorId } } }
      : { ativo: true };

    return this.prisma.doente.findMany({
      where,
      include: {
        cama: true,
        atribuicoes: {
          include: { enfermeiro: { select: { id: true, nome: true, role: true } } },
        },
      },
      orderBy: { dataAdmissao: 'desc' },
    });
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
    responsavelId: string;
    prazo?: Date;
  }) {
    await this.verificarTurnoAtivo(criadoPorId);
    await this.buscarPorId(doenteId);
    return this.prisma.tarefa.create({
      data: {
        doenteId,
        criadoPorId,
        descricao: data.descricao,
        tipo: data.tipo as any,
        prioridade: data.prioridade as any,
        responsavelId: data.responsavelId,
        prazo: data.prazo ? new Date(data.prazo) : undefined,
      },
      include: {
        responsavel: { select: { id: true, nome: true, role: true } },
        criadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
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

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const include = {
  solicitante: { select: { id: true, nome: true, role: true, equipa: true } },
  destinatario: { select: { id: true, nome: true, role: true, equipa: true } },
  turno: { select: { id: true, tipo: true, data: true } },
  aprovadoPor: { select: { id: true, nome: true } },
};

@Injectable()
export class TrocasService {
  private readonly logger = new Logger(TrocasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async listar(utilizadorId: string) {
    // Verificar se o utilizador é chefe de algum turno (menor ordemExperiencia no grupo)
    const turnosComoChefe = await this._turnosOndeEChefe(utilizadorId);
    const turnoIds = turnosComoChefe.map((t) => t.id);

    const [meusPedidos, paraAprovar] = await Promise.all([
      this.prisma.pedidoTrocaTurno.findMany({
        where: { OR: [{ solicitanteId: utilizadorId }, { destinatarioId: utilizadorId }] },
        include,
        orderBy: { criadoEm: 'desc' },
      }),
      turnoIds.length > 0
        ? this.prisma.pedidoTrocaTurno.findMany({
            where: { estado: 'pendente_chefe', turnoId: { in: turnoIds } },
            include,
            orderBy: { criadoEm: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    // Merge sem duplicados
    const vistos = new Set(meusPedidos.map((p) => p.id));
    const extras = paraAprovar.filter((p) => !vistos.has(p.id));
    return [...meusPedidos, ...extras];
  }

  // Devolve os turnos onde o utilizador tem menor ordemExperiencia no seu grupo (role)
  private async _turnosOndeEChefe(utilizadorId: string) {
    const eu = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
      select: { role: true, ordemExperiencia: true },
    });
    if (!eu) return [];

    // Todos os turnos onde participa
    const participacoes = await this.prisma.horarioTurnoProfissional.findMany({
      where: { utilizadorId },
      select: {
        horarioTurno: {
          select: {
            id: true,
            profissionais: {
              include: { utilizador: { select: { id: true, role: true, ordemExperiencia: true } } },
            },
          },
        },
      },
    });

    const turnosChefe: { id: string }[] = [];
    for (const { horarioTurno: turno } of participacoes) {
      const grupo = turno.profissionais
        .filter((p) => p.utilizador.role === eu.role)
        .sort((a, b) => (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999));
      if (grupo[0]?.utilizador.id === utilizadorId) {
        turnosChefe.push({ id: turno.id });
      }
    }
    return turnosChefe;
  }

  // Verifica se o utilizador é o chefe do turno do pedido
  private async _eChefeDoPedido(pedidoId: string, utilizadorId: string) {
    const pedido = await this.prisma.pedidoTrocaTurno.findUnique({
      where: { id: pedidoId },
      select: { turnoId: true },
    });
    if (!pedido) return false;
    const turnoId = pedido.turnoId;
    const turnosComoChefe = await this._turnosOndeEChefe(utilizadorId);
    return turnosComoChefe.some((t) => t.id === turnoId);
  }

  // Colegas do mesmo role no mesmo turno ou na mesma escala
  async colegasDisponiveis(solicitanteId: string, turnoId: string) {
    const turno = await this.prisma.horarioTurno.findUnique({
      where: { id: turnoId },
      include: {
        profissionais: { include: { utilizador: { select: { id: true, nome: true, role: true, equipa: true } } } },
        escala: true,
      },
    });
    if (!turno) throw new NotFoundException(`Turno (ID ${turnoId}) não encontrado`);

    const solicitante = turno.profissionais.find((p) => p.utilizadorId === solicitanteId);
    if (!solicitante) throw new BadRequestException('Não pertences a este turno');

    const role = solicitante.utilizador.role;

    // Buscar todos os utilizadores do mesmo role ativos (excluindo o próprio)
    return this.prisma.utilizador.findMany({
      where: { role, ativo: true, id: { not: solicitanteId } },
      select: { id: true, nome: true, role: true, equipa: true, ordemExperiencia: true },
      orderBy: [{ equipa: 'asc' }, { ordemExperiencia: 'asc' }],
    });
  }

  async criar(solicitanteId: string, turnoId: string, destinatarioId: string) {
    const turno = await this.prisma.horarioTurno.findUnique({
      where: { id: turnoId },
      include: { profissionais: true },
    });
    if (!turno) throw new NotFoundException(`Turno (ID ${turnoId}) não encontrado`);
    if (!turno.profissionais.some((p) => p.utilizadorId === solicitanteId)) {
      throw new BadRequestException('Não pertences a este turno');
    }

    const existente = await this.prisma.pedidoTrocaTurno.findFirst({
      where: { solicitanteId, turnoId, destinatarioId, estado: { in: ['pendente_destinatario', 'pendente_chefe'] } },
    });
    if (existente) throw new BadRequestException('Já existe um pedido pendente para este turno e colega');

    const pedido = await this.prisma.pedidoTrocaTurno.create({
      data: { solicitanteId, turnoId, destinatarioId },
      include,
    });

    // Notificar o destinatário
    const solicitante = await this.prisma.utilizador.findUnique({ where: { id: solicitanteId }, select: { nome: true } });
    this.notificacoes.enviarParaUtilizador(
      destinatarioId,
      'Pedido de Troca de Turno',
      `${solicitante?.nome ?? 'Um colega'} solicitou uma troca de turno consigo.`,
      { tipo: 'troca', pedidoId: pedido.id },
    ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    return pedido;
  }

  async responderDestinatario(pedidoId: string, utilizadorId: string, aceitar: boolean) {
    const pedido = await this.prisma.pedidoTrocaTurno.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException(`Pedido de troca (ID ${pedidoId}) não encontrado`);
    if (pedido.destinatarioId !== utilizadorId) throw new ForbiddenException('Não és o destinatário');
    if (pedido.estado !== 'pendente_destinatario') throw new BadRequestException('Pedido já respondido');

    const resultado = await this.prisma.pedidoTrocaTurno.update({
      where: { id: pedidoId },
      data: { estado: aceitar ? 'pendente_chefe' : 'rejeitado', respondidoEm: new Date() },
      include,
    });

    if (aceitar) {
      // Notificar o solicitante que o destinatário aceitou
      this.notificacoes.enviarParaUtilizador(
        pedido.solicitanteId,
        'Troca Aceite — Aguarda Aprovação',
        `${resultado.destinatario.nome} aceitou a troca. Aguarda aprovação do chefe de turno.`,
        { tipo: 'troca', pedidoId },
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    } else {
      this.notificacoes.enviarParaUtilizador(
        pedido.solicitanteId,
        'Troca Recusada',
        `${resultado.destinatario.nome} recusou o pedido de troca de turno.`,
        { tipo: 'troca', pedidoId },
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }

    return resultado;
  }

  async aprovarChefe(pedidoId: string, chefeId: string, aprovar: boolean) {
    const pedido = await this.prisma.pedidoTrocaTurno.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException(`Pedido de troca (ID ${pedidoId}) não encontrado`);
    if (pedido.estado !== 'pendente_chefe') throw new BadRequestException('Pedido não está pendente de aprovação');

    const eChefe = await this._eChefeDoPedido(pedidoId, chefeId);
    if (!eChefe) throw new ForbiddenException('Apenas o chefe do turno pode aprovar esta troca');

    if (!aprovar) {
      return this.prisma.pedidoTrocaTurno.update({
        where: { id: pedidoId },
        data: { estado: 'rejeitado', aprovadoPorId: chefeId, respondidoEm: new Date() },
        include,
      });
    }

    // Aprovar: remover solicitante do turno e adicionar destinatário
    return this.prisma.$transaction(async (tx) => {
      await tx.horarioTurnoProfissional.delete({
        where: { horarioTurnoId_utilizadorId: { horarioTurnoId: pedido.turnoId, utilizadorId: pedido.solicitanteId } },
      });
      await tx.horarioTurnoProfissional.upsert({
        where: { horarioTurnoId_utilizadorId: { horarioTurnoId: pedido.turnoId, utilizadorId: pedido.destinatarioId } },
        create: { horarioTurnoId: pedido.turnoId, utilizadorId: pedido.destinatarioId },
        update: {},
      });
      const aprovado = await tx.pedidoTrocaTurno.update({
        where: { id: pedidoId },
        data: { estado: 'aprovado', aprovadoPorId: chefeId, respondidoEm: new Date() },
        include,
      });
      // Notificar ambas as partes
      this.notificacoes.enviarParaUtilizador(
        pedido.solicitanteId,
        'Troca de Turno Aprovada ✅',
        'O chefe de turno aprovou a sua troca. O turno foi actualizado.',
        { tipo: 'troca', pedidoId },
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
      this.notificacoes.enviarParaUtilizador(
        pedido.destinatarioId,
        'Troca de Turno Aprovada ✅',
        'A troca de turno foi aprovada. Fique atento ao seu horário.',
        { tipo: 'troca', pedidoId },
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
      return aprovado;
    });
  }

  async cancelar(pedidoId: string, utilizadorId: string) {
    const pedido = await this.prisma.pedidoTrocaTurno.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException(`Pedido de troca (ID ${pedidoId}) não encontrado`);
    if (pedido.solicitanteId !== utilizadorId) throw new ForbiddenException('Apenas o solicitante pode cancelar');
    if (pedido.estado !== 'pendente_destinatario') throw new BadRequestException('Não é possível cancelar este pedido');
    return this.prisma.pedidoTrocaTurno.delete({ where: { id: pedidoId } });
  }
}

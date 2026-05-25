import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class FaturacaoService {
  private readonly logger = new Logger(FaturacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async listar(estado?: string, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const where = estado ? { estado: estado as any } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.episodioFaturacao.findMany({
        where,
        include: {
          doente: { select: { id: true, nome: true, numeroProcesso: true } },
          criadoPor: { select: { id: true, nome: true } },
          _count: { select: { itens: true, pagamentos: true } },
        },
        orderBy: { criadoEm: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.episodioFaturacao.count({ where }),
    ]);
    return { data, total, page, limit, totalPaginas: Math.ceil(total / limit) };
  }

  async listarPorDoente(doenteId: string) {
    return this.prisma.episodioFaturacao.findMany({
      where: { doenteId },
      include: {
        itens: true,
        pagamentos: { include: { registadoPor: { select: { id: true, nome: true } } } },
        criadoPor: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async criar(data: {
    doenteId: string;
    tipoCobertura?: string;
    notas?: string;
    criadoPorId: string;
  }) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: data.doenteId },
      select: { id: true, nome: true },
    });
    if (!doente) throw new NotFoundException(`Doente (ID ${data.doenteId}) não encontrado`);

    return this.prisma.episodioFaturacao.create({
      data: {
        doenteId: data.doenteId,
        tipoCobertura: data.tipoCobertura,
        notas: data.notas,
        criadoPorId: data.criadoPorId,
      },
      include: {
        doente: { select: { id: true, nome: true, numeroProcesso: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  async buscarPorId(id: string) {
    const ep = await this.prisma.episodioFaturacao.findUnique({
      where: { id },
      include: {
        doente: { select: { id: true, nome: true, numeroProcesso: true, dataAdmissao: true, dataAlta: true } },
        itens: { orderBy: { criadoEm: 'asc' } },
        pagamentos: {
          include: { registadoPor: { select: { id: true, nome: true } } },
          orderBy: { criadoEm: 'asc' },
        },
        criadoPor: { select: { id: true, nome: true } },
      },
    });
    if (!ep) throw new NotFoundException(`Episódio de faturação (ID ${id}) não encontrado`);
    return ep;
  }

  async adicionarItem(episodioId: string, data: {
    descricao: string;
    categoria: string;
    quantidade?: number;
    precoUnitario: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ep = await tx.episodioFaturacao.findUnique({ where: { id: episodioId } });
      if (!ep) throw new NotFoundException(`Episódio de faturação (ID ${episodioId}) não encontrado`);
      if (ep.estado === 'paga' || ep.estado === 'anulada') {
        throw new BadRequestException('Não é possível alterar um episódio pago ou anulado');
      }
      const quantidade = data.quantidade ?? 1;
      const total = quantidade * data.precoUnitario;
      const item = await tx.itemFatura.create({
        data: { episodioFaturacaoId: episodioId, ...data, quantidade, total },
      });
      await this.recalcularTotal(episodioId, tx);
      return item;
    });
  }

  async removerItem(episodioId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemFatura.findFirst({
        where: { id: itemId, episodioFaturacaoId: episodioId },
      });
      if (!item) throw new NotFoundException(`Item de fatura (ID ${itemId}) não encontrado no episódio ${episodioId}`);
      await tx.itemFatura.delete({ where: { id: itemId } });
      await this.recalcularTotal(episodioId, tx);
      return { ok: true };
    });
  }

  async registarPagamento(episodioId: string, data: {
    valor: number;
    metodo: string;
    referencia?: string;
    registadoPorId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ep = await tx.episodioFaturacao.findUnique({ where: { id: episodioId } });
      if (!ep) throw new NotFoundException(`Episódio de faturação (ID ${episodioId}) não encontrado`);
      if (ep.estado === 'anulada') throw new BadRequestException(`Episódio de faturação (ID ${episodioId}) está anulado`);
      if (ep.estado === 'paga') throw new BadRequestException(`Episódio de faturação (ID ${episodioId}) já está pago`);

      const pagamento = await tx.pagamento.create({
        data: { episodioFaturacaoId: episodioId, ...data },
        include: { registadoPor: { select: { id: true, nome: true } } },
      });

      const pagamentos = await tx.pagamento.findMany({ where: { episodioFaturacaoId: episodioId } });
      const totalPago = pagamentos.reduce((s, p) => s + p.valor, 0);
      if (totalPago >= ep.totalCobrado && ep.totalCobrado > 0) {
        await tx.episodioFaturacao.update({ where: { id: episodioId }, data: { estado: 'paga' } });
      }

      return pagamento;
    }, { isolationLevel: 'Serializable' });
  }

  async mudarEstado(episodioId: string, estado: string) {
    const ep = await this.prisma.episodioFaturacao.findUnique({
      where: { id: episodioId },
      include: { doente: { select: { id: true, nome: true } }, criadoPor: { select: { id: true } } },
    });
    if (!ep) throw new NotFoundException(`Episódio de faturação (ID ${episodioId}) não encontrado`);

    const dataEmissao = estado === 'emitida' ? new Date() : undefined;
    const updated = await this.prisma.episodioFaturacao.update({
      where: { id: episodioId },
      data: { estado: estado as any, ...(dataEmissao ? { dataEmissao } : {}) },
    });

    if (estado === 'emitida' && ep.criadoPorId) {
      this.notificacoes
        .enviarParaUtilizador(
          ep.criadoPorId,
          'Fatura emitida',
          `Fatura do doente ${(ep as any).doente?.nome ?? 'desconhecido'} foi emitida e aguarda pagamento.`,
        )
        .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }

    return updated;
  }

  async resumo(inicio?: string, fim?: string) {
    const where: any = {};
    if (inicio || fim) {
      where.criadoEm = {};
      if (inicio) where.criadoEm.gte = new Date(inicio);
      if (fim) { const f = new Date(fim); f.setHours(23, 59, 59, 999); where.criadoEm.lte = f; }
    }

    const episodios = await this.prisma.episodioFaturacao.findMany({
      where,
      include: { itens: true, pagamentos: true, doente: { select: { nome: true, numeroProcesso: true } } },
      orderBy: { criadoEm: 'desc' },
    });

    const stats = { totalFaturado: 0, totalPago: 0, totalPendente: 0, totalAnulado: 0, countPorEstado: {} as Record<string, number> };
    for (const ep of episodios) {
      stats.countPorEstado[ep.estado] = (stats.countPorEstado[ep.estado] ?? 0) + 1;
      if (ep.estado !== 'anulada') stats.totalFaturado += ep.totalCobrado;
      if (ep.estado === 'paga') stats.totalPago += ep.totalCobrado;
      if (ep.estado === 'pendente' || ep.estado === 'emitida') stats.totalPendente += ep.totalCobrado;
      if (ep.estado === 'anulada') stats.totalAnulado += ep.totalCobrado;
    }

    return { stats, episodios };
  }

  private async recalcularTotal(episodioId: string, db: any = this.prisma) {
    const itens = await db.itemFatura.findMany({ where: { episodioFaturacaoId: episodioId } });
    const totalBase = itens.reduce((s: number, i: any) => s + i.total, 0);
    await db.episodioFaturacao.update({
      where: { id: episodioId },
      data: { totalBase, totalCobrado: totalBase },
    });
  }
}

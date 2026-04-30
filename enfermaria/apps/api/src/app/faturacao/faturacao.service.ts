import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FaturacaoService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (!doente) throw new NotFoundException('Doente não encontrado');

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
    if (!ep) throw new NotFoundException('Episódio de faturação não encontrado');
    return ep;
  }

  async adicionarItem(episodioId: string, data: {
    descricao: string;
    categoria: string;
    quantidade?: number;
    precoUnitario: number;
  }) {
    const ep = await this.prisma.episodioFaturacao.findUnique({ where: { id: episodioId } });
    if (!ep) throw new NotFoundException('Episódio não encontrado');
    if (ep.estado === 'paga' || ep.estado === 'anulada') {
      throw new BadRequestException('Não é possível alterar um episódio pago ou anulado');
    }

    const quantidade = data.quantidade ?? 1;
    const total = quantidade * data.precoUnitario;

    const item = await this.prisma.itemFatura.create({
      data: { episodioFaturacaoId: episodioId, ...data, quantidade, total },
    });

    await this.recalcularTotal(episodioId);
    return item;
  }

  async removerItem(episodioId: string, itemId: string) {
    const item = await this.prisma.itemFatura.findFirst({
      where: { id: itemId, episodioFaturacaoId: episodioId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    await this.prisma.itemFatura.delete({ where: { id: itemId } });
    await this.recalcularTotal(episodioId);
    return { ok: true };
  }

  async registarPagamento(episodioId: string, data: {
    valor: number;
    metodo: string;
    referencia?: string;
    registadoPorId: string;
  }) {
    const ep = await this.prisma.episodioFaturacao.findUnique({ where: { id: episodioId } });
    if (!ep) throw new NotFoundException('Episódio não encontrado');
    if (ep.estado === 'anulada') throw new BadRequestException('Episódio anulado');

    const pagamento = await this.prisma.pagamento.create({
      data: { episodioFaturacaoId: episodioId, ...data },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });

    // Verificar se total pago cobre totalCobrado
    const pagamentos = await this.prisma.pagamento.findMany({ where: { episodioFaturacaoId: episodioId } });
    const totalPago = pagamentos.reduce((s, p) => s + p.valor, 0);
    if (totalPago >= ep.totalCobrado && ep.totalCobrado > 0) {
      await this.prisma.episodioFaturacao.update({ where: { id: episodioId }, data: { estado: 'paga' } });
    }

    return pagamento;
  }

  async mudarEstado(episodioId: string, estado: string) {
    const ep = await this.prisma.episodioFaturacao.findUnique({ where: { id: episodioId } });
    if (!ep) throw new NotFoundException('Episódio não encontrado');

    const dataEmissao = estado === 'emitida' ? new Date() : undefined;
    return this.prisma.episodioFaturacao.update({
      where: { id: episodioId },
      data: { estado: estado as any, ...(dataEmissao ? { dataEmissao } : {}) },
    });
  }

  private async recalcularTotal(episodioId: string) {
    const itens = await this.prisma.itemFatura.findMany({ where: { episodioFaturacaoId: episodioId } });
    const totalBase = itens.reduce((s, i) => s + i.total, 0);
    await this.prisma.episodioFaturacao.update({
      where: { id: episodioId },
      data: { totalBase, totalCobrado: totalBase },
    });
  }
}

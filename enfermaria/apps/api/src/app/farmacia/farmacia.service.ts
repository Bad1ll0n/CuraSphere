import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class FarmaciaService {
  private readonly logger = new Logger(FarmaciaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async listarStock(servico?: string, page = 1, limit = 100) {
    return this.prisma.stockItem.findMany({
      where: servico ? { servico } : {},
      orderBy: { nome: 'asc' },
      include: { catalogo: { select: { dci: true, classeTerap: true } } },
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  async criarStockItem(dto: {
    nome: string;
    tipo: string;
    quantidade: number;
    quantidadeMinima: number;
    unidade: string;
    validade?: string;
    servico: string;
    precoUnitario?: number;
    catalogoId?: string;
  }) {
    return this.prisma.stockItem.create({
      data: {
        nome: dto.nome,
        tipo: dto.tipo as any,
        quantidade: dto.quantidade,
        quantidadeMinima: dto.quantidadeMinima,
        unidade: dto.unidade,
        servico: dto.servico,
        precoUnitario: dto.precoUnitario,
        catalogoId: dto.catalogoId,
        validade: dto.validade ? new Date(dto.validade) : null,
      },
    });
  }

  /**
   * F5: a leitura acontecia FORA da transacção e a escrita era de valor absoluto. Dois ajustes
   * ao mesmo tempo liam a mesma quantidade, e o segundo escrevia por cima do primeiro — e o
   * `delta` guardado deixava de bater certo com o stock, portanto o rasto de auditoria do
   * inventário deixava de reconciliar. O padrão certo já estava no `dispensar`, cem linhas
   * abaixo: tudo dentro da mesma transacção Serializable.
   */
  async atualizarQuantidade(id: string, novaQuantidade: number, motivo: string, tipo: string, utilizadorId: string) {
    if (!Number.isFinite(novaQuantidade) || novaQuantidade < 0) {
      throw new BadRequestException('Quantidade inválida');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException(`Item de stock (ID ${id}) não encontrado`);

      const delta = novaQuantidade - item.quantidade;

      // O valor lido entra no `where`: se alguém mexeu entretanto, isto não escreve nada.
      const actualizado = await tx.stockItem.updateMany({
        where: { id, quantidade: item.quantidade },
        data: { quantidade: novaQuantidade },
      });
      if (actualizado.count === 0) {
        throw new ConflictException(
          'O stock deste item mudou entretanto — confirme a quantidade actual e repita o ajuste',
        );
      }

      await tx.ajusteStock.create({ data: { stockItemId: id, delta, tipo, motivo, utilizadorId } });
      return tx.stockItem.findUnique({ where: { id } });
    }, { isolationLevel: 'Serializable' });
  }

  async historicoAjustes(stockItemId: string) {
    const item = await this.prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (!item) throw new NotFoundException(`Item de stock (ID ${stockItemId}) não encontrado`);
    return this.prisma.ajusteStock.findMany({
      where: { stockItemId },
      orderBy: { criadoEm: 'desc' },
      include: { utilizador: { select: { id: true, nome: true, role: true } } },
    });
  }

  async criarPedido(dto: { stockItemId: string; quantidade: number; servico: string; observacoes?: string }, solicitadoPorId: string) {
    return this.prisma.pedidoFarmacia.create({
      data: { stockItemId: dto.stockItemId, quantidade: dto.quantidade, servico: dto.servico, observacoes: dto.observacoes ?? null, solicitadoPorId },
      include: { stockItem: true, solicitadoPor: { select: { id: true, nome: true, servico: true } } },
    });
  }

  async listarPedidos(servico?: string, page = 1, limit = 100) {
    return this.prisma.pedidoFarmacia.findMany({
      where: servico ? { servico } : {},
      orderBy: { criadoEm: 'desc' },
      include: { stockItem: true, solicitadoPor: { select: { id: true, nome: true } }, processadoPor: { select: { id: true, nome: true } } },
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  async pedidosPendentesAprovacao(servico?: string) {
    return this.prisma.pedidoFarmacia.findMany({
      where: { estado: 'pendente', ...(servico ? { servico } : {}) },
      orderBy: { criadoEm: 'asc' },
      include: {
        stockItem: { select: { id: true, nome: true, unidade: true, quantidade: true } },
        solicitadoPor: { select: { id: true, nome: true, role: true, servico: true } },
      },
    });
  }

  async aprovarPedido(id: string, aprovadoPorId: string) {
    const pedido = await this.prisma.pedidoFarmacia.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException(`Pedido de farmácia (ID ${id}) não encontrado`);
    if (pedido.estado !== 'pendente') throw new BadRequestException(`Pedido já está ${pedido.estado} — só pedidos pendentes podem ser aprovados`);

    const resultado = await this.prisma.pedidoFarmacia.update({
      where: { id },
      data: { estado: 'aprovado', aprovadoPorId, aprovadoEm: new Date() },
      include: {
        stockItem: { select: { nome: true, unidade: true } },
        aprovadoPor: { select: { id: true, nome: true } },
        solicitadoPor: { select: { id: true, nome: true } },
      },
    });

    this.notificacoes.enviarParaUtilizador(
      pedido.solicitadoPorId,
      'Pedido de farmácia aprovado',
      `O teu pedido de ${resultado.stockItem.nome} (${pedido.quantidade} ${resultado.stockItem.unidade}) foi aprovado pelo médico.`,
      { pedidoFarmaciaId: id },
    ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    return resultado;
  }

  async rejeitarPedido(id: string, aprovadoPorId: string, motivoRejeicao: string) {
    const pedido = await this.prisma.pedidoFarmacia.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException(`Pedido de farmácia (ID ${id}) não encontrado`);
    if (pedido.estado !== 'pendente') throw new BadRequestException(`Pedido já está ${pedido.estado} — só pedidos pendentes podem ser rejeitados`);

    const resultado = await this.prisma.pedidoFarmacia.update({
      where: { id },
      data: { estado: 'rejeitado', aprovadoPorId, aprovadoEm: new Date(), motivoRejeicao },
      include: {
        stockItem: { select: { nome: true } },
        aprovadoPor: { select: { id: true, nome: true } },
        solicitadoPor: { select: { id: true, nome: true } },
      },
    });

    this.notificacoes.enviarParaUtilizador(
      pedido.solicitadoPorId,
      'Pedido de farmácia rejeitado',
      `O teu pedido de ${resultado.stockItem.nome} foi rejeitado: ${motivoRejeicao}`,
      { pedidoFarmaciaId: id },
    ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    return resultado;
  }

  async dispensar(id: string, processadoPorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoFarmacia.findUnique({ where: { id } });
      if (!pedido) throw new NotFoundException('Pedido não encontrado');
      if (pedido.estado !== 'aprovado') {
        if (pedido.estado === 'pendente') throw new BadRequestException('Pedido ainda não foi aprovado pelo médico responsável');
        throw new BadRequestException(`Pedido já foi processado (estado: ${pedido.estado})`);
      }

      const item = await tx.stockItem.findUnique({ where: { id: pedido.stockItemId } });
      if (!item) throw new NotFoundException('Item de stock não encontrado');
      if (item.quantidade < pedido.quantidade) throw new BadRequestException(`Stock insuficiente: disponível ${item.quantidade} ${item.unidade}, solicitado ${pedido.quantidade}`);

      await tx.stockItem.update({
        where: { id: pedido.stockItemId },
        data: { quantidade: { decrement: pedido.quantidade } },
      });
      return tx.pedidoFarmacia.update({
        where: { id },
        data: { estado: 'dispensado', processadoPorId },
        include: { stockItem: { select: { nome: true, unidade: true } } },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async alertas() {
    const em30Dias = new Date(); em30Dias.setDate(em30Dias.getDate() + 30);
    const items = await this.prisma.stockItem.findMany();
    return {
      stockMinimo: items.filter(i => i.quantidade <= i.quantidadeMinima),
      validadeProxima: items.filter(i => i.validade && i.validade <= em30Dias),
    };
  }

  // ── Transferências entre serviços ────────────────────────────────────────────

  async criarTransferencia(stockItemId: string, servicoDestino: string, quantidade: number, motivo: string | undefined, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!item) throw new NotFoundException('Item não encontrado');
      if (item.quantidade < quantidade) throw new BadRequestException('Quantidade insuficiente em stock');

      return tx.transferenciaStock.create({
        data: {
          stockItemId,
          quantidade,
          servicoOrigem: item.servico,
          servicoDestino,
          motivo,
          solicitadoPorId: userId,
        },
        include: { stockItem: { select: { nome: true, unidade: true } } },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async confirmarTransferencia(transferenciaId: string, userId: string) {
    // Toda a leitura-guarda-escrita corre dentro da mesma transacção Serializable
    // (mesmo padrão de `dispensar`): fora dela, dois pedidos simultâneos passavam
    // ambos nos guards e aplicavam a transferência duas vezes.
    await this.prisma.$transaction(async (tx) => {
      const transf = await tx.transferenciaStock.findUnique({
        where: { id: transferenciaId },
        include: { stockItem: true },
      });
      if (!transf) throw new NotFoundException('Transferência não encontrada');
      if (transf.estado !== 'pendente') throw new BadRequestException('Transferência já processada');
      if (transf.stockItem.quantidade < transf.quantidade) throw new BadRequestException('Quantidade insuficiente em stock');

      // Fecha a transferência primeiro, com o estado esperado no `where`. Se outro
      // pedido já a fechou, `count` vem a 0 e abortamos antes de tocar em stock.
      const fecho = await tx.transferenciaStock.updateMany({
        where: { id: transferenciaId, estado: 'pendente' },
        data: { estado: 'confirmada', confirmadoPorId: userId },
      });
      if (fecho.count === 0) throw new BadRequestException('Transferência já processada');

      // Débito com a quantidade disponível no `where` — nunca deixa o stock negativo.
      const debito = await tx.stockItem.updateMany({
        where: { id: transf.stockItemId, quantidade: { gte: transf.quantidade } },
        data: { quantidade: { decrement: transf.quantidade } },
      });
      if (debito.count === 0) throw new BadRequestException('Quantidade insuficiente em stock');

      const itemDestino = await tx.stockItem.findFirst({
        where: { nome: transf.stockItem.nome, servico: transf.servicoDestino },
      });

      if (itemDestino) {
        await tx.stockItem.update({
          where: { id: itemDestino.id },
          data: { quantidade: { increment: transf.quantidade } },
        });
        await tx.ajusteStock.create({
          data: {
            stockItemId: itemDestino.id,
            delta: transf.quantidade,
            tipo: 'transferencia',
            motivo: `Transferência recebida de ${transf.servicoOrigem}`,
            utilizadorId: userId,
          },
        });
      } else {
        const novoItem = await tx.stockItem.create({
          data: {
            nome: transf.stockItem.nome,
            tipo: transf.stockItem.tipo,
            quantidade: transf.quantidade,
            quantidadeMinima: transf.stockItem.quantidadeMinima,
            unidade: transf.stockItem.unidade,
            servico: transf.servicoDestino,
            precoUnitario: transf.stockItem.precoUnitario,
            catalogoId: transf.stockItem.catalogoId,
          },
        });
        await tx.ajusteStock.create({
          data: {
            stockItemId: novoItem.id,
            delta: transf.quantidade,
            tipo: 'transferencia',
            motivo: `Transferência recebida de ${transf.servicoOrigem}`,
            utilizadorId: userId,
          },
        });
      }

      await tx.ajusteStock.create({
        data: {
          stockItemId: transf.stockItemId,
          delta: -transf.quantidade,
          tipo: 'transferencia',
          motivo: `Transferência para ${transf.servicoDestino}`,
          utilizadorId: userId,
        },
      });
    }, { isolationLevel: 'Serializable' });

    return { success: true };
  }

  async cancelarTransferencia(transferenciaId: string) {
    // Mesmo racional do confirmar: o estado esperado vai no `where` para que um
    // cancelamento não possa vencer uma confirmação já em curso (ou vice-versa).
    return this.prisma.$transaction(async (tx) => {
      const transf = await tx.transferenciaStock.findUnique({ where: { id: transferenciaId } });
      if (!transf) throw new NotFoundException('Transferência não encontrada');
      if (transf.estado !== 'pendente') throw new BadRequestException('Apenas transferências pendentes podem ser canceladas');

      const cancelada = await tx.transferenciaStock.updateMany({
        where: { id: transferenciaId, estado: 'pendente' },
        data: { estado: 'cancelada' },
      });
      if (cancelada.count === 0) throw new BadRequestException('Apenas transferências pendentes podem ser canceladas');

      return tx.transferenciaStock.findUniqueOrThrow({ where: { id: transferenciaId } });
    }, { isolationLevel: 'Serializable' });
  }

  async listarTransferencias(servico?: string) {
    return this.prisma.transferenciaStock.findMany({
      where: servico ? { OR: [{ servicoOrigem: servico }, { servicoDestino: servico }] } : {},
      orderBy: { criadoEm: 'desc' },
      include: {
        stockItem: { select: { id: true, nome: true, unidade: true } },
        solicitadoPor: { select: { id: true, nome: true } },
        confirmadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  // ── Relatório de gastos ──────────────────────────────────────────────────────

  async relatorioGastos(servico?: string, dataInicio?: string, dataFim?: string) {
    const ajustes = await this.prisma.ajusteStock.findMany({
      where: {
        delta: { lt: 0 },
        ...(dataInicio || dataFim ? {
          criadoEm: {
            ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
            ...(dataFim ? { lte: new Date(dataFim) } : {}),
          },
        } : {}),
        ...(servico ? { stockItem: { servico } } : {}),
      },
      include: {
        stockItem: { select: { nome: true, servico: true, precoUnitario: true, unidade: true } },
      },
    });

    const porItem = new Map<string, { nome: string; servico: string; unidade: string; consumo: number; custo: number }>();
    let custoTotal = 0;

    for (const a of ajustes) {
      const key = a.stockItemId;
      const consumo = Math.abs(a.delta);
      const custo = a.stockItem.precoUnitario ? consumo * a.stockItem.precoUnitario : 0;
      custoTotal += custo;

      if (!porItem.has(key)) {
        porItem.set(key, { nome: a.stockItem.nome, servico: a.stockItem.servico, unidade: a.stockItem.unidade, consumo: 0, custo: 0 });
      }
      const entry = porItem.get(key)!;
      entry.consumo += consumo;
      entry.custo += custo;
    }

    return {
      custoTotal: Math.round(custoTotal * 100) / 100,
      itens: [...porItem.values()].sort((a, b) => b.custo - a.custo),
    };
  }
}

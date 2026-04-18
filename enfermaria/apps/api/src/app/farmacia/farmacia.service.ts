import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FarmaciaService {
  constructor(private readonly prisma: PrismaService) {}

  async listarStock(servico?: string) {
    return this.prisma.stockItem.findMany({
      where: servico ? { servico } : {},
      orderBy: { nome: 'asc' },
    });
  }

  async criarStockItem(dto: { nome: string; tipo: string; quantidade: number; quantidadeMinima: number; unidade: string; validade?: string; servico: string }) {
    return this.prisma.stockItem.create({
      data: { nome: dto.nome, tipo: dto.tipo as any, quantidade: dto.quantidade, quantidadeMinima: dto.quantidadeMinima, unidade: dto.unidade, servico: dto.servico, validade: dto.validade ? new Date(dto.validade) : null },
    });
  }

  async atualizarQuantidade(id: string, quantidade: number) {
    const item = await this.prisma.stockItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item não encontrado');
    return this.prisma.stockItem.update({ where: { id }, data: { quantidade } });
  }

  async criarPedido(dto: { stockItemId: string; quantidade: number; servico: string; observacoes?: string }, solicitadoPorId: string) {
    return this.prisma.pedidoFarmacia.create({
      data: { stockItemId: dto.stockItemId, quantidade: dto.quantidade, servico: dto.servico, observacoes: dto.observacoes ?? null, solicitadoPorId },
      include: { stockItem: true, solicitadoPor: { select: { id: true, nome: true, servico: true } } },
    });
  }

  async listarPedidos(servico?: string) {
    return this.prisma.pedidoFarmacia.findMany({
      where: servico ? { servico } : {},
      orderBy: { criadoEm: 'desc' },
      include: { stockItem: true, solicitadoPor: { select: { id: true, nome: true } }, processadoPor: { select: { id: true, nome: true } } },
    });
  }

  async dispensar(id: string, processadoPorId: string) {
    const pedido = await this.prisma.pedidoFarmacia.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    await this.prisma.stockItem.update({ where: { id: pedido.stockItemId }, data: { quantidade: { decrement: pedido.quantidade } } });
    return this.prisma.pedidoFarmacia.update({ where: { id }, data: { estado: 'dispensado', processadoPorId } });
  }

  async alertas() {
    const em30Dias = new Date(); em30Dias.setDate(em30Dias.getDate() + 30);
    const items = await this.prisma.stockItem.findMany();
    return {
      stockMinimo: items.filter(i => i.quantidade <= i.quantidadeMinima),
      validadeProxima: items.filter(i => i.validade && i.validade <= em30Dias),
    };
  }
}

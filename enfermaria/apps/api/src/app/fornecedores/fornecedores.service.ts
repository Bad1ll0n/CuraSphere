import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.fornecedor.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { encomendas: true } } },
    });
  }

  criar(dto: { nome: string; nif?: string; email?: string; telefone?: string; morada?: string }) {
    return this.prisma.fornecedor.create({ data: dto });
  }

  async atualizar(id: string, dto: Partial<{ nome: string; nif: string; email: string; telefone: string; morada: string }>) {
    await this.findFornecedorOrFail(id);
    return this.prisma.fornecedor.update({ where: { id }, data: dto });
  }

  async desativar(id: string) {
    await this.findFornecedorOrFail(id);
    return this.prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
  }

  listarEncomendas(estado?: string) {
    return this.prisma.encomendaFornecedor.findMany({
      where: estado ? { estado } : {},
      orderBy: { criadoEm: 'desc' },
      include: {
        fornecedor: { select: { id: true, nome: true } },
        stockItem: { select: { id: true, nome: true, unidade: true, servico: true } },
        recebioPor: { select: { id: true, nome: true } },
      },
    });
  }

  async criarEncomenda(dto: {
    fornecedorId: string;
    stockItemId: string;
    quantidadeEncomendada: number;
    precoUnitario?: number;
    dataEntregaPrevista?: string;
    observacoes?: string;
  }) {
    await this.findFornecedorOrFail(dto.fornecedorId);
    const item = await this.prisma.stockItem.findUnique({ where: { id: dto.stockItemId } });
    if (!item) throw new NotFoundException(`Item de stock (ID ${dto.stockItemId}) não encontrado`);

    return this.prisma.encomendaFornecedor.create({
      data: {
        fornecedorId: dto.fornecedorId,
        stockItemId: dto.stockItemId,
        quantidadeEncomendada: dto.quantidadeEncomendada,
        precoUnitario: dto.precoUnitario,
        dataEntregaPrevista: dto.dataEntregaPrevista ? new Date(dto.dataEntregaPrevista) : undefined,
        observacoes: dto.observacoes,
      },
      include: {
        fornecedor: { select: { nome: true } },
        stockItem: { select: { nome: true, unidade: true } },
      },
    });
  }

  async receberEncomenda(encId: string, quantidadeRecebida: number, userId: string) {
    const enc = await this.prisma.encomendaFornecedor.findUnique({
      where: { id: encId },
      include: { stockItem: true },
    });
    if (!enc) throw new NotFoundException(`Encomenda (ID ${encId}) não encontrada`);
    if (enc.estado === 'cancelada') throw new BadRequestException('Encomenda cancelada não pode ser recebida');

    const novaQuantidade = enc.stockItem.quantidade + quantidadeRecebida;

    await this.prisma.$transaction([
      this.prisma.encomendaFornecedor.update({
        where: { id: encId },
        data: {
          estado: 'recebida',
          dataEntregaReal: new Date(),
          recebioPorId: userId,
        },
      }),
      this.prisma.stockItem.update({
        where: { id: enc.stockItemId },
        data: { quantidade: novaQuantidade },
      }),
      this.prisma.ajusteStock.create({
        data: {
          stockItemId: enc.stockItemId,
          delta: quantidadeRecebida,
          tipo: 'encomenda',
          motivo: `Recepção de encomenda #${encId.slice(-8)}`,
          utilizadorId: userId,
        },
      }),
    ]);

    return { success: true };
  }

  private async findFornecedorOrFail(id: string) {
    const f = await this.prisma.fornecedor.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Fornecedor não encontrado');
    return f;
  }
}

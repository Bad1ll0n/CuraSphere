import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PedidosInternosService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: {
    tipo: string; doenteId?: string; localOrigem?: string; localDestino?: string;
    descricao: string; prioridade: string; servicoOrigem: string;
  }, solicitadoPorId: string) {
    return this.prisma.pedidoInterno.create({
      data: { tipo: dto.tipo as any, doenteId: dto.doenteId ?? null, localOrigem: dto.localOrigem ?? null, localDestino: dto.localDestino ?? null, descricao: dto.descricao, prioridade: dto.prioridade as any, servicoOrigem: dto.servicoOrigem, solicitadoPorId },
      include: this.includeRelations(),
    });
  }

  async listar(servico?: string) {
    return this.prisma.pedidoInterno.findMany({
      where: servico ? { OR: [{ servicoOrigem: servico }, { tipo: 'transporte', estado: 'pendente' }] } : {},
      orderBy: [{ prioridade: 'asc' }, { criadoEm: 'asc' }],
      include: this.includeRelations(),
    });
  }

  async aceitar(id: string, executadoPorId: string) {
    await this.buscar(id);
    return this.prisma.pedidoInterno.update({ where: { id }, data: { estado: 'em_curso', executadoPorId } });
  }

  async concluir(id: string) {
    await this.buscar(id);
    return this.prisma.pedidoInterno.update({ where: { id }, data: { estado: 'concluido', concluidoEm: new Date() } });
  }

  private async buscar(id: string) {
    const p = await this.prisma.pedidoInterno.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Pedido não encontrado');
    return p;
  }

  private includeRelations() {
    return {
      doente: { select: { id: true, nome: true, cama: { select: { quarto: true, numero: true } } } },
      solicitadoPor: { select: { id: true, nome: true, servico: true } },
      executadoPor: { select: { id: true, nome: true } },
    };
  }
}

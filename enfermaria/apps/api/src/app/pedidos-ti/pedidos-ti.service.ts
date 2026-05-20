import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { AtualizarPedidoDto } from './dto/atualizar-pedido.dto';

const ROLES_TI = ['it_admin', 'diretor_ti', 'analista_sistemas', 'dba', 'ciberseguranca', 'bi_analyst'];

const SELECT_USER = { select: { id: true, nome: true, role: true } };

@Injectable()
export class PedidosTIService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CriarPedidoDto, criadoPorId: string) {
    return this.prisma.pedidoTI.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipo: dto.tipo,
        urgente: dto.urgente ?? false,
        criadoPorId,
      },
      include: { criadoPor: SELECT_USER, responsavel: SELECT_USER },
    });
  }

  async listar(utilizadorId: string, role: string) {
    const eTI = ROLES_TI.includes(role);
    return this.prisma.pedidoTI.findMany({
      where: eTI ? undefined : { criadoPorId: utilizadorId },
      orderBy: [{ urgente: 'desc' }, { criadoEm: 'desc' }],
      include: { criadoPor: SELECT_USER, responsavel: SELECT_USER },
    });
  }

  async detalhe(id: string) {
    const p = await this.prisma.pedidoTI.findUnique({
      where: { id },
      include: { criadoPor: SELECT_USER, responsavel: SELECT_USER },
    });
    if (!p) throw new NotFoundException(`Pedido TI (ID ${id}) não encontrado`);
    return p;
  }

  async atualizar(id: string, dto: AtualizarPedidoDto, role: string) {
    if (!ROLES_TI.includes(role)) throw new ForbiddenException('Sem permissão para atualizar pedidos TI');
    await this.detalhe(id);
    return this.prisma.pedidoTI.update({
      where: { id },
      data: {
        ...(dto.estado && { estado: dto.estado }),
        ...(dto.estado === 'concluido' && { resolvidoEm: new Date() }),
        ...(dto.responsavelId !== undefined && { responsavelId: dto.responsavelId || null }),
      },
      include: { criadoPor: SELECT_USER, responsavel: SELECT_USER },
    });
  }

  async eliminar(id: string, role: string) {
    if (role !== 'it_admin') throw new ForbiddenException('Apenas it_admin pode eliminar pedidos');
    await this.detalhe(id);
    return this.prisma.pedidoTI.delete({ where: { id } });
  }
}

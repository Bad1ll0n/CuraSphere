import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExamesService {
  constructor(private readonly prisma: PrismaService) {}

  async solicitar(doenteId: string, dto: {
    tipo: string; descricao: string; urgente?: boolean; observacoes?: string;
  }, solicitadoPorId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.exame.create({
      data: { doenteId, solicitadoPorId, tipo: dto.tipo as any, descricao: dto.descricao, urgente: dto.urgente ?? false, observacoes: dto.observacoes },
      include: { solicitadoPor: { select: { id: true, nome: true, role: true } }, ficheiros: true },
    });
  }

  async listar(doenteId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.exame.findMany({
      where: { doenteId },
      orderBy: { criadoEm: 'desc' },
      include: { solicitadoPor: { select: { id: true, nome: true, role: true } }, ficheiros: true },
    });
  }

  async registarResultado(id: string, dto: {
    resultado: string; dataResultado?: Date; observacoes?: string;
  }, userId: string) {
    await this.buscarExame(id);
    const exame = await this.prisma.exame.update({
      where: { id },
      data: { resultado: dto.resultado, dataResultado: dto.dataResultado ?? new Date(), observacoes: dto.observacoes, estado: 'resultado_disponivel' },
      include: { solicitadoPor: { select: { id: true, nome: true, role: true } }, ficheiros: true },
    });

    // Auto-faturação (transaccional: episodio + item + totais são atómicos)
    if (exame.doenteId) {
      const jaExiste = await this.prisma.episodioFaturacao.findFirst({ where: { doenteId: exame.doenteId, notas: `exame:${id}` } });
      if (!jaExiste) {
        await this.prisma.$transaction(async (tx) => {
          const episodio = await tx.episodioFaturacao.create({
            data: { doenteId: exame.doenteId, estado: 'pendente', totalBase: 0, totalCobrado: 0, notas: `exame:${id}`, criadoPorId: userId },
          });
          const ato = await tx.atoClinico.findFirst({
            where: { OR: [{ especialidade: exame.tipo }, { categoria: 'exame', especialidade: null }], ativo: true },
            orderBy: { especialidade: 'desc' },
          });
          if (ato) {
            await tx.itemFatura.create({ data: { episodioFaturacaoId: episodio.id, descricao: ato.descricao, categoria: ato.categoria, quantidade: 1, precoUnitario: ato.precoBase, total: ato.precoBase } });
            await tx.episodioFaturacao.update({ where: { id: episodio.id }, data: { totalBase: ato.precoBase, totalCobrado: ato.precoBase } });
          }
        });
      }
    }

    return exame;
  }

  async worklist(tipo?: string, estado?: string) {
    const estados = estado ? [estado] : ['solicitado', 'em_progresso'];
    return this.prisma.exame.findMany({
      where: {
        estado: { in: estados as any[] },
        ...(tipo ? { tipo: tipo as any } : {}),
      },
      orderBy: [{ urgente: 'desc' }, { criadoEm: 'asc' }],
      include: {
        doente: { select: { id: true, nome: true, numeroProcesso: true, cama: { select: { numero: true, quarto: true } } } },
        solicitadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async atualizarEstado(id: string, estado: string) {
    await this.buscarExame(id);
    return this.prisma.exame.update({ where: { id }, data: { estado: estado as any } });
  }

  async cancelar(id: string) {
    const exame = await this.buscarExame(id);
    if (exame.estado === 'resultado_disponivel') throw new ForbiddenException('Exame com resultado não pode ser cancelado');
    return this.prisma.exame.update({ where: { id }, data: { estado: 'cancelado' } });
  }

  private async buscarDoente(id: string) {
    const d = await this.prisma.doente.findUnique({ where: { id } });
    if (!d) throw new NotFoundException(`Doente (ID ${id}) não encontrado`);
    return d;
  }

  private async buscarExame(id: string) {
    const e = await this.prisma.exame.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Exame não encontrado');
    return e;
  }
}

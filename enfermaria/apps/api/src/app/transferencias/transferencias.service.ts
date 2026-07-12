import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransferenciasService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly INCLUDE = {
    doente: { select: { id: true, nome: true, numeroProcesso: true } },
    solicitadoPor: { select: { id: true, nome: true } },
    aceitoPor: { select: { id: true, nome: true } },
  };

  async criar(solicitadoPorId: string, dto: {
    doenteId: string;
    hospitalDestino: string;
    servicoDestino: string;
    motivoTransfer: string;
    notas?: string;
  }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: dto.doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${dto.doenteId}) não encontrado`);

    return this.prisma.transferenciaExterna.create({
      data: {
        doenteId: dto.doenteId,
        hospitalDestino: dto.hospitalDestino,
        servicoDestino: dto.servicoDestino,
        motivoTransfer: dto.motivoTransfer,
        notas: dto.notas ?? null,
        solicitadoPorId,
        estado: 'pendente',
      },
      include: this.INCLUDE,
    });
  }

  async listar() {
    return this.prisma.transferenciaExterna.findMany({
      include: this.INCLUDE,
      orderBy: { criadoEm: 'desc' },
    });
  }

  async obter(id: string) {
    const t = await this.prisma.transferenciaExterna.findUnique({
      where: { id },
      include: this.INCLUDE,
    });
    if (!t) throw new NotFoundException(`Transferência (ID ${id}) não encontrada`);
    return t;
  }

  async atualizarEstado(
    id: string,
    aceitoPorId: string,
    dto: { estado: string; notas?: string },
  ) {
    await this.obter(id);

    const data: Record<string, any> = { estado: dto.estado };
    if (dto.notas != null) data['notas'] = dto.notas;
    if (dto.estado === 'concluida') data['concluidaEm'] = new Date();
    if (dto.estado === 'aceite_destino') data['aceitoPorId'] = aceitoPorId;

    return this.prisma.transferenciaExterna.update({
      where: { id },
      data,
      include: this.INCLUDE,
    });
  }
}

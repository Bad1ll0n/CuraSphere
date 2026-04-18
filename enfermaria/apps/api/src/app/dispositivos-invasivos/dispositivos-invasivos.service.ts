import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DispositivosInvasivosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(doenteId: string, apenasAtivos = true) {
    return this.prisma.dispositivoInvasivo.findMany({
      where: { doenteId, ...(apenasAtivos && { ativo: true }) },
      include: {
        inseridoPor: { select: { id: true, nome: true, role: true } },
      },
      orderBy: { dataInsercao: 'desc' },
    });
  }

  async registar(doenteId: string, inseridoPorId: string, dto: {
    tipo: string;
    localizacao?: string;
    observacoes?: string;
  }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    return this.prisma.dispositivoInvasivo.create({
      data: {
        doenteId,
        inseridoPorId,
        tipo: dto.tipo as any,
        localizacao: dto.localizacao,
        observacoes: dto.observacoes,
      },
      include: {
        inseridoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async remover(id: string) {
    const dispositivo = await this.prisma.dispositivoInvasivo.findUnique({ where: { id } });
    if (!dispositivo) throw new NotFoundException('Dispositivo não encontrado');

    return this.prisma.dispositivoInvasivo.update({
      where: { id },
      data: { ativo: false, dataRemocao: new Date() },
      select: { id: true, tipo: true, ativo: true, dataRemocao: true },
    });
  }
}

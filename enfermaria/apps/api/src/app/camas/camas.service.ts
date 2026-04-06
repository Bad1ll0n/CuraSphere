import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoCama } from '../common/enums';

@Injectable()
export class CamasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.cama.findMany({
      include: { doente: { select: { id: true, nome: true, estado: true, diagnosticoPrincipal: true } } },
      orderBy: [{ quarto: 'asc' }, { numero: 'asc' }],
    });
  }

  async criar(data: { numero: string; quarto: string }) {
    const existe = await this.prisma.cama.findUnique({ where: { numero: data.numero } });
    if (existe) throw new ConflictException('Número de cama já existe');

    return this.prisma.cama.create({ data });
  }

  async atualizarEstado(id: string, estado: EstadoCama) {
    const cama = await this.prisma.cama.findUnique({ where: { id } });
    if (!cama) throw new NotFoundException('Cama não encontrada');

    return this.prisma.cama.update({
      where: { id },
      data: { estado },
      include: { doente: { select: { id: true, nome: true } } },
    });
  }

  async ocupacao() {
    const [total, ocupadas, livres, emLimpeza, reservadas] = await Promise.all([
      this.prisma.cama.count(),
      this.prisma.cama.count({ where: { estado: 'ocupada' } }),
      this.prisma.cama.count({ where: { estado: 'livre' } }),
      this.prisma.cama.count({ where: { estado: 'em_limpeza' } }),
      this.prisma.cama.count({ where: { estado: 'reservada' } }),
    ]);

    return { total, ocupadas, livres, emLimpeza, reservadas };
  }
}

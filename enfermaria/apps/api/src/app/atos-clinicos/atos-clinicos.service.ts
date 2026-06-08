import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AtosClinicosService {
  constructor(private prisma: PrismaService) {}

  listar() {
    return this.prisma.atoClinico.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: 'asc' }, { descricao: 'asc' }],
    });
  }

  listarTodos() {
    return this.prisma.atoClinico.findMany({
      orderBy: [{ categoria: 'asc' }, { descricao: 'asc' }],
    });
  }

  async criar(data: {
    codigo: string;
    descricao: string;
    categoria: string;
    precoBase: number;
    especialidade?: string;
    ativo?: boolean;
  }) {
    const existe = await this.prisma.atoClinico.findUnique({ where: { codigo: data.codigo } });
    if (existe) throw new ConflictException('Código já existe');
    return this.prisma.atoClinico.create({ data });
  }

  async atualizar(id: string, data: {
    codigo?: string;
    descricao?: string;
    categoria?: string;
    precoBase?: number;
    especialidade?: string;
    ativo?: boolean;
  }) {
    await this.prisma.atoClinico.findUniqueOrThrow({ where: { id } });
    return this.prisma.atoClinico.update({ where: { id }, data });
  }

  async desativar(id: string) {
    await this.prisma.atoClinico.findUniqueOrThrow({ where: { id } });
    return this.prisma.atoClinico.update({ where: { id }, data: { ativo: false } });
  }
}

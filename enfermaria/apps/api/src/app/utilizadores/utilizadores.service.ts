import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UtilizadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(data: {
    numeroFuncionario: string;
    nome: string;
    password: string;
    role: Role;
    ordemExperiencia?: number;
  }) {
    const existe = await this.prisma.utilizador.findUnique({
      where: { numeroFuncionario: data.numeroFuncionario },
    });

    if (existe) {
      throw new ConflictException('Número de funcionário já existe');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const utilizador = await this.prisma.utilizador.create({
      data: {
        numeroFuncionario: data.numeroFuncionario,
        nome: data.nome,
        passwordHash,
        role: data.role,
        ordemExperiencia: data.ordemExperiencia,
      },
      select: {
        id: true,
        numeroFuncionario: true,
        nome: true,
        role: true,
        ordemExperiencia: true,
        equipa: true,
        ativo: true,
        criadoEm: true,
      },
    });

    return utilizador;
  }

  async listar(role?: Role) {
    return this.prisma.utilizador.findMany({
      where: { ativo: true, ...(role ? { role } : {}) },
      select: {
        id: true,
        numeroFuncionario: true,
        nome: true,
        role: true,
        ordemExperiencia: true,
        equipa: true,
        ativo: true,
        criadoEm: true,
      },
      orderBy: [{ role: 'asc' }, { ordemExperiencia: 'asc' }, { nome: 'asc' }],
    });
  }

  async buscarPorId(id: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id },
      select: {
        id: true,
        numeroFuncionario: true,
        nome: true,
        role: true,
        ordemExperiencia: true,
        equipa: true,
        ativo: true,
        criadoEm: true,
      },
    });

    if (!utilizador) throw new NotFoundException('Utilizador não encontrado');
    return utilizador;
  }

  async atualizar(id: string, data: { nome?: string; ordemExperiencia?: number; role?: Role; equipa?: string }) {
    await this.buscarPorId(id);
    return this.prisma.utilizador.update({
      where: { id },
      data,
      select: {
        id: true,
        numeroFuncionario: true,
        nome: true,
        role: true,
        ordemExperiencia: true,
        equipa: true,
        ativo: true,
      },
    });
  }

  async desativar(id: string) {
    await this.buscarPorId(id);
    return this.prisma.utilizador.update({
      where: { id },
      data: { ativo: false },
      select: { id: true, nome: true, ativo: true },
    });
  }
}

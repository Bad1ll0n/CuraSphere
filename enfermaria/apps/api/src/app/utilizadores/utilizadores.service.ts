import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Servico } from '../common/enums';
import { hashPassword } from '../common/password';

@Injectable()
export class UtilizadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(data: {
    numeroFuncionario: string;
    nome: string;
    password: string;
    role: string;
    subRole?: string;
    servico?: Servico;
    ordemExperiencia?: number;
  }) {
    const passwordHash = await hashPassword(data.password, 12);

    return this.prisma.$transaction(async (tx) => {
      const existe = await tx.utilizador.findUnique({
        where: { numeroFuncionario: data.numeroFuncionario },
      });
      if (existe) throw new ConflictException('Número de funcionário já existe');

      return tx.utilizador.create({
        data: {
          numeroFuncionario: data.numeroFuncionario,
          nome: data.nome,
          passwordHash,
          passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          role: data.role,
          subRole: data.subRole,
          servico: data.servico ?? Servico.internamento,
          ordemExperiencia: data.ordemExperiencia,
        },
        select: {
          id: true,
          numeroFuncionario: true,
          nome: true,
          role: true,
          subRole: true,
          servico: true,
          ordemExperiencia: true,
          equipa: true,
          ativo: true,
          criadoEm: true,
        },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async listar(role?: string, roles?: string[], page = 1, limit = 50) {
    let whereRole: any = {};
    if (roles && roles.length > 0) whereRole = { role: { in: roles } };
    else if (role) whereRole = { role };

    const where = { ativo: true, ...whereRole };
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.utilizador.findMany({
        where,
        select: {
          id: true,
          numeroFuncionario: true,
          nome: true,
          role: true,
          subRole: true,
          servico: true,
          ordemExperiencia: true,
          equipa: true,
          ativo: true,
          criadoEm: true,
        },
        orderBy: [{ role: 'asc' }, { ordemExperiencia: 'asc' }, { nome: 'asc' }],
        take: limit,
        skip,
      }),
      this.prisma.utilizador.count({ where }),
    ]);

    return { data, total, page, limit, totalPaginas: Math.ceil(total / limit) };
  }

  async buscarPorId(id: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id },
      select: {
        id: true,
        numeroFuncionario: true,
        nome: true,
        role: true,
        subRole: true,
        servico: true,
        ordemExperiencia: true,
        equipa: true,
        ativo: true,
        criadoEm: true,
      },
    });

    if (!utilizador) throw new NotFoundException(`Utilizador (ID ${id}) não encontrado`);
    return utilizador;
  }

  async atualizar(id: string, data: { nome?: string; ordemExperiencia?: number; role?: string; subRole?: string | null; servico?: Servico; equipa?: string; chefeId?: string | null }) {
    await this.buscarPorId(id);
    return this.prisma.utilizador.update({
      where: { id },
      data,
      select: {
        id: true,
        numeroFuncionario: true,
        nome: true,
        role: true,
        subRole: true,
        servico: true,
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

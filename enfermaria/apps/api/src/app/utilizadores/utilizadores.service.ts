import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Servico } from '../common/enums';
import { hashPassword } from '../common/password';
import { invalidarCacheSessao } from '../auth/sessao-cache';

// Campos que viajam no access token: mudá-los obriga a terminar as sessões abertas.
const CAMPOS_DO_TOKEN = ['nome', 'role', 'subRole', 'servico'] as const;

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
          // SEC-03: a password inicial é definida pelo TI e por isso conhecida por ele —
          // nasce expirada, e o primeiro login obriga o utilizador a escolher a sua.
          passwordExpiresAt: new Date(),
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

    const [data, total] = await Promise.all([ // PERF-19
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

  async atualizar(
    id: string,
    data: { nome?: string; ordemExperiencia?: number; role?: string; subRole?: string | null; servico?: Servico; equipa?: string; chefeId?: string | null },
    atorId?: string,
  ) {
    const atual = await this.buscarPorId(id);
    // SEC-03: ninguém altera o próprio papel — um TI não se promove a si mesmo.
    if (atorId === id && (data.role !== undefined || data.subRole !== undefined)) {
      throw new ForbiddenException('Não pode alterar o seu próprio papel.');
    }
    const mudaToken = CAMPOS_DO_TOKEN.some(
      (c) => data[c] !== undefined && data[c] !== (atual as Record<string, unknown>)[c],
    );
    // SEC-04: com papel/serviço novos, os tokens antigos levariam as permissões velhas
    // até expirarem — a versão da sessão sobe e são recusados já.
    const sessao = mudaToken ? { versaoSessao: { increment: 1 } } : {};
    const atualizado = await this.prisma.utilizador.update({
      where: { id },
      data: { ...data, ...sessao },
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
    if (mudaToken) await this.revogarRefreshTokens(id);
    return atualizado;
  }

  async desativar(id: string, atorId?: string) {
    if (atorId === id) throw new ForbiddenException('Não pode desativar a sua própria conta.');
    await this.buscarPorId(id);
    // SEC-04: a conta desactivada perde já todas as sessões, não só no próximo refresh.
    const desativado = await this.prisma.utilizador.update({
      where: { id },
      data: { ativo: false, versaoSessao: { increment: 1 } },
      select: { id: true, nome: true, ativo: true },
    });
    await this.revogarRefreshTokens(id);
    return desativado;
  }

  private async revogarRefreshTokens(utilizadorId: string) {
    await this.prisma.refreshToken.updateMany({ where: { utilizadorId, revogado: false }, data: { revogado: true } });
    invalidarCacheSessao(utilizadorId);
  }
}

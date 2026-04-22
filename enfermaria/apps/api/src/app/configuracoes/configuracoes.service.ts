import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConfiguracoesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Roles ─────────────────────────────────────────────────────────────────

  listarRoles() {
    return this.prisma.roleConfig.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
      include: {
        subRoles: {
          where: { ativo: true },
          orderBy: { ordem: 'asc' },
        },
      },
    });
  }

  async criarRole(data: { chave: string; label: string; categoria: string; ordem?: number }) {
    const existe = await this.prisma.roleConfig.findUnique({ where: { chave: data.chave } });
    if (existe) throw new ConflictException(`Role '${data.chave}' já existe`);
    return this.prisma.roleConfig.create({ data });
  }

  async editarRole(id: string, data: { label?: string; categoria?: string; ordem?: number }) {
    await this.prisma.roleConfig.findUniqueOrThrow({ where: { id } });
    return this.prisma.roleConfig.update({ where: { id }, data });
  }

  async desativarRole(id: string) {
    await this.prisma.roleConfig.findUniqueOrThrow({ where: { id } });
    return this.prisma.roleConfig.update({ where: { id }, data: { ativo: false } });
  }

  // ── SubRoles ──────────────────────────────────────────────────────────────

  listarSubRoles() {
    return this.prisma.subRoleConfig.findMany({
      where: { ativo: true },
      orderBy: [{ roleChave: 'asc' }, { ordem: 'asc' }],
    });
  }

  listarSubRolesPorRole(chaveRole: string) {
    return this.prisma.subRoleConfig.findMany({
      where: { roleChave: chaveRole, ativo: true },
      orderBy: { ordem: 'asc' },
    });
  }

  async criarSubRole(data: { chave: string; label: string; roleChave: string; ordem?: number }) {
    const roleExiste = await this.prisma.roleConfig.findUnique({ where: { chave: data.roleChave } });
    if (!roleExiste) throw new NotFoundException(`Role '${data.roleChave}' não existe`);
    const existe = await this.prisma.subRoleConfig.findUnique({ where: { chave: data.chave } });
    if (existe) throw new ConflictException(`SubRole '${data.chave}' já existe`);
    return this.prisma.subRoleConfig.create({ data });
  }

  async editarSubRole(id: string, data: { label?: string; ordem?: number }) {
    await this.prisma.subRoleConfig.findUniqueOrThrow({ where: { id } });
    return this.prisma.subRoleConfig.update({ where: { id }, data });
  }

  async desativarSubRole(id: string) {
    await this.prisma.subRoleConfig.findUniqueOrThrow({ where: { id } });
    return this.prisma.subRoleConfig.update({ where: { id }, data: { ativo: false } });
  }
}

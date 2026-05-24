import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CACHE_KEY = 'catalogo:todos';
const CACHE_TTL = 60 * 60; // 1 hora

@Injectable()
export class CatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listar(search?: string) {
    // Pesquisas dinâmicas não são cacheadas
    if (search) {
      return this.prisma.catalogoMedicamento.findMany({
        where: {
          ativo: true,
          OR: [
            { dci: { contains: search, mode: 'insensitive' } },
            { nomeMarca: { contains: search, mode: 'insensitive' } },
            { classeTerap: { contains: search, mode: 'insensitive' } },
          ],
        },
        orderBy: { dci: 'asc' },
      });
    }

    const cached = await this.redis.get<unknown[]>(CACHE_KEY);
    if (cached) return cached;

    const result = await this.prisma.catalogoMedicamento.findMany({
      where: { ativo: true },
      orderBy: { dci: 'asc' },
    });

    await this.redis.set(CACHE_KEY, result, CACHE_TTL);
    return result;
  }

  async criar(dto: {
    dci: string;
    nomeMarca?: string;
    formaFarmaceutica: string;
    classeTerap: string;
    unidade: string;
    concentracao?: string;
    codigoATC?: string;
  }) {
    const item = await this.prisma.catalogoMedicamento.create({ data: dto });
    await this.redis.del(CACHE_KEY);
    return item;
  }

  async atualizar(id: string, dto: Partial<{
    dci: string;
    nomeMarca: string;
    formaFarmaceutica: string;
    classeTerap: string;
    unidade: string;
    concentracao: string;
    codigoATC: string;
  }>) {
    await this.findOrFail(id);
    const item = await this.prisma.catalogoMedicamento.update({ where: { id }, data: dto });
    await this.redis.del(CACHE_KEY);
    return item;
  }

  async desativar(id: string) {
    await this.findOrFail(id);
    const item = await this.prisma.catalogoMedicamento.update({ where: { id }, data: { ativo: false } });
    await this.redis.del(CACHE_KEY);
    return item;
  }

  private async findOrFail(id: string) {
    const item = await this.prisma.catalogoMedicamento.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Medicamento não encontrado no catálogo');
    return item;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import amostra from './catalogo-amostra.json';
import { ItemCatalogo, dciDoNome, gravarItensCatalogo, normalizarDci } from './catalogo-nacional';

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
        // PROD-05: com o catálogo nacional importado há milhares de linhas — a pesquisa devolve
        // as primeiras 50 (o autocomplete da prescrição não precisa de mais).
        take: 50,
      });
    }

    const cached = await this.redis.get<unknown[]>(CACHE_KEY);
    if (cached) return cached;

    const result = await this.prisma.catalogoMedicamento.findMany({
      where: { ativo: true },
      orderBy: { dci: 'asc' },
      take: 500,
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

  // ── PROD-05: catálogo nacional ─────────────────────────────────────────────────

  private cacheDcis: { em: number; dcis: string[] } | null = null;

  /** DCIs activas do catálogo (cache em memória de 5 min — o catálogo muda por importação). */
  async dcis(): Promise<string[]> {
    if (this.cacheDcis && Date.now() - this.cacheDcis.em < 5 * 60_000) return this.cacheDcis.dcis;
    const linhas = await this.prisma.catalogoMedicamento.findMany({ where: { ativo: true }, select: { dci: true }, distinct: ['dci'] });
    this.cacheDcis = { em: Date.now(), dcis: linhas.map((l) => l.dci) };
    return this.cacheDcis.dcis;
  }

  /**
   * O item do catálogo que corresponde a uma prescrição: pelo id (se o prescritor escolheu do
   * autocomplete) ou pela DCI reconhecida no nome (marca → DCI), preferindo a mesma via.
   */
  async resolver(nome: string, via?: string | null, catalogoId?: string | null) {
    if (catalogoId) {
      const item = await this.prisma.catalogoMedicamento.findUnique({ where: { id: catalogoId } });
      if (!item || !item.ativo) throw new NotFoundException('Medicamento não encontrado no catálogo');
      return item;
    }
    const dci = dciDoNome(nome, await this.dcis());
    if (!dci) return null;
    const itens = await this.prisma.catalogoMedicamento.findMany({ where: { dci, ativo: true }, orderBy: { criadoEm: 'asc' } });
    return itens.find((i) => via && i.via && i.via.toLowerCase() === via.toLowerCase()) ?? itens[0] ?? null;
  }

  /**
   * Importação idempotente: pelo código CHNM quando existe; senão pela combinação
   * DCI + forma + dosagem + via. Devolve quantos foram criados e actualizados.
   */
  async importar(itens: ItemCatalogo[], fonte: 'infarmed' | 'amostra' | 'local', versao: string) {
    const r = await gravarItensCatalogo(this.prisma, itens, fonte, versao);
    await this.redis.del(CACHE_KEY);
    this.cacheDcis = null;
    return r;
  }

  /** Amostra de arranque (substâncias de uso hospitalar corrente) — só se o catálogo estiver vazio de DCIs dela. */
  importarAmostra() {
    return this.importar(amostra.itens as ItemCatalogo[], 'amostra', amostra.versao);
  }

  /** De onde vem o catálogo — a interface avisa quando só há a amostra. */
  async fonte() {
    const grupos = await this.prisma.catalogoMedicamento.groupBy({
      by: ['fonte', 'versaoFonte'], where: { ativo: true }, _count: { _all: true }, _max: { atualizadoEm: true },
    });
    const total = grupos.reduce((n, g) => n + g._count._all, 0);
    return {
      total,
      apenasAmostra: total > 0 && grupos.every((g) => g.fonte !== 'infarmed'),
      fontes: grupos.map((g) => ({ fonte: g.fonte, versao: g.versaoFonte, itens: g._count._all, atualizadoEm: g._max.atualizadoEm })),
    };
  }

  /** Para testes e diagnóstico: a DCI normalizada que o resolvedor usa. */
  static normalizar(dci: string) { return normalizarDci(dci); }

  private async findOrFail(id: string) {
    const item = await this.prisma.catalogoMedicamento.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Medicamento não encontrado no catálogo');
    return item;
  }
}

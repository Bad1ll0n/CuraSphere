import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface FlagContext {
  userId: string;
  role?: string;
  servico?: string | null;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class FeatureFlagsService {
  private cache: Map<string, any> | null = null;
  private cacheAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  private async carregar(): Promise<Map<string, any>> {
    const agora = Date.now();
    if (this.cache && agora - this.cacheAt < CACHE_TTL_MS) return this.cache;
    const flags = await this.prisma.featureFlag.findMany();
    this.cache = new Map(flags.map((f) => [f.key, f]));
    this.cacheAt = agora;
    return this.cache;
  }

  /** Invalida a cache após uma escrita administrativa. */
  invalidar(): void {
    this.cache = null;
    this.cacheAt = 0;
  }

  /**
   * Uma flag está ativa para este contexto quando: existe e está `enabled`, o role/serviço
   * estão na allowlist (ou a allowlist está vazia), e o utilizador cai dentro do
   * `rolloutPercent` — decidido por um hash determinístico de `key+userId` (o mesmo utilizador
   * vê sempre o mesmo resultado). Chaves desconhecidas → desligadas (falha em segurança).
   */
  async isEnabled(key: string, ctx: FlagContext): Promise<boolean> {
    const flag = (await this.carregar()).get(key);
    if (!flag || !flag.enabled) return false;
    if (flag.roles.length > 0 && (!ctx.role || !flag.roles.includes(ctx.role))) return false;
    if (flag.servicos.length > 0 && (!ctx.servico || !flag.servicos.includes(ctx.servico))) return false;
    if (flag.rolloutPercent >= 100) return true;
    if (flag.rolloutPercent <= 0) return false;
    return FeatureFlagsService.bucket(key, ctx.userId) < flag.rolloutPercent;
  }

  /** Devolve o mapa {key: boolean} de todas as flags para este contexto (para o frontend). */
  async paraContexto(ctx: FlagContext): Promise<Record<string, boolean>> {
    const flags = await this.carregar();
    const out: Record<string, boolean> = {};
    for (const key of flags.keys()) out[key] = await this.isEnabled(key, ctx);
    return out;
  }

  private static bucket(key: string, userId: string): number {
    const hex = createHash('sha256').update(`${key}:${userId}`).digest('hex').slice(0, 8);
    return parseInt(hex, 16) % 100;
  }

  // ── Administração ────────────────────────────────────────────────────────────
  async listar() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async upsert(key: string, dados: Partial<{ descricao: string; enabled: boolean; rolloutPercent: number; roles: string[]; servicos: string[] }>, utilizadorId: string) {
    const flag = await this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, ...dados, atualizadoPorId: utilizadorId },
      update: { ...dados, atualizadoPorId: utilizadorId },
    });
    this.invalidar();
    return flag;
  }

  async remover(key: string) {
    await this.prisma.featureFlag.delete({ where: { key } });
    this.invalidar();
    return { removido: key };
  }
}

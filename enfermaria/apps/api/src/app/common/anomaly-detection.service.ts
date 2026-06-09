import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

interface AcessoEntry {
  id: string;
  ts: number;
}

const BULK_THRESHOLD = 15; // doentes distintos em 10 minutos
const JANELA_MS = 10 * 60_000;
const TTL_ACESSOS = 600; // segundos
const TTL_IP = 7 * 24 * 3600; // 7 dias

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  // Chamado pelo AuditInterceptor para GET /doentes/:id — fire-and-forget
  rastrearAcessoDoente(userId: string, doenteId: string): void {
    this.detectarAcessoBulk(userId, doenteId).catch(() => {});
  }

  private async detectarAcessoBulk(userId: string, doenteId: string): Promise<void> {
    const key = `anomaly:doentes:${userId}`;
    const agora = Date.now();

    const lista = await this.redis.get<AcessoEntry[]>(key) ?? [];
    const cutoff = agora - JANELA_MS;
    const filtrada = lista.filter(a => a.ts > cutoff);
    filtrada.push({ id: doenteId, ts: agora });

    await this.redis.set(key, filtrada, TTL_ACESSOS);

    const distintos = new Set(filtrada.map(a => a.id)).size;
    if (distintos > BULK_THRESHOLD) {
      this.prisma.auditLog.create({
        data: {
          utilizadorId: userId,
          acao: 'anomalia_acesso_bulk',
          detalhes: JSON.stringify({ suspeito: true, tipo: 'acesso_bulk', doenteCount: distintos, janelaMinutos: 10 }),
        },
      }).catch(() => {});
      this.logger.warn(`Anomalia: utilizador ${userId} acedeu a ${distintos} doentes distintos em 10 minutos`);
    }
  }

  // Chamado após login bem-sucedido para detectar IP diferente do habitual
  verificarIpLogin(userId: string, novoIp: string): void {
    this.detectarIpDiferente(userId, novoIp).catch(() => {});
  }

  private async detectarIpDiferente(userId: string, novoIp: string): Promise<void> {
    if (!novoIp || novoIp === '::1' || novoIp === '127.0.0.1') return; // ignorar localhost

    const key = `anomaly:ip:${userId}`;
    const ipAnterior = await this.redis.get<string>(key);

    if (ipAnterior && ipAnterior !== novoIp) {
      this.prisma.auditLog.create({
        data: {
          utilizadorId: userId,
          acao: 'anomalia_login_ip_diferente',
          ip: novoIp,
          detalhes: JSON.stringify({ suspeito: true, tipo: 'ip_diferente', ipAnterior, novoIp }),
        },
      }).catch(() => {});
      this.logger.warn(`Anomalia: utilizador ${userId} fez login de IP diferente: ${ipAnterior} → ${novoIp}`);
    }

    await this.redis.set(key, novoIp, TTL_IP);
  }
}

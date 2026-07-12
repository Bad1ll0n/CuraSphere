import { Logger } from '@nestjs/common';
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

interface JwtPayload {
  sub: string;
  nome?: string;
  role: string;
  servico?: string;
}

// Origens permitidas — usa ALLOWED_ORIGINS do .env (mesma allowlist que HTTP CORS).
// Em dev (variável não definida) só permite localhost. Em produção, sem env, recusa tudo.
function parseAllowedOrigins(): string[] | null {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return null;
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true); // mobile / curl
      const allowlist = parseAllowedOrigins();
      if (allowlist) {
        return allowlist.includes(origin)
          ? callback(null, true)
          : callback(new Error('WebSocket CORS: origin not allowed'));
      }
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
      callback(new Error('WebSocket CORS: origin not allowed'));
    },
    credentials: true,
  },
  namespace: '/ws',
  maxHttpBufferSize: 1e5,
  transports: ['websocket'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  private clientRooms = new Map<string, string[]>();
  private clientUsers = new Map<string, string>(); // socketId → utilizadorId
  private clientNames = new Map<string, string>(); // socketId → nome
  private clientLocks = new Map<string, Array<{ notaId: string; doenteId: string }>>(); // socketId → nota locks held
  private lastPing = new Map<string, number>();     // socketId → last ping timestamp
  private lastPassagem = new Map<string, number>(); // socketId → last passagem timestamp

  private readonly wsBucket = new Map<string, { tokens: number; resetAt: number }>();
  private readonly WS_MAX_TOKENS = 10;
  private readonly WS_REFILL_MS = 1000;

  private consumeToken(socketId: string): boolean {
    const now = Date.now();
    let bucket = this.wsBucket.get(socketId);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { tokens: this.WS_MAX_TOKENS, resetAt: now + this.WS_REFILL_MS };
    }
    if (bucket.tokens <= 0) return false;
    bucket.tokens--;
    this.wsBucket.set(socketId, bucket);
    return true;
  }

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) { client.disconnect(); return; }
    try {
      const payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') }) as JwtPayload;
      const role: string = payload.role ?? '';
      const servico: string = payload.servico ?? '';

      const rooms: string[] = ['geral'];
      if (role) rooms.push(`role:${role}`);
      if (servico) rooms.push(`servico:${servico}`);
      rooms.push(`user:${payload.sub}`);

      for (const room of rooms) client.join(room);
      this.clientRooms.set(client.id, rooms);
      this.clientUsers.set(client.id, payload.sub);
      this.clientNames.set(client.id, payload.nome ?? 'Utilizador');

      // Registar presença online
      await this.prisma.presencaOnline.upsert({
        where: { utilizadorId: payload.sub },
        update: { socketId: client.id, ligadoEm: new Date(), ultimoPing: new Date() },
        create: { utilizadorId: payload.sub, socketId: client.id },
      }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    // Release any nota locks held by this client
    for (const { notaId, doenteId } of this.clientLocks.get(client.id) ?? []) {
      await this.redis.del(`nota:lock:${notaId}`);
      this.server.to(`doente:${doenteId}`).emit('nota:unlock', { notaId });
    }
    this.clientLocks.delete(client.id);
    this.clientNames.delete(client.id);

    const utilizadorId = this.clientUsers.get(client.id);
    this.clientRooms.delete(client.id);
    this.clientUsers.delete(client.id);
    this.lastPing.delete(client.id);
    this.lastPassagem.delete(client.id);
    this.wsBucket.delete(client.id);

    if (utilizadorId) {
      await this.prisma.presencaOnline.deleteMany({
        where: { utilizadorId, socketId: client.id },
      }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    if (!this.consumeToken(client.id)) { client.emit('error', { message: 'Rate limit exceeded' }); client.disconnect(true); return; }
    const now = Date.now();
    if (now - (this.lastPing.get(client.id) ?? 0) < 30_000) return;
    this.lastPing.set(client.id, now);
    const utilizadorId = this.clientUsers.get(client.id);
    if (utilizadorId) {
      await this.prisma.presencaOnline.updateMany({
        where: { utilizadorId },
        data: { ultimoPing: new Date() },
      }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }
    client.emit('pong', { ts: Date.now() });
  }

  @SubscribeMessage('turno:passagem-aceite')
  async handlePassagemAceite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { passagemId: string },
  ) {
    if (!this.consumeToken(client.id)) { client.emit('error', { message: 'Rate limit exceeded' }); client.disconnect(true); return; }
    const now = Date.now();
    if (now - (this.lastPassagem.get(client.id) ?? 0) < 5_000) return;
    this.lastPassagem.set(client.id, now);
    const utilizadorId = this.clientUsers.get(client.id);
    if (!utilizadorId || !data?.passagemId) return;

    const passagem = await this.prisma.passagemTurno.findUnique({
      where: { id: data.passagemId },
    }).catch(() => null);

    if (!passagem || passagem.estadoDesafio !== 'pendente') return;

    await this.prisma.passagemTurno.update({
      where: { id: data.passagemId },
      data: { estadoDesafio: 'aceite', desafioAceitoEm: new Date() },
    }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    // Notificar o enfermeiro saindo que a passagem foi aceite
    this.server.to(`user:${utilizadorId}`).emit('turno:passagem-confirmada', {
      passagemId: data.passagemId,
      aceitoPor: utilizadorId,
      ts: Date.now(),
    });
  }

  // ── Colaboração em tempo real nas notas clínicas ────────────────────────────

  @SubscribeMessage('nota:join-doente')
  handleNotaJoinDoente(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { doenteId: string },
  ) {
    if (!this.consumeToken(client.id)) { client.emit('error', { message: 'Rate limit exceeded' }); client.disconnect(true); return; }
    if (!data?.doenteId) return;
    client.join(`doente:${data.doenteId}`);
  }

  @SubscribeMessage('nota:edit-start')
  async handleNotaEditStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notaId: string; doenteId: string },
  ) {
    if (!this.consumeToken(client.id)) { client.emit('error', { message: 'Rate limit exceeded' }); client.disconnect(true); return; }
    if (!data?.notaId || !data?.doenteId) return;
    const userId = this.clientUsers.get(client.id);
    const nome = this.clientNames.get(client.id) ?? 'Utilizador';
    if (!userId) return;

    const existing = await this.redis.get<{ userId: string; nome: string }>(`nota:lock:${data.notaId}`);
    if (existing && existing.userId !== userId) {
      client.emit('nota:lock-denied', { notaId: data.notaId, editadoPor: existing.nome });
      return;
    }

    await this.redis.set(`nota:lock:${data.notaId}`, { userId, nome }, 300);
    const locks = this.clientLocks.get(client.id) ?? [];
    if (!locks.find(l => l.notaId === data.notaId)) {
      locks.push({ notaId: data.notaId, doenteId: data.doenteId });
      this.clientLocks.set(client.id, locks);
    }
    this.server.to(`doente:${data.doenteId}`).emit('nota:lock', { notaId: data.notaId, nome });
  }

  @SubscribeMessage('nota:edit-stop')
  async handleNotaEditStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notaId: string; doenteId: string },
  ) {
    if (!this.consumeToken(client.id)) { client.emit('error', { message: 'Rate limit exceeded' }); client.disconnect(true); return; }
    if (!data?.notaId || !data?.doenteId) return;
    await this.redis.del(`nota:lock:${data.notaId}`);
    const remaining = (this.clientLocks.get(client.id) ?? []).filter(l => l.notaId !== data.notaId);
    this.clientLocks.set(client.id, remaining);
    this.server.to(`doente:${data.doenteId}`).emit('nota:unlock', { notaId: data.notaId });
  }

  // ── Verificar se utilizador está online ─────────────────────────────────────

  async estaOnline(utilizadorId: string): Promise<boolean> {
    const presenca = await this.prisma.presencaOnline.findUnique({
      where: { utilizadorId },
    }).catch(() => null);
    if (!presenca) return false;
    // Considerar offline se último ping há mais de 2 min
    const doisMinutos = 2 * 60 * 1000;
    return (Date.now() - presenca.ultimoPing.getTime()) < doisMinutos;
  }

  // ── Métodos de emissão (chamados por outros serviços) ────────────────────────

  emitirPassagemDesafio(receptorId: string, passagemId: string, turnoInfo: object) {
    this.server.to(`user:${receptorId}`).emit('turno:passagem-desafio', {
      passagemId,
      turnoInfo,
      ts: Date.now(),
    });
  }

  emitirUrgenciaUpdate(data: object) {
    this.server.to('servico:urgencia').emit('urgencia:update', data);
    this.server.to('role:medico').emit('urgencia:update', data);
    this.server.to('role:enfermeiro').emit('urgencia:update', data);
    this.server.to('role:administrativo').emit('urgencia:update', data);
  }

  emitirSOS(doenteId: string, doenteNome: string, quarto: string, acionadoPor: string) {
    const payload = { doenteId, doenteNome, quarto, acionadoPor, ts: Date.now() };
    this.server.to('role:medico').emit('sos:alerta', payload);
    this.server.to('role:enfermeiro').emit('sos:alerta', payload);
  }

  emitirAlerta(doenteId: string, tipo: string, mensagem: string) {
    const payload = { doenteId, tipo, mensagem, ts: Date.now() };
    this.server.to('role:medico').emit('alerta:novo', payload);
    this.server.to('role:enfermeiro').emit('alerta:novo', payload);
  }

  emitirPreNotificacao(episodioId: string, triagem: string, etaMinutos: number, queixa: string) {
    const payload = { episodioId, triagem, etaMinutos, queixa, ts: Date.now() };
    this.server.to('servico:urgencia').emit('urgencia:ambulancia', payload);
    this.server.to('role:medico').emit('urgencia:ambulancia', payload);
    this.server.to('role:enfermeiro').emit('urgencia:ambulancia', payload);
  }

  emitirEstadoDoente(doenteId: string, estado: string) {
    this.server.to('geral').emit('doente:estado', { doenteId, estado, ts: Date.now() });
  }

  emitirBlocoUpdate(data: object) {
    this.server.to('geral').emit('bloco:update', { ...data, ts: Date.now() });
  }

  emitirSLAExcedido(data: object) {
    const payload = { ...data, ts: Date.now() };
    this.server.to('role:medico').emit('urgencia:sla-excedido', payload);
    this.server.to('role:enfermeiro').emit('urgencia:sla-excedido', payload);
    this.server.to('servico:urgencia').emit('urgencia:sla-excedido', payload);
  }
}

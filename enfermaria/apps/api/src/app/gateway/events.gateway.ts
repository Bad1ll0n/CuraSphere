import { Logger } from '@nestjs/common';
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

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
  maxHttpBufferSize: 1e6,
  transports: ['websocket'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  private clientRooms = new Map<string, string[]>();
  private clientUsers = new Map<string, string>(); // socketId → utilizadorId

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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
    const utilizadorId = this.clientUsers.get(client.id);
    this.clientRooms.delete(client.id);
    this.clientUsers.delete(client.id);

    if (utilizadorId) {
      await this.prisma.presencaOnline.deleteMany({
        where: { utilizadorId, socketId: client.id },
      }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
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
}

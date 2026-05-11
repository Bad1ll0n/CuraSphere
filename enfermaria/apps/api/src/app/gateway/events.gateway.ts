import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientRooms = new Map<string, string[]>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) { client.disconnect(); return; }
    try {
      const payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') }) as any;
      const role: string = payload.role ?? '';
      const servico: string = payload.servico ?? '';

      // Subscrever salas com base no role/serviço
      const rooms: string[] = ['geral'];
      if (role) rooms.push(`role:${role}`);
      if (servico) rooms.push(`servico:${servico}`);
      rooms.push(`user:${payload.sub}`);

      for (const room of rooms) client.join(room);
      this.clientRooms.set(client.id, rooms);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.clientRooms.delete(client.id);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { ts: Date.now() });
  }

  // ── Métodos de emissão (chamados por outros serviços) ────────────────────

  /** Atualização da lista de espera da urgência */
  emitirUrgenciaUpdate(data: object) {
    this.server.to('servico:urgencia').emit('urgencia:update', data);
    this.server.to('role:medico').emit('urgencia:update', data);
    this.server.to('role:enfermeiro').emit('urgencia:update', data);
    this.server.to('role:administrativo').emit('urgencia:update', data);
  }

  /** SOS acionado — notificar médicos e enfermeiros */
  emitirSOS(doenteId: string, doenteNome: string, quarto: string, acionadoPor: string) {
    const payload = { doenteId, doenteNome, quarto, acionadoPor, ts: Date.now() };
    this.server.to('role:medico').emit('sos:alerta', payload);
    this.server.to('role:enfermeiro').emit('sos:alerta', payload);
  }

  /** Alerta clínico novo */
  emitirAlerta(doenteId: string, tipo: string, mensagem: string) {
    const payload = { doenteId, tipo, mensagem, ts: Date.now() };
    this.server.to('role:medico').emit('alerta:novo', payload);
    this.server.to('role:enfermeiro').emit('alerta:novo', payload);
  }

  /** Pré-notificação de ambulância */
  emitirPreNotificacao(episodioId: string, triagem: string, etaMinutos: number, queixa: string) {
    const payload = { episodioId, triagem, etaMinutos, queixa, ts: Date.now() };
    this.server.to('servico:urgencia').emit('urgencia:ambulancia', payload);
    this.server.to('role:medico').emit('urgencia:ambulancia', payload);
    this.server.to('role:enfermeiro').emit('urgencia:ambulancia', payload);
  }

  /** Dashboard — qualquer atualização de estado de doente */
  emitirEstadoDoente(doenteId: string, estado: string) {
    this.server.to('geral').emit('doente:estado', { doenteId, estado, ts: Date.now() });
  }
}

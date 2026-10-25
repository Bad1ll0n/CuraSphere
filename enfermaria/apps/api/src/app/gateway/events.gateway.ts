import { HttpException, Logger } from '@nestjs/common';
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ModuleRef } from '@nestjs/core';
import { VERIFICADOR_ACESSO_DOENTE, type VerificadorAcessoDoente } from '../doentes/acesso-doente.token';
import { AUD_SOCKET, JWT_ISSUER, type TipoToken } from '../auth/token-audiences';

interface JwtPayload {
  sub: string;
  tipo?: TipoToken;
  nome?: string;
  role?: string;
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
  // O papel é necessário para autorizar depois da ligação. Antes guardava-se só o id,
  // e por isso nenhum handler tinha como decidir se o utilizador podia fazer o que pedia.
  private clientRoles = new Map<string, string>(); // socketId → papel
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
    // Resolvido em tempo de chamada, não injectado: o DoenteService arrasta o ciclo
    // doentes ↔ ai-clinico ↔ alertas ↔ gateway. Nem sequer pode ser importado aqui — o ciclo
    // rebenta no carregamento dos ficheiros, antes de o Nest resolver o que quer que seja.
    // Resolve-se por token (acesso-doente.token.ts), que não acrescenta aresta nenhuma.
    private readonly moduleRef: ModuleRef,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) { client.disconnect(); return; }
    try {
      // SEC-01: a verificação fixava apenas o segredo. Como os quatro tipos de token da API
      // partilhavam segredo, qualquer um deles — portal do doente, desafio de MFA — abria uma
      // ligação e entrava na sala 'geral', que difunde alertas clínicos. A separação de
      // domínios feita em token-audiences.ts não cobre este ponto, porque não passa pela
      // JwtStrategy: o socket verifica o token por sua conta e tem de repetir as mesmas regras.
      const payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_SECRET'),
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: AUD_SOCKET,
      }) as JwtPayload;

      // Só um bilhete de socket abre uma ligação. Um token de sessão de pessoal, mesmo
      // válido, é recusado aqui: o handshake tem a sua própria audiência, de finalidade
      // única e vida de 60 s, pedida ao /auth/socket-ticket com o cookie de sessão.
      if (payload.tipo !== 'socket' || !payload.role || !payload.servico) {
        client.disconnect();
        return;
      }

      const role: string = payload.role;
      const servico: string = payload.servico;

      const rooms: string[] = ['geral'];
      if (role) rooms.push(`role:${role}`);
      if (servico) rooms.push(`servico:${servico}`);
      rooms.push(`user:${payload.sub}`);

      for (const room of rooms) client.join(room);
      this.clientRooms.set(client.id, rooms);
      this.clientUsers.set(client.id, payload.sub);
      this.clientNames.set(client.id, payload.nome ?? 'Utilizador');
      this.clientRoles.set(client.id, role);

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
    this.clientRoles.delete(client.id);

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
      include: {
        turnoAtual: { select: { dataInicio: true, dataFim: true } },
        turnoAnterior: { select: { chefeTurnoId: true } },
      },
    }).catch(() => null);

    if (!passagem || passagem.estadoDesafio !== 'pendente') return;

    // S-08: antes qualquer sessão aceitava QUALQUER passagem pendente, bastando saber o id.
    // A passagem de turno transfere a responsabilidade clínica por doentes: aceitá-la em
    // nome de outro turno é um acto clínico falso. Só pode aceitar quem está escalado no
    // turno que recebe — o mesmo critério com que o desafio foi enviado.
    const escalado = await this.prisma.horarioTurnoProfissional.findFirst({
      where: {
        utilizadorId,
        horarioTurno: {
          data: { gte: passagem.turnoAtual.dataInicio, lte: passagem.turnoAtual.dataFim },
        },
      },
      // Chave composta (horarioTurnoId, utilizadorId): o modelo não tem `id`.
      select: { horarioTurnoId: true },
    }).catch(() => null);

    if (!escalado) {
      client.emit('turno:passagem-recusada', {
        passagemId: data.passagemId,
        motivo: 'Não está escalado no turno que recebe esta passagem',
      });
      return;
    }

    // Actualização condicionada ao estado: dois profissionais a aceitar ao mesmo tempo
    // produzem uma única aceitação, e o segundo não recebe confirmação falsa.
    const resultado = await this.prisma.passagemTurno.updateMany({
      where: { id: data.passagemId, estadoDesafio: 'pendente' },
      data: { estadoDesafio: 'aceite', desafioAceitoEm: new Date() },
    }).catch((err) => {
      this.logger.warn('Falha ao aceitar passagem', err?.message ?? String(err));
      return { count: 0 };
    });
    if (resultado.count === 0) return;

    // O comentário antigo dizia 'notificar o enfermeiro que sai', mas a emissão ia para
    // quem ACEITOU. Quem entrega nunca sabia que a passagem tinha sido aceite.
    const confirmacao = { passagemId: data.passagemId, aceitoPor: utilizadorId, ts: Date.now() };
    this.server.to(`user:${passagem.turnoAnterior.chefeTurnoId}`).emit('turno:passagem-confirmada', confirmacao);
    this.server.to(`user:${utilizadorId}`).emit('turno:passagem-confirmada', confirmacao);
  }

  // ── Colaboração em tempo real nas notas clínicas ────────────────────────────

  /**
   * S-07: o handshake autentica a ligação, mas nenhum handler autorizava o que era pedido
   * depois dela. Qualquer sessão entrava na sala de qualquer doente — e recebia os eventos
   * dessa sala — e libertava bloqueios de notas que não eram suas. A regra é a mesma que
   * protege a API por HTTP, e é o mesmo método que a aplica.
   */
  private async podeAcederAoDoente(socketId: string, doenteId: string): Promise<boolean> {
    const utilizadorId = this.clientUsers.get(socketId);
    const papel = this.clientRoles.get(socketId);
    if (!utilizadorId || !papel) return false;
    try {
      const verificador = this.moduleRef.get<VerificadorAcessoDoente>(
        VERIFICADOR_ACESSO_DOENTE,
        { strict: false },
      );
      await verificador.assertAcessoDoente(utilizadorId, papel, doenteId);
      return true;
    } catch (err) {
      // Uma recusa normal (sem atribuição, doente inexistente) é esperada e não se regista.
      // Qualquer outra falha — verificador por resolver, base de dados em baixo — também
      // recusa, mas não pode passar em silêncio: pareceria só um utilizador sem acesso.
      if (!(err instanceof HttpException)) {
        this.logger.error(`Verificação de acesso ao doente falhou: ${(err as Error)?.message ?? String(err)}`);
      }
      return false;
    }
  }

  @SubscribeMessage('nota:join-doente')
  async handleNotaJoinDoente(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { doenteId: string },
  ) {
    if (!this.consumeToken(client.id)) { client.emit('error', { message: 'Rate limit exceeded' }); client.disconnect(true); return; }
    if (!data?.doenteId) return;
    if (!(await this.podeAcederAoDoente(client.id, data.doenteId))) {
      client.emit('nota:acesso-negado', { doenteId: data.doenteId });
      return;
    }
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

    if (!(await this.podeAcederAoDoente(client.id, data.doenteId))) {
      client.emit('nota:acesso-negado', { doenteId: data.doenteId });
      return;
    }

    // O doente vem do cliente e a nota também: sem esta verificação, bastava declarar um
    // doente a que se tem acesso para bloquear a nota de outro.
    const nota = await this.prisma.notaClinica.findUnique({
      where: { id: data.notaId },
      select: { doenteId: true },
    }).catch(() => null);
    if (!nota || nota.doenteId !== data.doenteId) {
      client.emit('nota:acesso-negado', { doenteId: data.doenteId, notaId: data.notaId });
      return;
    }

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
    if (!data?.notaId) return;
    const userId = this.clientUsers.get(client.id);
    if (!userId) return;

    const locks = this.clientLocks.get(client.id) ?? [];
    const entrada = locks.find(l => l.notaId === data.notaId);
    this.clientLocks.set(client.id, locks.filter(l => l.notaId !== data.notaId));

    // Só quem detém o bloqueio o pode libertar. Antes, qualquer sessão apagava o bloqueio
    // de qualquer nota — e com ele a protecção contra duas pessoas a reescreverem o mesmo
    // registo clínico ao mesmo tempo.
    const existing = await this.redis.get<{ userId: string; nome: string }>(`nota:lock:${data.notaId}`);
    if (!existing || existing.userId !== userId) return;

    await this.redis.del(`nota:lock:${data.notaId}`);
    // O doente sai do registo do próprio bloqueio, não do pedido do cliente.
    if (entrada) {
      this.server.to(`doente:${entrada.doenteId}`).emit('nota:unlock', { notaId: data.notaId });
    }
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

  // S-09: sinais em tempo real, não dados clínicos. Estes métodos difundiam o nome do doente,
  // a queixa e o texto clínico a TODOS os médicos e enfermeiros do hospital. O ecrã da
  // urgência nem usava esses campos — só voltava a pedir a lista por HTTP, pedido que já passa
  // pela autorização da rota. A regra passou a ser: quem tem de agir com o dado recebe-o
  // completo (o serviço, a equipa do doente); os restantes recebem o sinal sem identificação.
  // Uma única emissão para várias salas também deixa de entregar o mesmo evento duas vezes a
  // quem está em mais do que uma delas.

  emitirUrgenciaUpdate(data: { id: string } & Record<string, unknown>) {
    const ts = Date.now();
    this.server.to('servico:urgencia').emit('urgencia:update', { ...data, ts });
    // `novaAtualizacao` levava o texto da actualização de transporte e o nome de quem a
    // registou. Fora do serviço basta saber que o episódio mudou.
    this.server
      .to(['role:medico', 'role:enfermeiro', 'role:administrativo'])
      .except('servico:urgencia')
      .emit('urgencia:update', { id: data.id, ts });
  }

  emitirSOS(doenteId: string, doenteNome: string, quarto: string, acionadoPor: string) {
    return this.emitirAlertaCritico({
      tipo: 'sos',
      doenteId,
      doenteNome,
      localizacao: quarto,
      acionadoPorId: acionadoPor,
    });
  }

  /**
   * Alerta que tem de chegar a toda a gente que possa responder — SOS, sépsis.
   *
   * Todos os médicos e enfermeiros recebem o alerta, como um código anunciado no hospital:
   * tipo e localização. O nome e o detalhe clínico vão só para quem tem relação de cuidados
   * com o doente, e para as sessões que já passaram a verificação de acesso a ele (sala
   * `doente:`). Quem não é da equipa abre a ficha pelo circuito normal — com break-glass,
   * se for preciso.
   *
   * Nunca lança: uma falha a descobrir a equipa não pode calar um SOS. Nesse caso o alerta
   * sem identificação segue na mesma para todos.
   */
  async emitirAlertaCritico(alerta: {
    tipo: 'sos' | 'sepsis';
    doenteId: string;
    doenteNome: string;
    localizacao: string;
    acionadoPorId?: string;
    detalhe?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.server) return;
    const salasEquipa = [`doente:${alerta.doenteId}`];
    let acionadoPorNome: string | undefined;

    try {
      const [equipa, autor] = await Promise.all([
        this.equipaDeCuidados(alerta.doenteId),
        alerta.acionadoPorId
          ? this.prisma.utilizador.findUnique({ where: { id: alerta.acionadoPorId }, select: { nome: true } })
          : null,
      ]);
      salasEquipa.push(...equipa.map((id) => `user:${id}`));
      acionadoPorNome = autor?.nome ?? undefined;
    } catch (err) {
      this.logger.error(
        `Equipa de cuidados por resolver no alerta ${alerta.tipo}: ${(err as Error)?.message ?? String(err)}`,
      );
    }

    const sinal = {
      tipo: alerta.tipo,
      doenteId: alerta.doenteId,
      quarto: alerta.localizacao,
      acionadoPor: alerta.acionadoPorId,
      // O banner mostrava o id em "Por": quem acciona um SOS identifica-se pelo nome.
      acionadoPorNome,
      ts: Date.now(),
    };

    this.server.to(salasEquipa).emit('sos:alerta', {
      ...alerta.detalhe,
      ...sinal,
      doenteNome: alerta.doenteNome,
      identificado: true,
    });
    this.server
      .to(['role:medico', 'role:enfermeiro'])
      .except(salasEquipa)
      .emit('sos:alerta', { ...sinal, identificado: false });
  }

  /**
   * Quem tem, neste momento, relação de cuidados com o doente: atribuídos no turno em curso,
   * escalados para ele ontem ou hoje (um turno da noite começa num dia e acaba no seguinte) e
   * os chefes dos turnos em curso. É um subconjunto de quem o `assertAcessoDoente` já deixa
   * ler a ficha, que aceita qualquer atribuição histórica.
   */
  private async equipaDeCuidados(doenteId: string): Promise<string[]> {
    const agora = new Date();
    const desdeOntem = new Date(agora);
    desdeOntem.setHours(0, 0, 0, 0);
    desdeOntem.setDate(desdeOntem.getDate() - 1);

    const [atribuidos, escalados, turnos] = await Promise.all([
      this.prisma.atribuicaoDoente.findMany({
        where: { doenteId, turno: { dataInicio: { lte: agora }, dataFim: { gte: agora } } },
        select: { enfermeiroId: true },
      }),
      this.prisma.atribuicaoHorarioTurno.findMany({
        where: { doenteId, horarioTurno: { data: { gte: desdeOntem, lte: agora } } },
        select: { utilizadorId: true },
      }),
      this.prisma.turno.findMany({
        where: { dataInicio: { lte: agora }, dataFim: { gte: agora } },
        select: { chefeTurnoId: true },
      }),
    ]);

    return [
      ...new Set([
        ...atribuidos.map((a) => a.enfermeiroId),
        ...escalados.map((e) => e.utilizadorId),
        ...turnos.map((t) => t.chefeTurnoId),
      ]),
    ];
  }

  emitirPreNotificacao(episodioId: string, triagem: string, etaMinutos: number, queixa: string) {
    const ts = Date.now();
    this.server.to('servico:urgencia').emit('urgencia:ambulancia', { episodioId, triagem, etaMinutos, queixa, ts });
    // A queixa é texto livre escrito no terreno — é lá que acabam idade, sexo e circunstâncias.
    this.server
      .to(['role:medico', 'role:enfermeiro'])
      .except('servico:urgencia')
      .emit('urgencia:ambulancia', { episodioId, triagem, etaMinutos, ts });
  }

  // Sem dados de doente: cirurgia, estado e sala.
  emitirBlocoUpdate(data: object) {
    this.server.to('geral').emit('bloco:update', { ...data, ts: Date.now() });
  }

  emitirSLAExcedido(data: {
    episodioId: string;
    triagem: unknown;
    minutosEspera: number;
    slaMax: number;
    nomeDoente: string;
  }) {
    const sinal = {
      episodioId: data.episodioId,
      triagem: data.triagem,
      minutosEspera: data.minutosEspera,
      slaMax: data.slaMax,
      ts: Date.now(),
    };
    this.server.to('servico:urgencia').emit('urgencia:sla-excedido', { ...sinal, nomeDoente: data.nomeDoente });
    this.server
      .to(['role:medico', 'role:enfermeiro'])
      .except('servico:urgencia')
      .emit('urgencia:sla-excedido', sinal);
  }
}

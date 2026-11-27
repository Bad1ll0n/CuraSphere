import { Injectable, Optional } from '@nestjs/common';
import { BarramentoService } from '../redis/barramento.service';
import { Subject, filter } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { LETRA_SENHA } from '@org/shared';

// UX-26: letras mnemónicas (F = Farmácia, I = Informações, P = Pagamentos), em libs/shared.
const LETRAS = LETRA_SENHA;

const ORDEM_PRIORIDADE = ['prioritario', 'senior', 'normal'];

@Injectable()
export class TicketsService {
  private readonly eventos$ = new Subject<{ data: string; type?: string; tipo?: string }>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly barramento?: BarramentoService,
  ) {
    this.barramento?.subscrever<{ data: string; type?: string; tipo?: string }>('sse:tickets', (e) => this.eventos$.next(e));
  }

  eventStream(tipo?: string) {
    const obs = this.eventos$.asObservable();
    if (!tipo) return obs;
    return obs.pipe(filter(e => !e.tipo || e.tipo === tipo));
  }

  // ARQ-17/OPS-09: o evento SSE vai pelo barramento (Redis) para chegar aos browsers ligados a
  // QUALQUER réplica; sem barramento (testes), fica local como antes.
  private emit(type: string, payload: unknown, tipo?: string) {
    const e = { type, data: JSON.stringify(payload), tipo };
    if (this.barramento) this.barramento.publicar('sse:tickets', e);
    else this.eventos$.next(e);
  }

  async tirarSenha(body: {
    tipo: string;
    prioridade?: string;
    nomeUtente?: string;
    telefone?: string;
  }) {
    const letra = LETRAS[body.tipo] ?? LETRAS['geral'];
    const tipo = LETRAS[body.tipo] ? body.tipo : 'geral';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const contagem = await this.prisma.ticket.count({
      where: { tipo, criadoEm: { gte: hoje } },
    });
    const sequencia = contagem + 1;
    const numero = `${letra}${String(sequencia).padStart(3, '0')}`;

    const ticket = await this.prisma.ticket.create({
      data: {
        numero,
        letra,
        sequencia,
        tipo,
        prioridade: body.prioridade ?? 'normal',
        nomeUtente: body.nomeUtente,
        telefone: body.telefone,
      },
    });

    this.emit('novo_ticket', { ticket, fila: await this.listarFila() }, ticket.tipo);
    return ticket;
  }

  async chamarProximo(balcao: string) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let ticket: Awaited<ReturnType<typeof this.prisma.ticket.findFirst>> = null;

    for (const prioridade of ORDEM_PRIORIDADE) {
      ticket = await this.prisma.ticket.findFirst({
        where: { estado: 'aguarda', prioridade, criadoEm: { gte: hoje } },
        orderBy: { criadoEm: 'asc' },
      });
      if (ticket) break;
    }

    if (!ticket) return null;

    const atualizado = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { estado: 'chamado', balcao, chamadoEm: new Date() },
    });

    this.emit('ticket_chamado', {
      ticket: atualizado,
      fila: await this.listarFila(),
      ultimos: await this.ultimos(5),
    }, atualizado.tipo);
    return atualizado;
  }

  async rechamar(id: string, balcao: string) {
    const ticket = await this.prisma.ticket.findUniqueOrThrow({ where: { id } });
    this.emit('ticket_chamado', {
      ticket: { ...ticket, balcao },
      fila: await this.listarFila(),
      ultimos: await this.ultimos(5),
    });
    return ticket;
  }

  async concluir(id: string) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { estado: 'concluido', concluidoEm: new Date() },
    });
    this.emit('ticket_concluido', { ticket, fila: await this.listarFila() });
    return ticket;
  }

  async marcarDesistiu(id: string) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { estado: 'desistiu' },
    });
    this.emit('ticket_desistiu', { ticket, fila: await this.listarFila() });
    return ticket;
  }

  async listarFila() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const tickets = await this.prisma.ticket.findMany({
      where: { estado: 'aguarda', criadoEm: { gte: hoje } },
      orderBy: [{ criadoEm: 'asc' }],
    });

    const ordenados = ORDEM_PRIORIDADE.flatMap((p) =>
      tickets.filter((t) => t.prioridade === p),
    );
    return ordenados;
  }

  async ultimos(n = 10) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return this.prisma.ticket.findMany({
      where: {
        estado: { in: ['chamado', 'em_atendimento', 'concluido'] },
        criadoEm: { gte: hoje },
        chamadoEm: { not: null },
      },
      orderBy: { chamadoEm: 'desc' },
      take: n,
    });
  }

  async statsHoje() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [total, por_estado, por_tipo] = await Promise.all([
      this.prisma.ticket.count({ where: { criadoEm: { gte: hoje } } }),
      this.prisma.ticket.groupBy({
        by: ['estado'],
        where: { criadoEm: { gte: hoje } },
        _count: true,
      }),
      this.prisma.ticket.groupBy({
        by: ['tipo'],
        where: { criadoEm: { gte: hoje } },
        _count: true,
      }),
    ]);

    return { total, por_estado, por_tipo };
  }
}

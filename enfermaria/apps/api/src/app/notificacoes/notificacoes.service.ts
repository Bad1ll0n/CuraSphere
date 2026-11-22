import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { turnoEmCurso } from '../common/turno-em-curso';
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Simple circuit breaker: after 3 consecutive failures, skip push for 60 s
class PushCircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  private readonly threshold = 3;
  private readonly cooldownMs = 60_000;

  isOpen(): boolean {
    if (Date.now() < this.openUntil) return true;
    if (this.openUntil > 0) { this.failures = 0; this.openUntil = 0; } // half-open reset
    return false;
  }

  recordSuccess() { this.failures = 0; }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openUntil = Date.now() + this.cooldownMs;
  }
}

/**
 * SEC-18 — o push sai do hospital (Expo, Apple, Google) e aparece no ecrã bloqueado. Por
 * omissão leva só um aviso genérico; o conteúdo completo fica na notificação dentro da app.
 * `PUSH_CONTEUDO_COMPLETO=true` repõe o texto completo — só com DPA/SCC documentados
 * (docs/SUBPROCESSADORES.md).
 */
export function conteudoPush(titulo: string, corpo: string): { title: string; body: string } {
  if (process.env['PUSH_CONTEUDO_COMPLETO'] === 'true') return { title: titulo, body: corpo };
  return { title: 'CuraSphere', body: 'Tem uma nova notificação — abra a aplicação para a ver.' };
}

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);
  private readonly pushCB = new PushCircuitBreaker();

  constructor(private readonly prisma: PrismaService) {}

  async registarToken(utilizadorId: string, token: string, plataforma: string) {
    return this.prisma.dispositivoToken.upsert({
      where: { token },
      update: { utilizadorId, plataforma },
      create: { utilizadorId, token, plataforma },
    });
  }

  async enviarParaUtilizador(utilizadorId: string, titulo: string, corpo: string, data?: Record<string, any>): Promise<void> {
    // Persistir in-app
    await this.prisma.notificacaoInApp.create({
      data: { utilizadorId, titulo, corpo, dadosExtra: data ?? undefined },
    }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    // Push via Expo
    const dispositivos = await this.prisma.dispositivoToken.findMany({ where: { utilizadorId } });
    if (dispositivos.length === 0) return;

    const mensagens: ExpoPushMessage[] = dispositivos.map((d) => ({
      to: d.token,
      // SEC-18: o Expo Push (EUA) passa pela Apple e pela Google e aparece no ecrã bloqueado —
      // o texto vai genérico e o conteúdo (com nomes de doentes) lê-se dentro da app.
      ...conteudoPush(titulo, corpo),
      data,
    }));

    if (this.pushCB.isOpen()) {
      this.logger.warn('Push circuit breaker aberto — notificação ignorada');
      return;
    }

    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 5000);
    fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensagens),
      signal: ctrl1.signal,
    })
      .then(() => this.pushCB.recordSuccess())
      .catch((err) => {
        this.pushCB.recordFailure();
        this.logger.warn('Notificação push falhou', err?.message ?? String(err));
      })
      .finally(() => clearTimeout(t1));
  }

  async listar(utilizadorId: string, page = 1, limit = 30) {
    const [total, notificacoes] = await Promise.all([
      this.prisma.notificacaoInApp.count({ where: { utilizadorId } }),
      this.prisma.notificacaoInApp.findMany({
        where: { utilizadorId },
        orderBy: { criadaEm: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
    ]);
    const naoLidas = await this.prisma.notificacaoInApp.count({ where: { utilizadorId, lida: false } });
    // UX-11: tipo, nível e doente à superfície (vêm em dadosExtra), para o sino e a página.
    const comNivel = notificacoes.map((n) => {
      const extra = (n.dadosExtra ?? {}) as Record<string, unknown>;
      const tipo = typeof extra['tipo'] === 'string' ? (extra['tipo'] as string) : undefined;
      const nivel = typeof extra['nivel'] === 'string' ? extra['nivel'] : tipo === 'sos' || tipo === 'sepsis' ? 'critico' : 'informativo';
      return { ...n, tipo, nivel, doenteId: typeof extra['doenteId'] === 'string' ? extra['doenteId'] : undefined };
    });
    return { total, naoLidas, pagina: page, totalPaginas: Math.ceil(total / limit), notificacoes: comNivel };
  }

  async marcarLida(id: string, utilizadorId: string) {
    return this.prisma.notificacaoInApp.updateMany({
      where: { id, utilizadorId },
      data: { lida: true, lidaEm: new Date() },
    });
  }

  async marcarTodasLidas(utilizadorId: string) {
    return this.prisma.notificacaoInApp.updateMany({
      where: { utilizadorId, lida: false },
      data: { lida: true, lidaEm: new Date() },
    });
  }

  async contarNaoLidas(utilizadorId: string) {
    return this.prisma.notificacaoInApp.count({ where: { utilizadorId, lida: false } });
  }

  async enviarParaUtilizadores(ids: string[], titulo: string, corpo: string, data?: Record<string, any>): Promise<void> {
    if (ids.length === 0) return;
    const tokens = await this.prisma.dispositivoToken.findMany({ where: { utilizadorId: { in: ids } } });
    await Promise.all(ids.map((id) =>
      this.prisma.notificacaoInApp.create({
        data: { utilizadorId: id, titulo, corpo, dadosExtra: (data ?? null) as any },
      }).catch((err) => this.logger.warn('Notificação in-app falhou', err?.message ?? String(err))),
    ));
    if (tokens.length === 0) return;

    const mensagens: ExpoPushMessage[] = tokens.map((d) => ({
      to: d.token,
      // SEC-18: o Expo Push (EUA) passa pela Apple e pela Google e aparece no ecrã bloqueado —
      // o texto vai genérico e o conteúdo (com nomes de doentes) lê-se dentro da app.
      ...conteudoPush(titulo, corpo),
      data,
    }));

    if (this.pushCB.isOpen()) {
      this.logger.warn('Push circuit breaker aberto — notificação ignorada');
      return;
    }

    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 5000);
    fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensagens),
      signal: ctrl2.signal,
    })
      .then(() => this.pushCB.recordSuccess())
      .catch((err) => {
        this.pushCB.recordFailure();
        this.logger.warn('Notificação push falhou', err?.message ?? String(err));
      })
      .finally(() => clearTimeout(t2));
  }

  async enviarParaRole(role: string, titulo: string, corpo: string, data?: Record<string, any>): Promise<void> {
    const utilizadores = await this.prisma.utilizador.findMany({
      where: { role, ativo: true },
      select: { id: true },
    });
    await Promise.all(utilizadores.map((u) => this.enviarParaUtilizador(u.id, titulo, corpo, data)));
  }

  /**
   * Turno em curso, pelo relógio. Duplica deliberadamente o helper homónimo de
   * `AlertasService`: esse serviço depende deste, e importá-lo aqui fecharia um ciclo.
   */
  /** UX-12: a regra do turno está em libs/shared (turnos.ts) — ver common/turno-em-curso.ts. */
  private turnoAtual() {
    const t = turnoEmCurso();
    return { tipoTurno: t.tipo, dataHoje: t.data.gte, dataFim: t.data.lte };
  }

  /**
   * Quem deve receber um alerta clínico deste doente, por ordem de proximidade.
   *
   * A versão anterior consultava apenas `AtribuicaoDoente.enfermeiroId`, sem filtro de turno
   * nem de utilizador activo: um doente sem atribuição tinha **zero destinatários** (o alerta
   * era criado e ninguém era avisado) e **nenhum médico** era alguma vez notificado.
   */
  private async destinatariosDoDoente(doenteId: string): Promise<string[]> {
    const agora = new Date();
    const ids = new Set<string>();

    // 1. Enfermeiros atribuídos ao doente — restritos ao turno em curso quando existe um.
    //    Sem turno aberto mantém-se o comportamento anterior (todas as atribuições) em vez
    //    de deixar o doente sem destinatários.
    const turnoAberto = await this.prisma.turno.findFirst({
      where: { dataInicio: { lte: agora }, dataFim: { gte: agora } },
      select: { id: true, chefeTurnoId: true },
    });
    const atribuicoes = await this.prisma.atribuicaoDoente.findMany({
      where: { doenteId, ...(turnoAberto ? { turnoId: turnoAberto.id } : {}) },
      select: { enfermeiroId: true },
    });
    atribuicoes.forEach((a) => ids.add(a.enfermeiroId));

    // 2. Médico(s) responsáveis pelo doente no turno em curso.
    const { tipoTurno, dataHoje, dataFim } = this.turnoAtual();
    const atribuicoesHorario = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        doenteId,
        horarioTurno: { tipo: tipoTurno as never, data: { gte: dataHoje, lte: dataFim } },
      },
      select: { utilizador: { select: { id: true, role: true } } },
    });
    atribuicoesHorario
      .filter((a) => a.utilizador.role === 'medico')
      .forEach((a) => ids.add(a.utilizador.id));

    // 3. Fallback: chefe do turno em curso, e depois a chefia de serviço. Um alerta clínico
    //    sem destinatário é um alerta perdido — nunca se devolve lista vazia por omissão.
    if (ids.size === 0 && turnoAberto?.chefeTurnoId) ids.add(turnoAberto.chefeTurnoId);
    if (ids.size === 0) {
      const chefias = await this.prisma.utilizador.findMany({
        where: { ativo: true, OR: [{ role: { in: ['chefe_turno', 'chefe_enfermeiros'] } }, { subRole: { in: ['chefe_turno', 'chefe_enfermeiros'] } }] },
        select: { id: true },
      });
      chefias.forEach((u) => ids.add(u.id));
    }

    if (ids.size === 0) return [];

    // 4. Só utilizadores activos (uma conta desactivada não recebe alertas clínicos).
    const ativos = await this.prisma.utilizador.findMany({
      where: { id: { in: [...ids] }, ativo: true },
      select: { id: true },
    });
    return ativos.map((u) => u.id);
  }

  /**
   * UX-11: a notificação leva o tipo e o NÍVEL (crítico / aviso / informativo) e o doente — o
   * sino só tocava e destacava "críticos" por um `tipo` que nunca era enviado, e o clique não
   * sabia para onde ir.
   */
  async enviarParaDoente(doenteId: string, titulo: string, corpo: string, extra: { tipo?: string; severidade?: number } = {}): Promise<void> {
    const ids = await this.destinatariosDoDoente(doenteId);
    if (ids.length === 0) {
      // Visível nos logs: um alerta clínico que não chegou a ninguém é um incidente.
      this.logger.error(`Alerta do doente ${doenteId} sem destinatários — "${titulo}"`);
      return;
    }
    const nivel = (extra.severidade ?? 1) >= 3 ? 'critico' : (extra.severidade ?? 1) >= 2 ? 'aviso' : 'informativo';
    await Promise.all(ids.map((id) => this.enviarParaUtilizador(id, titulo, corpo, { doenteId, ...(extra.tipo ? { tipo: extra.tipo } : {}), nivel })));
  }
}

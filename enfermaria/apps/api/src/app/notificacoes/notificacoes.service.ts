import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

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
      data: { utilizadorId, titulo, corpo, dadosExtra: data ?? null },
    }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    // Push via Expo
    const dispositivos = await this.prisma.dispositivoToken.findMany({ where: { utilizadorId } });
    if (dispositivos.length === 0) return;

    const mensagens: ExpoPushMessage[] = dispositivos.map((d) => ({
      to: d.token,
      title: titulo,
      body: corpo,
      data,
    }));

    fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensagens),
    }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
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
    return { total, naoLidas, pagina: page, totalPaginas: Math.ceil(total / limit), notificacoes };
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

  async enviarParaRole(role: string, titulo: string, corpo: string, data?: Record<string, any>): Promise<void> {
    const utilizadores = await this.prisma.utilizador.findMany({
      where: { role, ativo: true },
      select: { id: true },
    });
    await Promise.all(utilizadores.map((u) => this.enviarParaUtilizador(u.id, titulo, corpo, data)));
  }

  async enviarParaDoente(doenteId: string, titulo: string, corpo: string): Promise<void> {
    // Notifica todos os profissionais atribuídos ao doente no turno atual
    const atribuicoes = await this.prisma.atribuicaoDoente.findMany({
      where: { doenteId },
      select: { enfermeiroId: true },
    });
    const ids = [...new Set(atribuicoes.map((a) => a.enfermeiroId))];
    await Promise.all(ids.map((id) => this.enviarParaUtilizador(id, titulo, corpo, { doenteId })));
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async registarToken(utilizadorId: string, token: string, plataforma: string) {
    return this.prisma.dispositivoToken.upsert({
      where: { token },
      update: { utilizadorId, plataforma },
      create: { utilizadorId, token, plataforma },
    });
  }

  async enviarParaUtilizador(utilizadorId: string, titulo: string, corpo: string, data?: Record<string, any>): Promise<void> {
    const dispositivos = await this.prisma.dispositivoToken.findMany({ where: { utilizadorId } });
    if (dispositivos.length === 0) return;

    const mensagens: ExpoPushMessage[] = dispositivos.map((d) => ({
      to: d.token,
      title: titulo,
      body: corpo,
      data,
    }));

    // Expo Push API — fire-and-forget
    fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensagens),
    }).catch(() => {});
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

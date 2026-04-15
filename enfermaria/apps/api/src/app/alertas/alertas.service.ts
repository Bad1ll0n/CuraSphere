import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class AlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoesService: NotificacoesService,
  ) {}

  async listarNaoLidos(doenteId: string) {
    return this.prisma.alertaClinico.findMany({
      where: { doenteId, lido: false },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async marcarLido(id: string) {
    return this.prisma.alertaClinico.update({
      where: { id },
      data: { lido: true },
    });
  }

  async marcarTodosLidos(doenteId: string) {
    return this.prisma.alertaClinico.updateMany({
      where: { doenteId, lido: false },
      data: { lido: true },
    });
  }

  criarAlerta(doenteId: string, tipo: string, mensagem: string): void {
    this.prisma.alertaClinico
      .create({ data: { doenteId, tipo, mensagem } })
      .then(() => {
        this.notificacoesService.enviarParaDoente(doenteId, '🚨 Alerta Clínico', mensagem).catch(() => {});
      })
      .catch(() => {});
  }
}

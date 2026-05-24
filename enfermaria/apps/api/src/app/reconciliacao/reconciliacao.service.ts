import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

export interface ItemReconciliacao {
  tipo: 'prescricao_sem_validacao' | 'medicacao_sem_mar' | 'pedido_pendente_longa';
  doenteId?: string;
  doenteNome?: string;
  descricao: string;
  detalhe: string;
  horasAtraso: number;
  criadoEm: string;
}

@Injectable()
export class ReconciliacaoService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ReconciliacaoService.name);
  private intervalo: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertasService: AlertasService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  onApplicationBootstrap() {
    // Verificar a cada 30 minutos
    this.intervalo = setInterval(() => this.verificarEAlertar(), 30 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  async verificarEAlertar() {
    try {
      const problemas = await this.verificar();
      for (const p of problemas) {
        if (p.doenteId) {
          this.alertasService.criarAlerta(p.doenteId, `reconciliacao_${p.tipo}`, p.descricao);
        }
      }
      if (problemas.length > 0) {
        this.logger.warn(`Reconciliação: ${problemas.length} problemas detectados`);

        // Notificar farmacêuticos e médicos sobre problemas de reconciliação
        const farmaceuticos = await this.prisma.utilizador.findMany({
          where: { role: 'farmaceutico', ativo: true },
          select: { id: true },
        });
        const mensagem = problemas.length === 1
          ? `Reconciliação MAR: ${problemas[0].descricao}`
          : `Reconciliação MAR: ${problemas.length} problemas detectados (ex: ${problemas[0].descricao})`;

        for (const f of farmaceuticos) {
          this.notificacoes.enviarParaUtilizador(f.id, 'Alerta de Reconciliação', mensagem, { tipo: 'reconciliacao' }).catch(() => {});
        }
      }
    } catch (e) {
      this.logger.error('Erro na reconciliação automática', e);
    }
  }

  async verificar(): Promise<ItemReconciliacao[]> {
    const agora = new Date();
    const h2 = new Date(agora.getTime() - 2 * 60 * 60 * 1000);
    const h8 = new Date(agora.getTime() - 8 * 60 * 60 * 1000);
    const h24 = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const h1 = new Date(agora.getTime() - 60 * 60 * 1000);

    const [semValidacao, semMar, pedidosPendentes] = await Promise.all([
      // 1) Prescrições criadas há >2h sem validação farmacêutica
      this.prisma.medicacao.findMany({
        where: { estadoValidacao: null, ativo: true, iniciadoEm: { lt: h2 } },
        include: {
          doente: { select: { id: true, nome: true } },
          prescritoPor: { select: { nome: true } },
        },
        take: 50,
        orderBy: { iniciadoEm: 'asc' },
      }),

      // 2) Medicações activas sem nenhum registo MAR nas últimas 24h
      this.prisma.medicacao.findMany({
        where: {
          ativo: true,
          iniciadoEm: { lt: h8 },
          registos: {
            none: {
              naoAdministrada: false,
              administradoEm: { gte: h24 },
            },
          },
        },
        include: { doente: { select: { id: true, nome: true } } },
        take: 50,
        orderBy: { iniciadoEm: 'asc' },
      }),

      // 3) Pedidos de farmácia pendentes há >1h
      this.prisma.pedidoFarmacia.findMany({
        where: { estado: 'pendente', criadoEm: { lt: h1 } },
        include: { stockItem: { select: { nome: true } }, solicitadoPor: { select: { nome: true } } },
        take: 50,
        orderBy: { criadoEm: 'asc' },
      }),
    ]);

    const resultados: ItemReconciliacao[] = [];

    for (const med of semValidacao) {
      const horasAtraso = Math.round((agora.getTime() - med.iniciadoEm.getTime()) / 3600000);
      resultados.push({
        tipo: 'prescricao_sem_validacao',
        doenteId: med.doente.id,
        doenteNome: med.doente.nome,
        descricao: `Prescrição de ${med.nome} sem validação farmacêutica há ${horasAtraso}h`,
        detalhe: `Prescrita por: ${med.prescritoPor.nome}`,
        horasAtraso,
        criadoEm: med.iniciadoEm.toISOString(),
      });
    }

    for (const med of semMar) {
      const horasAtraso = Math.round((agora.getTime() - med.iniciadoEm.getTime()) / 3600000);
      resultados.push({
        tipo: 'medicacao_sem_mar',
        doenteId: med.doente.id,
        doenteNome: med.doente.nome,
        descricao: `${med.nome} sem registo de administração nas últimas 24h`,
        detalhe: `Doente: ${med.doente.nome} · Dose: ${med.dose} ${med.via} ${med.frequencia}`,
        horasAtraso,
        criadoEm: med.iniciadoEm.toISOString(),
      });
    }

    for (const ped of pedidosPendentes) {
      const horasAtraso = Math.round((agora.getTime() - ped.criadoEm.getTime()) / 3600000);
      resultados.push({
        tipo: 'pedido_pendente_longa',
        descricao: `Pedido de ${ped.stockItem.nome} pendente há ${horasAtraso}h`,
        detalhe: `Solicitado por: ${ped.solicitadoPor.nome} · Serviço: ${ped.servico}`,
        horasAtraso,
        criadoEm: ped.criadoEm.toISOString(),
      });
    }

    return resultados.sort((a, b) => b.horasAtraso - a.horasAtraso);
  }

  async resumo() {
    const problemas = await this.verificar();
    return {
      total: problemas.length,
      porTipo: {
        prescricaoSemValidacao: problemas.filter((p) => p.tipo === 'prescricao_sem_validacao').length,
        medicacaoSemMar: problemas.filter((p) => p.tipo === 'medicacao_sem_mar').length,
        pedidoPendente: problemas.filter((p) => p.tipo === 'pedido_pendente_longa').length,
      },
      itens: problemas,
    };
  }
}

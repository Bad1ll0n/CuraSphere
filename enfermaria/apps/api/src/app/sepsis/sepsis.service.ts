import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { EventsGateway } from '../gateway/events.gateway';

interface SinalVitalParams {
  frequenciaRespiratoria?: number | null;
  pressaoSistolica?: number | null;
  pulso?: number | null;
  temperatura?: number | null;
}

@Injectable()
export class SepsisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
    private readonly gateway: EventsGateway,
  ) {}

  calcularQSOFA(sv: SinalVitalParams): number {
    let score = 0;
    if (sv.frequenciaRespiratoria != null && sv.frequenciaRespiratoria >= 22) score++;
    if (sv.pressaoSistolica != null && sv.pressaoSistolica <= 100) score++;
    return score;
  }

  calcularSIRS(sv: SinalVitalParams): number {
    let score = 0;
    if (sv.temperatura != null && (sv.temperatura > 38 || sv.temperatura < 36)) score++;
    if (sv.pulso != null && sv.pulso > 90) score++;
    if (sv.frequenciaRespiratoria != null && sv.frequenciaRespiratoria > 20) score++;
    return score;
  }

  async avaliar(doenteId: string, sv: SinalVitalParams): Promise<void> {
    const qsofa = this.calcularQSOFA(sv);
    const sirs = this.calcularSIRS(sv);

    if (qsofa < 2 && sirs < 2) return;

    const criterio = qsofa >= 2 ? 'qsofa' : 'sirs';
    const score = criterio === 'qsofa' ? qsofa : sirs;

    const limiteDeduplicacao = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const existente = await this.prisma.alertaSepsis.findFirst({
      where: { doenteId, resolvido: false, criadoEm: { gte: limiteDeduplicacao } },
      select: { id: true },
    });
    if (existente) return;

    const alerta = await this.prisma.alertaSepsis.create({
      data: { doenteId, criterio, score },
    });

    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: { nome: true, cama: { select: { numero: true } } },
    });

    const msg = `🆘 ALERTA SÉPSIS — ${doente?.nome ?? doenteId} | ${criterio.toUpperCase()} ${score}/${criterio === 'qsofa' ? 3 : 3}`;

    await this.alertas.criarAlerta(doenteId, 'sepsis', msg).catch(() => null);

    this.gateway.server?.emit('sos:alerta', {
      tipo: 'sepsis',
      doenteId,
      doenteName: doente?.nome,
      cama: doente?.cama?.numero,
      criterio,
      score,
      alertaSepsisId: alerta.id,
    });
  }

  async atualizarBundle(id: string, campo: string): Promise<void> {
    const alerta = await this.prisma.alertaSepsis.findUnique({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta de sépsis não encontrado');

    const campoTs = `${campo}Em` as keyof typeof alerta;
    await this.prisma.alertaSepsis.update({
      where: { id },
      data: {
        [campo]: true,
        [campoTs]: new Date(),
      } as any,
    });
  }

  async resolver(id: string): Promise<void> {
    const alerta = await this.prisma.alertaSepsis.findUnique({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta de sépsis não encontrado');
    await this.prisma.alertaSepsis.update({
      where: { id },
      data: { resolvido: true, resolvidoEm: new Date() },
    });
  }

  listarAtivos(doenteId: string) {
    return this.prisma.alertaSepsis.findMany({
      where: { doenteId, resolvido: false },
      orderBy: { criadoEm: 'desc' },
    });
  }
}

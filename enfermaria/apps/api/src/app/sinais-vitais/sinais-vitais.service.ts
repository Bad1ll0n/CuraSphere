import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const ROLES_PODEM_REGISTAR = [
  'enfermeiro', 'auxiliar', 'medico',
  'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos',
];

export interface CriarSinalVitalDto {
  pressaoSistolica?: number;
  pressaoDiastolica?: number;
  pulso?: number;
  temperatura?: number;
  saturacaoO2?: number;
  frequenciaRespiratoria?: number;
  peso?: number;
  notas?: string;
}

function detetar(dto: CriarSinalVitalDto): string[] {
  const alertas: string[] = [];
  if (dto.saturacaoO2 != null && dto.saturacaoO2 < 90)
    alertas.push(`SpO₂ crítica: ${dto.saturacaoO2}%`);
  if (dto.pressaoSistolica != null && (dto.pressaoSistolica >= 160 || dto.pressaoSistolica < 80))
    alertas.push(`TA sistólica crítica: ${dto.pressaoSistolica} mmHg`);
  if (dto.pulso != null && (dto.pulso > 120 || dto.pulso < 50))
    alertas.push(`Pulso crítico: ${dto.pulso} bpm`);
  if (dto.temperatura != null && (dto.temperatura > 38.5 || dto.temperatura < 35))
    alertas.push(`Temperatura crítica: ${dto.temperatura}ºC`);
  return alertas;
}

@Injectable()
export class SinaisVitaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertasService: AlertasService,
    private readonly notificacoesService: NotificacoesService,
  ) {}

  async criar(doenteId: string, utilizadorId: string, role: string, dto: CriarSinalVitalDto) {
    if (!ROLES_PODEM_REGISTAR.includes(role)) {
      throw new ForbiddenException('Sem permissão para registar sinais vitais');
    }

    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException('Doente não encontrado');

    const registo = await this.prisma.sinalVital.create({
      data: { doenteId, registadoPorId: utilizadorId, ...dto },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });

    // Verificar valores críticos e criar alertas
    const criticos = detetar(dto);
    for (const msg of criticos) {
      this.alertasService.criarAlerta(doenteId, 'sinal_vital_critico', msg);
      this.notificacoesService.enviarParaDoente(
        doenteId,
        `⚠ Sinal Vital Crítico — ${doente.nome}`,
        msg,
      );
    }

    return registo;
  }

  async listar(doenteId: string) {
    return this.prisma.sinalVital.findMany({
      where: { doenteId },
      orderBy: { data: 'desc' },
      take: 20,
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async ultimo(doenteId: string) {
    return this.prisma.sinalVital.findFirst({
      where: { doenteId },
      orderBy: { data: 'desc' },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }
}

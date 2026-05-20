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
  avpu?: string;
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

function calcularNEWS2(dto: CriarSinalVitalDto): number | null {
  const parametros = [
    dto.frequenciaRespiratoria, dto.saturacaoO2, dto.temperatura,
    dto.pressaoSistolica, dto.pulso,
  ];
  // Só calcular se pelo menos 3 parâmetros presentes
  if (parametros.filter((p) => p != null).length < 3) return null;

  let score = 0;

  if (dto.frequenciaRespiratoria != null) {
    const fr = dto.frequenciaRespiratoria;
    if (fr <= 8) score += 3;
    else if (fr <= 11) score += 1;
    else if (fr <= 20) score += 0;
    else if (fr <= 24) score += 2;
    else score += 3;
  }

  if (dto.saturacaoO2 != null) {
    const spo2 = dto.saturacaoO2;
    if (spo2 <= 91) score += 3;
    else if (spo2 <= 93) score += 2;
    else if (spo2 <= 95) score += 1;
  }

  if (dto.temperatura != null) {
    const t = dto.temperatura;
    if (t <= 35.0) score += 3;
    else if (t <= 36.0) score += 1;
    else if (t <= 38.0) score += 0;
    else if (t <= 39.0) score += 1;
    else score += 2;
  }

  if (dto.pressaoSistolica != null) {
    const ps = dto.pressaoSistolica;
    if (ps <= 90) score += 3;
    else if (ps <= 100) score += 2;
    else if (ps <= 110) score += 1;
    else if (ps <= 219) score += 0;
    else score += 3;
  }

  if (dto.pulso != null) {
    const fc = dto.pulso;
    if (fc <= 40) score += 3;
    else if (fc <= 50) score += 1;
    else if (fc <= 90) score += 0;
    else if (fc <= 110) score += 1;
    else if (fc <= 130) score += 2;
    else score += 3;
  }

  if (dto.avpu && dto.avpu !== 'A') score += 3;

  return score;
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
    if (!doente || !doente.ativo) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    const news2 = calcularNEWS2(dto);
    const data: any = { doenteId, registadoPorId: utilizadorId, ...dto };
    if (news2 != null) data.news2 = news2;

    const registo = await this.prisma.sinalVital.create({
      data,
      include: { registadoPor: { select: { id: true, nome: true } } },
    });

    // Alertas por valores individuais críticos
    const criticos = detetar(dto);
    for (const msg of criticos) {
      this.alertasService.criarAlerta(doenteId, 'sinal_vital_critico', msg);
      this.notificacoesService.enviarParaDoente(
        doenteId,
        `⚠ Sinal Vital Crítico — ${doente.nome}`,
        msg,
      );
    }

    // Alerta NEWS2 (score composto — mais abrangente que alertas individuais)
    if (news2 != null && news2 >= 5) {
      const nivel = news2 >= 7 ? 'CRÍTICO' : 'ALTO';
      const resposta = news2 >= 7 ? 'Resposta imediata (≥7)' : 'Resposta urgente (5–6)';
      const msg = `NEWS2 ${nivel} — Score ${news2}. ${resposta} necessária.`;
      this.alertasService.criarAlerta(doenteId, news2 >= 7 ? 'news2_critico' : 'news2_alto', msg);
      this.notificacoesService.enviarParaDoente(
        doenteId,
        `🔴 NEWS2 ${nivel} — ${doente.nome}`,
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

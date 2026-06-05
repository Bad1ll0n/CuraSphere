import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { ProtocolosService } from '../protocolos/protocolos.service';
import { SepsisService } from '../sepsis/sepsis.service';
import { BaselinesService } from '../baselines/baselines.service';
import { calcularNEWS2 } from '../common/news2.helper';

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

@Injectable()
export class SinaisVitaisService {
  private readonly logger = new Logger(SinaisVitaisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertasService: AlertasService,
    private readonly notificacoesService: NotificacoesService,
    private readonly protocolosService: ProtocolosService,
    private readonly sepsisService: SepsisService,
    private readonly baselinesService: BaselinesService,
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

      if (news2 >= 7) {
        this.protocolosService.ativarSeNaoAtivo(doenteId, 'sepsis').catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
      }
    }

    // Hooks assíncronos: Sépsis Sentinel + Baselines Individuais
    this.sepsisService.avaliar(doenteId, dto).catch((err) => this.logger.warn('SepsisService.avaliar falhou', err?.message ?? String(err)));
    this.baselinesService.avaliarEAlertar(doenteId, dto).catch((err) => this.logger.warn('BaselinesService.avaliarEAlertar falhou', err?.message ?? String(err)));

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

  async analisarTendencia(doenteId: string) {
    const registos = await this.prisma.sinalVital.findMany({
      where: { doenteId },
      orderBy: { data: 'asc' },
      take: 6,
      select: {
        data: true, pressaoSistolica: true, pulso: true,
        saturacaoO2: true, frequenciaRespiratoria: true, temperatura: true, news2: true,
      },
    });

    if (registos.length < 2) {
      return { risco: 'indeterminado', motivo: 'Registos insuficientes para análise de tendência', tendencias: [] };
    }

    type Campo = 'pressaoSistolica' | 'pulso' | 'saturacaoO2' | 'frequenciaRespiratoria' | 'temperatura';
    type Direcao = 'estavel' | 'melhoria' | 'deterioracao';

    function calcularTendencia(valores: (number | null)[]): { slope: number; direcao: Direcao } {
      const validos = valores.filter((v): v is number => v != null);
      if (validos.length < 2) return { slope: 0, direcao: 'estavel' };
      const n = validos.length;
      const xs = validos.map((_, i) => i);
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = validos.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((s, x, i) => s + (x - meanX) * (validos[i] - meanY), 0);
      const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
      const slope = den === 0 ? 0 : num / den;
      const direcao: Direcao = Math.abs(slope) < 0.1 ? 'estavel' : slope > 0 ? 'aumento' as Direcao : 'queda' as Direcao;
      return { slope, direcao };
    }

    const parametros: { campo: Campo; label: string; alarmeQueda?: number; alarmeSubida?: number }[] = [
      { campo: 'saturacaoO2',           label: 'SpO₂ (%)',         alarmeQueda: -1.5 },
      { campo: 'pressaoSistolica',      label: 'TA Sistólica',     alarmeQueda: -8,  alarmeSubida: 12 },
      { campo: 'pulso',                 label: 'Pulso (bpm)',      alarmeSubida: 8 },
      { campo: 'frequenciaRespiratoria',label: 'FR (/min)',        alarmeSubida: 1.5 },
      { campo: 'temperatura',           label: 'Temperatura (°C)', alarmeSubida: 0.3 },
    ];

    const tendencias: { parametro: string; slope: number; direcao: string; alerta: boolean; mensagem?: string }[] = [];
    let alertasCount = 0;

    for (const p of parametros) {
      const valores = registos.map((r) => r[p.campo] as number | null);
      const { slope, direcao } = calcularTendencia(valores);
      let alerta = false;
      let mensagem: string | undefined;

      if (p.alarmeQueda != null && slope < p.alarmeQueda) {
        alerta = true;
        mensagem = `${p.label} em queda progressiva (${slope.toFixed(2)} por registo)`;
        alertasCount++;
      } else if (p.alarmeSubida != null && slope > p.alarmeSubida) {
        alerta = true;
        mensagem = `${p.label} em subida progressiva (${slope.toFixed(2)} por registo)`;
        alertasCount++;
      }

      tendencias.push({ parametro: p.label, slope: parseFloat(slope.toFixed(3)), direcao, alerta, mensagem });
    }

    // Tendência do NEWS2 score
    const scoresNews2 = registos.map((r) => r.news2);
    const { slope: newsSlope } = calcularTendencia(scoresNews2);
    if (newsSlope > 0.8) {
      alertasCount++;
      tendencias.push({
        parametro: 'NEWS2', slope: parseFloat(newsSlope.toFixed(3)),
        direcao: 'aumento', alerta: true,
        mensagem: `Score NEWS2 em agravamento progressivo (+${newsSlope.toFixed(1)} por registo)`,
      });
    }

    const ultimoScore = registos[registos.length - 1].news2 ?? 0;
    const risco =
      alertasCount >= 2 || ultimoScore >= 7 ? 'alto' :
      alertasCount === 1 || ultimoScore >= 5 ? 'moderado' : 'baixo';

    return {
      risco,
      news2Atual: ultimoScore,
      totalRegistosAnalisados: registos.length,
      alertas: alertasCount,
      tendencias,
      recomendacao:
        risco === 'alto'    ? 'Reavaliação imediata. Considerar escalada de cuidados.' :
        risco === 'moderado'? 'Monitorizar com maior frequência. Alertar médico responsável.' :
                              'Parâmetros estáveis. Manter monitorização habitual.',
    };
  }
}

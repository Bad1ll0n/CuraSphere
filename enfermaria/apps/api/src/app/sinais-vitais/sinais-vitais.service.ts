import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { ProtocolosService } from '../protocolos/protocolos.service';
import { SepsisService } from '../sepsis/sepsis.service';
import { BaselinesService } from '../baselines/baselines.service';
import { calcularNEWS2 } from '../common/news2.helper';
import { calcularPEWS, idadeEmMeses, PEWS_IDADE_MAX_MESES } from '../common/pews.helper';

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
  o2Suplementar?: boolean;
  glasgow?: number;
  pamMedia?: number;
  vasopressores?: boolean;
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
    return this._processarVital(doenteId, utilizadorId, dto, 'manual');
  }

  /**
   * Ingestão de um vital a partir de um dispositivo de monitorização contínua.
   * Passa pela MESMA pipeline (NEWS2 + alertas + watchdog de sépsis + baselines) do
   * registo manual — sem verificação de role (a autenticação é por chave de dispositivo).
   */
  async ingerirDeMonitor(doenteId: string, responsavelId: string, dto: CriarSinalVitalDto) {
    return this._processarVital(doenteId, responsavelId, dto, 'monitor');
  }

  private async _processarVital(doenteId: string, registadoPorId: string, dto: CriarSinalVitalDto, origem: 'manual' | 'monitor') {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    const news2 = calcularNEWS2(dto);
    const data: any = { doenteId, registadoPorId, origem, ...dto };
    if (news2 != null) data.news2 = news2;

    // PEWS (pediátrico) — calculado por faixa etária quando o doente tem < 16 anos.
    let pews: number | null = null;
    if (doente.dataNascimento) {
      const meses = idadeEmMeses(doente.dataNascimento);
      if (meses < PEWS_IDADE_MAX_MESES) {
        pews = calcularPEWS(
          { frequenciaRespiratoria: dto.frequenciaRespiratoria, saturacaoO2: dto.saturacaoO2, pulso: dto.pulso, temperatura: dto.temperatura, avpu: dto.avpu },
          meses,
        );
        if (pews != null) data.pews = pews;
      }
    }

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

    // Alerta PEWS (pediátrico) — a criança deteriora rápido, por isso limiares sensíveis.
    if (pews != null && pews >= 4) {
      const nivel = pews >= 6 ? 'CRÍTICO' : 'ALTO';
      const msg = `PEWS ${nivel} — Score ${pews} (pediátrico). Reavaliação ${pews >= 6 ? 'imediata' : 'urgente'} necessária.`;
      this.alertasService.criarAlerta(doenteId, pews >= 6 ? 'pews_critico' : 'pews_alto', msg);
      this.notificacoesService.enviarParaDoente(doenteId, `🔴 PEWS ${nivel} — ${doente.nome}`, msg);
    }

    // Hooks assíncronos: Sépsis Sentinel + Baselines Individuais
    this.sepsisService.avaliar(doenteId, dto).catch((err) => this.logger.warn('SepsisService.avaliar falhou', err?.message ?? String(err)));
    this.baselinesService.avaliarEAlertar(doenteId, dto as any).catch((err) => this.logger.warn('BaselinesService.avaliarEAlertar falhou', err?.message ?? String(err)));

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

  async calcularScores(doenteId: string) {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [sv, doente, labs] = await Promise.all([
      this.prisma.sinalVital.findFirst({
        where: { doenteId },
        orderBy: { data: 'desc' },
        select: {
          frequenciaRespiratoria: true, pressaoSistolica: true, pressaoDiastolica: true,
          avpu: true, news2: true, data: true,
          saturacaoO2: true, glasgow: true, pamMedia: true, vasopressores: true,
        },
      }),
      this.prisma.doente.findUnique({ where: { id: doenteId }, select: { dataNascimento: true } }),
      this.prisma.resultadoAnalise.findMany({
        where: { doenteId, registadoEm: { gte: ontem } },
        orderBy: { registadoEm: 'desc' },
        select: { parametro: true, valor: true },
      }),
    ]);

    if (!sv) return { qSOFA: null, curb65: null, sofa: null, mensagem: 'Sem registos de sinais vitais' };

    // qSOFA (Seymour 2016 — triagem rápida de sépsis, 3 critérios bedside)
    const qsofaCriterios: { criterio: string; valor: boolean }[] = [
      { criterio: `FR ≥22 (actual: ${sv.frequenciaRespiratoria ?? 'N/A'})`, valor: (sv.frequenciaRespiratoria ?? 0) >= 22 },
      { criterio: `PAS ≤100 (actual: ${sv.pressaoSistolica ?? 'N/A'})`, valor: (sv.pressaoSistolica ?? 999) <= 100 },
      { criterio: `Consciência alterada (AVPU: ${sv.avpu ?? 'N/A'})`, valor: !!(sv.avpu && sv.avpu !== 'A') },
    ];
    const qsofaScore = qsofaCriterios.filter(c => c.valor).length;

    // CURB-65 (British Thoracic Society — gravidade pneumonia)
    const idadeAnos = doente?.dataNascimento
      ? Math.floor((Date.now() - new Date(doente.dataNascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;

    const curb65Criterios: { criterio: string; valor: boolean | null }[] = [
      { criterio: `Confusão (AVPU: ${sv.avpu ?? 'N/A'})`, valor: !!(sv.avpu && sv.avpu !== 'A') },
      { criterio: 'Ureia >7 mmol/L', valor: null }, // requer lab
      { criterio: `FR ≥30 (actual: ${sv.frequenciaRespiratoria ?? 'N/A'})`, valor: (sv.frequenciaRespiratoria ?? 0) >= 30 },
      { criterio: `PAS <90 ou PAD ≤60 (actual: ${sv.pressaoSistolica ?? 'N/A'}/${sv.pressaoDiastolica ?? 'N/A'})`, valor: (sv.pressaoSistolica ?? 999) < 90 || (sv.pressaoDiastolica ?? 999) <= 60 },
      { criterio: `Idade ≥65 (${idadeAnos != null ? idadeAnos + ' anos' : 'N/A'})`, valor: idadeAnos != null ? idadeAnos >= 65 : null },
    ];
    const curb65Score = curb65Criterios.filter(c => c.valor === true).length;

    // SOFA Score — Sequential Organ Failure Assessment (Vincent 1996)
    // Requer dados clínicos + laboratoriais das últimas 24h
    function getLab(nome: string): number | null {
      const match = labs.find(l => l.parametro.toLowerCase().includes(nome.toLowerCase()));
      return match ? match.valor : null;
    }

    const plaquetas = getLab('plaqueta') ?? getLab('platelet');
    const bilirrubina = getLab('bilirrub');
    const creatinina = getLab('creatinin');

    // Componente 1 — Respiratório (SpO2 proxy para PaO2/FiO2)
    const spo2 = sv.saturacaoO2;
    let sofaResp = 0;
    if (spo2 != null) {
      if (spo2 < 88) sofaResp = 4;
      else if (spo2 <= 90) sofaResp = 3;
      else if (spo2 <= 93) sofaResp = 2;
      else if (spo2 <= 95) sofaResp = 1;
    }

    // Componente 2 — Coagulação (plaquetas ×10³/µL)
    let sofaCoag = 0;
    if (plaquetas != null) {
      if (plaquetas < 20) sofaCoag = 4;
      else if (plaquetas < 50) sofaCoag = 3;
      else if (plaquetas < 100) sofaCoag = 2;
      else if (plaquetas < 150) sofaCoag = 1;
    }

    // Componente 3 — Hepático (bilirrubina mg/dL)
    let sofaHep = 0;
    if (bilirrubina != null) {
      if (bilirrubina >= 12) sofaHep = 4;
      else if (bilirrubina >= 6) sofaHep = 3;
      else if (bilirrubina >= 2) sofaHep = 2;
      else if (bilirrubina >= 1.2) sofaHep = 1;
    }

    // Componente 4 — Cardiovascular (PAM + vasopressores)
    const pam = sv.pamMedia ?? (sv.pressaoSistolica != null && sv.pressaoDiastolica != null
      ? Math.round(sv.pressaoDiastolica + (sv.pressaoSistolica - sv.pressaoDiastolica) / 3)
      : null);
    let sofaCardio = 0;
    if (sv.vasopressores) sofaCardio = 2;
    else if (pam != null && pam < 70) sofaCardio = 1;

    // Componente 5 — SNC (Glasgow Coma Scale)
    const gcs = sv.glasgow;
    let sofaSNC = 0;
    if (gcs != null) {
      if (gcs < 6) sofaSNC = 4;
      else if (gcs < 10) sofaSNC = 3;
      else if (gcs < 13) sofaSNC = 2;
      else if (gcs < 15) sofaSNC = 1;
    }

    // Componente 6 — Renal (creatinina mg/dL)
    let sofaRenal = 0;
    if (creatinina != null) {
      if (creatinina >= 5) sofaRenal = 4;
      else if (creatinina >= 3.5) sofaRenal = 3;
      else if (creatinina >= 2) sofaRenal = 2;
      else if (creatinina >= 1.2) sofaRenal = 1;
    }

    const sofaTotal = sofaResp + sofaCoag + sofaHep + sofaCardio + sofaSNC + sofaRenal;
    const sofaComponentes = [
      { nome: 'Respiratório (SpO₂)', score: sofaResp, disponivel: spo2 != null },
      { nome: 'Coagulação (plaquetas)', score: sofaCoag, disponivel: plaquetas != null },
      { nome: 'Hepático (bilirrubina)', score: sofaHep, disponivel: bilirrubina != null },
      { nome: 'Cardiovascular (PAM/vasopressores)', score: sofaCardio, disponivel: pam != null },
      { nome: 'SNC (Glasgow)', score: sofaSNC, disponivel: gcs != null },
      { nome: 'Renal (creatinina)', score: sofaRenal, disponivel: creatinina != null },
    ];
    const sofaGravidade = sofaTotal >= 12 ? 'muito_grave' : sofaTotal >= 10 ? 'grave' : sofaTotal >= 7 ? 'moderado' : 'leve';
    const componentesDisponiveis = sofaComponentes.filter(c => c.disponivel).length;

    return {
      qSOFA: {
        score: qsofaScore,
        criterios: qsofaCriterios,
        interpretacao: qsofaScore >= 2 ? 'Suspeita de sépsis — avaliar urgentemente' : qsofaScore === 1 ? 'Baixo risco — monitorizar' : 'Sem critérios',
        risco: qsofaScore >= 2 ? 'alto' : qsofaScore === 1 ? 'moderado' : 'baixo',
      },
      curb65: {
        score: curb65Score,
        criterios: curb65Criterios,
        interpretacao: curb65Score >= 3 ? 'Pneumonia grave — considerar UCI' : curb65Score <= 1 ? 'Pneumonia leve — tratamento ambulatório' : 'Pneumonia moderada — internamento',
        risco: curb65Score >= 3 ? 'alto' : curb65Score <= 1 ? 'baixo' : 'moderado',
        nota: 'Ureia não incluída (requer resultado laboratorial)',
      },
      sofa: {
        score: sofaTotal,
        componentes: sofaComponentes,
        gravidade: sofaGravidade,
        interpretacao: sofaGravidade === 'muito_grave' ? 'Disfunção orgânica muito grave — UCI imediata' :
                       sofaGravidade === 'grave' ? 'Disfunção orgânica grave — UCI urgente' :
                       sofaGravidade === 'moderado' ? 'Disfunção orgânica moderada — vigilância intensiva' :
                       'Disfunção orgânica leve — monitorizar',
        componentesDisponiveis,
        nota: componentesDisponiveis < 4 ? `Apenas ${componentesDisponiveis}/6 componentes com dados (registar Glasgow e aguardar labs)` : undefined,
      },
      ultimoRegisto: sv.data,
      news2Atual: sv.news2,
    };
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
      news2Slope: parseFloat(newsSlope.toFixed(3)),
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

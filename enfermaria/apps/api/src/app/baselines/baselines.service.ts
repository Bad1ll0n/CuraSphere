import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { registarFalha } from '../common/falhas';

const PARAMETROS = ['pulso', 'pressaoSistolica', 'pressaoDiastolica', 'temperatura', 'saturacaoO2', 'frequenciaRespiratoria'] as const;
type Param = typeof PARAMETROS[number];

const CAMPO_MAP: Record<Param, { media: string; sd: string }> = {
  pulso:                  { media: 'fcMedia',            sd: 'fcSd' },
  pressaoSistolica:       { media: 'pasSistolicaMedia',  sd: 'pasSistolicaSd' },
  pressaoDiastolica:      { media: 'pasDiastolicaMedia', sd: 'pasDiastolicaSd' },
  temperatura:            { media: 'tempMedia',          sd: 'tempSd' },
  saturacaoO2:            { media: 'spo2Media',          sd: 'spo2Sd' },
  frequenciaRespiratoria: { media: 'frMedia',            sd: 'frSd' },
};

function calcSD(values: number[]): { media: number; sd: number } {
  const n = values.length;
  const media = values.reduce((a, b) => a + b, 0) / n;
  const variancia = values.reduce((a, b) => a + Math.pow(b - media, 2), 0) / n;
  return { media: Math.round(media * 10) / 10, sd: Math.round(Math.sqrt(variancia) * 10) / 10 };
}

@Injectable()
export class BaselinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  async calcularOuAtualizar(doenteId: string) {
    const registos = await this.prisma.sinalVital.findMany({
      where: { doenteId },
      orderBy: { data: 'desc' },
      take: 20,
      select: { pulso: true, pressaoSistolica: true, pressaoDiastolica: true, temperatura: true, saturacaoO2: true, frequenciaRespiratoria: true },
    });

    if (registos.length < 8) return null;

    const data: Record<string, any> = { doenteId, nRegistos: registos.length, calculadaEm: new Date() };

    for (const param of PARAMETROS) {
      const vals = registos.map((r) => r[param]).filter((v): v is number => v != null);
      if (vals.length >= 4) {
        const { media, sd } = calcSD(vals);
        data[CAMPO_MAP[param].media] = media;
        data[CAMPO_MAP[param].sd] = sd;
      }
    }

    return this.prisma.baselineDoente.upsert({
      where: { doenteId },
      update: data as any,
      create: data as any,
    });
  }

  verificarDesvio(sv: Record<string, number | null | undefined>, baseline: Record<string, number | null>) {
    const desvios: { parametro: string; valor: number; media: number; sd: number; desvios: number }[] = [];

    for (const param of PARAMETROS) {
      const valor = sv[param];
      if (valor == null) continue;
      const media = baseline[CAMPO_MAP[param].media] as number | null;
      const sd = baseline[CAMPO_MAP[param].sd] as number | null;
      if (media == null || sd == null || sd === 0) continue;
      const nDesvios = Math.abs(valor - media) / sd;
      if (nDesvios >= 2) {
        desvios.push({ parametro: param, valor, media, sd, desvios: Math.round(nDesvios * 10) / 10 });
      }
    }
    return desvios;
  }

  async avaliarEAlertar(doenteId: string, sv: Record<string, number | null | undefined>): Promise<void> {
    const baseline = await this.calcularOuAtualizar(doenteId);
    if (!baseline) return;

    const desvios = this.verificarDesvio(sv, baseline as any);
    for (const d of desvios) {
      const nomePretty: Record<string, string> = {
        pulso: 'FC', pressaoSistolica: 'PAS', pressaoDiastolica: 'PAD',
        temperatura: 'Temp', saturacaoO2: 'SpO2', frequenciaRespiratoria: 'FR',
      };
      await this.alertas.criarAlerta(
        doenteId,
        'desvio_baseline',
        `📊 ${nomePretty[d.parametro] ?? d.parametro}: ${d.valor} (baseline ${d.media} ± ${d.sd}) — ${d.desvios} DP`,
      ).catch(registarFalha('alerta:desvio-baseline', 'erro'));
    }
  }

  buscar(doenteId: string) {
    return this.prisma.baselineDoente.findUnique({ where: { doenteId } });
  }

  async calcularRisco(doenteId: string): Promise<{ score: number; banda: 'verde' | 'ambar' | 'vermelho'; factores: string[] }> {
    const dados = await this.dadosDeRisco([doenteId]);
    return this.pontuarRisco(dados.get(doenteId)!);
  }

  /**
   * ARQ-23 — os dados do risco de VÁRIOS doentes em 4 consultas (era ~5 por doente, mais uma
   * para o último sinal vital). Os 3 últimos sinais vitais de cada doente numa só query (janela).
   */
  private async dadosDeRisco(doenteIds: string[]) {
    const [sinais, sepsis, sinalizacoes, baselines] = await Promise.all([
      doenteIds.length
        ? this.prisma.$queryRaw<any[]>`
            SELECT "doenteId", news2, data, pulso, "pressaoSistolica", "pressaoDiastolica", temperatura, "saturacaoO2", "frequenciaRespiratoria"
            FROM (SELECT sv.*, row_number() OVER (PARTITION BY "doenteId" ORDER BY data DESC) AS ordem
                  FROM sinais_vitais sv WHERE "doenteId" = ANY(${doenteIds}::text[])) t
            WHERE ordem <= 3 ORDER BY "doenteId", data DESC`
        : [],
      this.prisma.alertaSepsis.findMany({ where: { doenteId: { in: doenteIds }, resolvido: false }, select: { doenteId: true } }),
      this.prisma.sinalizacaoPreocupante.findMany({ where: { doenteId: { in: doenteIds }, resolvida: false }, select: { doenteId: true, nivelUrgencia: true } }),
      this.prisma.baselineDoente.findMany({ where: { doenteId: { in: doenteIds } } }),
    ]);
    const porDoente = new Map(doenteIds.map((id) => [id, { ultimosSV: [] as any[], sepsis: false, sinalizacoes: [] as { nivelUrgencia: string | null }[], baseline: null as any }]));
    for (const s of sinais) porDoente.get(s.doenteId)?.ultimosSV.push(s);
    for (const a of sepsis) { const d = porDoente.get(a.doenteId); if (d) d.sepsis = true; }
    for (const s of sinalizacoes) porDoente.get(s.doenteId)?.sinalizacoes.push(s);
    for (const b of baselines) { const d = porDoente.get(b.doenteId); if (d) d.baseline = b; }
    return porDoente;
  }

  private pontuarRisco({ ultimosSV, sepsis, sinalizacoes, baseline }: { ultimosSV: any[]; sepsis: boolean; sinalizacoes: { nivelUrgencia: string | null }[]; baseline: any }):
    { score: number; banda: 'verde' | 'ambar' | 'vermelho'; factores: string[] } {
    let score = 0;
    const factores: string[] = [];
    const news2Actual = ultimosSV[0]?.news2 ?? null;

    // NEWS2 actual
    if (news2Actual != null) {
      if (news2Actual >= 7) { score += 50; factores.push(`NEWS2 crítico (${news2Actual})`); }
      else if (news2Actual >= 5) { score += 35; factores.push(`NEWS2 alto (${news2Actual})`); }
      else if (news2Actual >= 1) { score += 15; factores.push(`NEWS2 ${news2Actual}`); }
    }

    // Tendência NEWS2 (últimas 3 leituras)
    if (ultimosSV.length >= 3) {
      const [n1, , n3] = ultimosSV.map(s => s.news2 ?? 0);
      if (n1 > n3) { score += 20; factores.push('NEWS2 em subida'); }
      else if (n1 < n3) { score -= 5; }
    }

    // AlertaSepsis activo
    if (sepsis) { score += 30; factores.push('Alerta sépsis activo'); }

    // Sinalizações
    const urgente = sinalizacoes.some(s => s.nivelUrgencia === 'urgente');
    if (urgente) { score += 25; factores.push('Sinalizado urgente'); }
    else if (sinalizacoes.length > 0) { score += 10; factores.push('Sinalizado preocupante'); }

    // Desvios de baseline
    if (baseline) {
      const svAtual = ultimosSV[0] as any;
      if (svAtual) {
        const sv: Record<string, number | null | undefined> = {
          pulso: svAtual.pulso, pressaoSistolica: svAtual.pressaoSistolica,
          pressaoDiastolica: svAtual.pressaoDiastolica, temperatura: svAtual.temperatura,
          saturacaoO2: svAtual.saturacaoO2, frequenciaRespiratoria: svAtual.frequenciaRespiratoria,
        };
        const desvios = this.verificarDesvio(sv, baseline as any);
        const nDesvios = Math.min(desvios.length, 4);
        if (nDesvios > 0) { score += nDesvios * 10; factores.push(`${nDesvios} desvio(s) de baseline`); }
      }
    }

    // Tempo desde último SV
    if (ultimosSV[0]) {
      const horasDesde = (Date.now() - new Date(ultimosSV[0].data).getTime()) / 3_600_000;
      if (horasDesde > 24) { score += 25; factores.push('Sem SV há >24h'); }
      else if (horasDesde > 8) { score += 15; factores.push('Sem SV há >8h'); }
    } else {
      score += 25;
      factores.push('Sem registos de SV');
    }

    const scoreFinal = Math.max(0, Math.min(100, score));
    const banda = scoreFinal >= 60 ? 'vermelho' : scoreFinal >= 30 ? 'ambar' : 'verde';
    return { score: scoreFinal, banda, factores };
  }

  async calcularRiscoTurno(servico: string): Promise<{ doenteId: string; nome: string; cama: string; score: number; banda: 'verde' | 'ambar' | 'vermelho'; factores: string[]; ultimoSV: Date | null }[]> {
    const doentes = await this.prisma.doente.findMany({
      where: { ativo: true } as any,
      select: { id: true, nome: true, cama: { select: { numero: true } } },
      orderBy: { cama: { numero: 'asc' } },
    });

    // ARQ-23: 4 consultas para todos (eram ~6 por doente, todas em paralelo).
    const dados = await this.dadosDeRisco(doentes.map((d) => d.id));
    const resultados = doentes.map((d) => {
      const dd = dados.get(d.id)!;
      return { doenteId: d.id, nome: d.nome, cama: d.cama?.numero ?? '?', ...this.pontuarRisco(dd), ultimoSV: dd.ultimosSV[0]?.data ?? null };
    });

    return resultados.sort((a, b) => b.score - a.score);
  }
}

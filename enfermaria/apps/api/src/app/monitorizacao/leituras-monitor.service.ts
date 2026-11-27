import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { SinaisVitaisService, detetar } from '../sinais-vitais/sinais-vitais.service';
import { janelaRegistoDiferidoMs, resolverHoraDoAto } from '../common/hora-do-ato';

/** Os parâmetros que um monitor pode enviar — os mesmos nomes do SinalVital. */
export const PARAMETROS_MONITOR = [
  'pressaoSistolica', 'pressaoDiastolica', 'pulso', 'temperatura', 'saturacaoO2', 'frequenciaRespiratoria', 'avpu',
] as const;

export interface LeituraRecebida {
  dispositivoId: string;
  canal: 'monitor' | 'fhir';
  doenteId: string;
  valores: Record<string, unknown>;
  medidoEm?: string;
}

/**
 * PROD-15 — leituras dos monitores à espera de validação de enfermagem.
 *
 * Antes, cada leitura entrava direto nos sinais vitais: um sensor de SpO₂ solto ou uma pressão
 * medida com o doente em movimento ficavam gravados como verdade, calculavam NEWS2 e disparavam
 * alertas — em nome do responsável administrativo do dispositivo, que não a tinha feito. O padrão
 * dos sistemas de monitorização integrados é outro: a leitura fica pendente, o enfermeiro valida
 * (ou rejeita como artefacto) em lote, e só então entra no processo, com ele como autor.
 *
 * As duas vias de ingestão (`/monitorizacao/ingerir` e `/fhir/Observation`) passam por aqui.
 * Um valor crítico não espera pela validação: alerta logo, a pedir confirmação à cabeceira.
 */
@Injectable()
export class LeiturasMonitorService {
  private readonly logger = new Logger(LeiturasMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sinaisVitais: SinaisVitaisService,
    private readonly alertas: AlertasService,
  ) {}

  /**
   * O doente de uma leitura vem do dispositivo — de quem ocupa a cama a que está ligado, ou do
   * doente a que foi associado — nunca do payload. Se o payload nomear outro doente, é erro de
   * configuração à cabeceira, e recusa-se.
   */
  async doenteDoDispositivo(disp: { doenteId: string | null; camaId?: string | null }, doenteNoPayload?: string): Promise<string> {
    let doenteId = disp.doenteId;
    if (disp.camaId) {
      const ocupante = await this.prisma.doente.findFirst({ where: { camaId: disp.camaId, ativo: true }, select: { id: true } });
      if (!ocupante) throw new BadRequestException('A cama a que o dispositivo está ligado não tem doente internado');
      doenteId = ocupante.id;
    }
    if (!doenteId) throw new BadRequestException('Dispositivo sem cama nem doente associado — associe-o antes de enviar leituras');
    if (doenteNoPayload && doenteNoPayload !== doenteId) {
      throw new BadRequestException('A leitura refere um doente diferente daquele a que o dispositivo está associado');
    }
    return doenteId;
  }

  async receber(l: LeituraRecebida) {
    const medidoEm = resolverHoraDoAto(l.medidoEm);
    const valores: Record<string, number | string> = {};
    for (const p of PARAMETROS_MONITOR) {
      const v = l.valores[p];
      if (p === 'avpu' ? typeof v === 'string' : typeof v === 'number' && Number.isFinite(v)) valores[p] = v as number | string;
    }
    if (Object.keys(valores).length === 0) throw new BadRequestException('Leitura sem parâmetros reconhecidos');

    const criticos = detetar(valores as any);
    const leitura = await this.prisma.leituraMonitor.create({
      data: { doenteId: l.doenteId, dispositivoId: l.dispositivoId, canal: l.canal, medidoEm, valores, critica: criticos.length > 0 },
    });
    if (criticos.length) {
      // Pode ser artefacto — mas não se espera pela validação para alguém ir ver.
      const msg = `Leitura do monitor por validar com valor crítico: ${criticos.map((c) => c.mensagem).join('; ')}. Confirmar à cabeceira (pode ser artefacto) e validar ou rejeitar.`;
      await this.alertas.criarAlerta(l.doenteId, 'leitura_monitor_critica', msg, 3).catch((e) => this.logger.error('alerta de leitura crítica falhou', e?.message));
    }
    return leitura;
  }

  /** Pendentes dentro da janela de registo diferido (as mais antigas já não se podem validar). */
  pendentes(doenteId: string) {
    return this.prisma.leituraMonitor.findMany({
      where: { doenteId, estado: 'pendente', medidoEm: { gte: new Date(Date.now() - janelaRegistoDiferidoMs()) } },
      orderBy: { medidoEm: 'desc' },
      take: 200,
      select: { id: true, dispositivoId: true, canal: true, medidoEm: true, recebidaEm: true, valores: true, critica: true },
    });
  }

  /**
   * Valida em lote: cada leitura passa a sinal vital (NEWS2, tendência, alertas) com o enfermeiro
   * como autor. Da mais recente para a mais antiga — as anteriores a um registo já existente não
   * repetem alertas (ver o registo diferido em SinaisVitaisService).
   */
  async validar(doenteId: string, ids: string[], utilizadorId: string) {
    const leituras = await this.prisma.leituraMonitor.findMany({
      where: { id: { in: ids }, doenteId, estado: 'pendente' },
      orderBy: { medidoEm: 'desc' },
    });
    const validadas: string[] = [];
    const falhas: { id: string; motivo: string }[] = [];
    for (const l of leituras) {
      // Reclamar a leitura primeiro: dois enfermeiros a validar o mesmo lote não a duplicam.
      const reclamada = await this.prisma.leituraMonitor.updateMany({
        where: { id: l.id, estado: 'pendente' },
        data: { estado: 'validada', validadaPorId: utilizadorId, validadaEm: new Date() },
      });
      if (reclamada.count === 0) continue;
      try {
        const sinal = await this.sinaisVitais.ingerirDeMonitor(
          doenteId, utilizadorId, { ...(l.valores as Record<string, any>), medidoEm: l.medidoEm.toISOString() }, l.dispositivoId,
        );
        await this.prisma.leituraMonitor.update({ where: { id: l.id }, data: { sinalVitalId: sinal.id } });
        validadas.push(l.id);
      } catch (e: any) {
        await this.prisma.leituraMonitor.update({ where: { id: l.id }, data: { estado: 'pendente', validadaPorId: null, validadaEm: null } });
        falhas.push({ id: l.id, motivo: e?.response?.message ?? e?.message ?? 'erro' });
      }
    }
    return { validadas: validadas.length, falhas };
  }

  /** Rejeitar como artefacto (sensor solto, doente em movimento…). Fica registado quem e porquê. */
  async rejeitar(doenteId: string, ids: string[], utilizadorId: string, motivo: string) {
    const r = await this.prisma.leituraMonitor.updateMany({
      where: { id: { in: ids }, doenteId, estado: 'pendente' },
      data: { estado: 'rejeitada', validadaPorId: utilizadorId, validadaEm: new Date(), motivoRejeicao: motivo.trim().slice(0, 500) },
    });
    return { rejeitadas: r.count };
  }
}

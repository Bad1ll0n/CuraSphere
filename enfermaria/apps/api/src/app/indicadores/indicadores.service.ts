import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { celulaCsv } from '../common/csv';
import {
  DEFINICOES, DISPOSITIVOS_VIGIADOS, H48, diasInternamento, mediana, percentagem, por1000, reinternamentos, sobreposicao, turnosCompletos,
  type Definicao, type EpisodioBase,
} from './indicadores.definicoes';

export interface Caso { doenteId: string; nome: string; numeroProcesso: string; quando: Date | null; detalhe: string }
export interface ResultadoIndicador extends Definicao { valor: number | null; numeradorValor: number; denominadorValor: number; casos?: Caso[] }

const DIA = 86_400_000;

/**
 * PROD-18 — cálculo dos indicadores para um período e (opcionalmente) um serviço.
 * O serviço é o do episódio de internamento. Cada indicador devolve o valor, o numerador e o
 * denominador, e — no drill-down — os doentes que contaram no numerador.
 */
@Injectable()
export class IndicadoresService {
  constructor(private readonly prisma: PrismaService) {}

  private periodo(inicio?: string, fim?: string) {
    const f = fim ? new Date(`${fim}T00:00:00.000Z`) : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const i = inicio ? new Date(`${inicio}T00:00:00.000Z`) : new Date(f.getTime() - 30 * DIA);
    if (Number.isNaN(i.getTime()) || Number.isNaN(f.getTime()) || i >= f) throw new BadRequestException('Período inválido (inicio < fim, AAAA-MM-DD).');
    if (f.getTime() - i.getTime() > 366 * DIA) throw new BadRequestException('O período máximo é de um ano.');
    return { inicio: i, fim: f };
  }

  private async episodios(inicio: Date, fim: Date, servico?: string): Promise<(EpisodioBase & { servico: string | null; episodioUrgenciaId: string | null })[]> {
    return this.prisma.episodioInternamento.findMany({
      // Os que se sobrepõem ao período, e os seguintes do mesmo doente até 30 dias depois (reinternamento).
      where: { dataAdmissao: { lt: new Date(fim.getTime() + 31 * DIA) }, OR: [{ dataAlta: null }, { dataAlta: { gte: inicio } }], ...(servico ? { servico } : {}) },
      select: { id: true, doenteId: true, dataAdmissao: true, dataAlta: true, motivoAlta: true, numero: true, servico: true, episodioUrgenciaId: true },
    });
  }

  private async doentes(ids: string[]) {
    const ds = await this.prisma.doente.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, nome: true, numeroProcesso: true } });
    return new Map(ds.map((d) => [d.id, d]));
  }

  /** Todos os indicadores do período (sem casos) ou um só, com os casos (drill-down). */
  async calcular(q: { inicio?: string; fim?: string; servico?: string; codigo?: string }) {
    const { inicio, fim } = this.periodo(q.inicio, q.fim);
    const todos = await this.episodios(inicio, fim, q.servico || undefined);
    const noPeriodo = todos.filter((e) => sobreposicao(e.dataAdmissao, e.dataAlta, inicio, fim) > 0);
    const dias = diasInternamento(noPeriodo, inicio, fim);
    const ids = [...new Set(noPeriodo.map((e) => e.doenteId))];
    const dentro = (doenteId: string, quando: Date) => noPeriodo.find((e) => e.doenteId === doenteId && quando >= e.dataAdmissao && (!e.dataAlta || quando < e.dataAlta) && quando >= inicio && quando < fim);

    const codigos = q.codigo ? [q.codigo] : DEFINICOES.map((d) => d.codigo);
    if (q.codigo && !DEFINICOES.some((d) => d.codigo === q.codigo)) throw new BadRequestException('Indicador desconhecido');
    const resultados: ResultadoIndicador[] = [];
    const def = (c: string) => DEFINICOES.find((d) => d.codigo === c)!;
    const casosDe = async (lista: { doenteId: string; quando: Date | null; detalhe: string }[]) => {
      if (!q.codigo) return undefined;
      const mapa = await this.doentes(lista.map((c) => c.doenteId));
      return lista.map((c) => ({ ...c, nome: mapa.get(c.doenteId)?.nome ?? '—', numeroProcesso: mapa.get(c.doenteId)?.numeroProcesso ?? '—' }));
    };

    for (const codigo of codigos) {
      if (codigo === 'quedas') {
        const ev = await this.prisma.eventoAdverso.findMany({ where: { tipo: 'queda', doenteId: { in: ids }, ocorridoEm: { gte: inicio, lt: fim } }, select: { doenteId: true, ocorridoEm: true, gravidade: true } });
        const conta = ev.filter((e) => e.doenteId && dentro(e.doenteId, e.ocorridoEm));
        resultados.push({ ...def(codigo), valor: por1000(conta.length, dias), numeradorValor: conta.length, denominadorValor: Math.round(dias * 10) / 10,
          casos: await casosDe(conta.map((e) => ({ doenteId: e.doenteId!, quando: e.ocorridoEm, detalhe: `gravidade: ${e.gravidade}` }))) });
      } else if (codigo === 'upp_adquiridas') {
        const feridas = await this.prisma.avaliacaoFerida.findMany({ where: { tipo: 'ulcera_pressao', doenteId: { in: ids }, deletedAt: null }, orderBy: { criadaEm: 'asc' }, select: { doenteId: true, localizacao: true, criadaEm: true } });
        const vistas = new Set<string>();
        const novas: typeof feridas = [];
        for (const f of feridas) {
          const ep = noPeriodo.find((e) => e.doenteId === f.doenteId && f.criadaEm >= e.dataAdmissao && (!e.dataAlta || f.criadaEm < e.dataAlta));
          const chave = `${ep?.id}|${f.localizacao.trim().toLowerCase()}`;
          if (!ep || vistas.has(chave)) continue;
          vistas.add(chave);
          if (f.criadaEm.getTime() - ep.dataAdmissao.getTime() > DIA && f.criadaEm >= inicio && f.criadaEm < fim) novas.push(f);
        }
        resultados.push({ ...def(codigo), valor: por1000(novas.length, dias), numeradorValor: novas.length, denominadorValor: Math.round(dias * 10) / 10,
          casos: await casosDe(novas.map((f) => ({ doenteId: f.doenteId, quando: f.criadaEm, detalhe: f.localizacao }))) });
      } else if (codigo === 'avaliacao_risco_24h') {
        // Ainda internado: conta até agora (ou até ao fim do período, se for depois).
        const ate = (e: EpisodioBase) => (e.dataAlta ?? new Date(Math.max(Date.now(), fim.getTime()))).getTime();
        const elegiveis = noPeriodo.filter((e) => e.dataAdmissao >= inicio && e.dataAdmissao < fim && ate(e) - e.dataAdmissao.getTime() >= DIA);
        const av = await this.prisma.avaliacaoRisco.findMany({ where: { doenteId: { in: elegiveis.map((e) => e.doenteId) }, tipo: { in: ['morse', 'braden'] } }, select: { doenteId: true, tipo: true, criadaEm: true } });
        const feito = (e: EpisodioBase, tipo: string) => av.some((a) => a.doenteId === e.doenteId && a.tipo === tipo && a.criadaEm >= e.dataAdmissao && a.criadaEm.getTime() - e.dataAdmissao.getTime() <= DIA);
        const cumprem = elegiveis.filter((e) => feito(e, 'morse') && feito(e, 'braden'));
        const falham = elegiveis.filter((e) => !cumprem.includes(e));
        resultados.push({ ...def(codigo), valor: percentagem(cumprem.length, elegiveis.length), numeradorValor: cumprem.length, denominadorValor: elegiveis.length,
          // No drill-down de um indicador "alto é melhor" mostram-se os que FALHARAM — é aí que se age.
          casos: await casosDe(falham.map((e) => ({ doenteId: e.doenteId, quando: e.dataAdmissao, detalhe: `${feito(e, 'morse') ? '' : 'sem Morse '}${feito(e, 'braden') ? '' : 'sem Braden'}`.trim() }))) });
      } else if (codigo === 'dor_por_turno') {
        const fimDor = new Date(Math.min(fim.getTime(), inicio.getTime() + 31 * DIA));
        const turnos = noPeriodo.flatMap((e) => turnosCompletos(e, inicio, fimDor).map(([a, b]) => ({ doenteId: e.doenteId, a, b })));
        const sv = await this.prisma.sinalVital.findMany({ where: { doenteId: { in: ids }, dor: { not: null }, data: { gte: inicio, lt: fimDor } }, select: { doenteId: true, data: true } });
        const comDor = turnos.filter((t) => sv.some((s) => s.doenteId === t.doenteId && s.data >= t.a && s.data < t.b));
        const sem = turnos.filter((t) => !comDor.includes(t));
        resultados.push({ ...def(codigo), valor: percentagem(comDor.length, turnos.length), numeradorValor: comDor.length, denominadorValor: turnos.length,
          casos: await casosDe(sem.slice(0, 500).map((t) => ({ doenteId: t.doenteId, quando: t.a, detalhe: 'turno sem avaliação da dor' }))) });
      } else if (codigo === 'infecao_dispositivo') {
        const disp = await this.prisma.dispositivoInvasivo.findMany({ where: { doenteId: { in: ids }, tipo: { in: DISPOSITIVOS_VIGIADOS as any }, dataInsercao: { lt: fim }, OR: [{ dataRemocao: null }, { dataRemocao: { gte: inicio } }] }, select: { doenteId: true, tipo: true, dataInsercao: true, dataRemocao: true } });
        const diasDisp = disp.reduce((t, d) => t + sobreposicao(d.dataInsercao, d.dataRemocao, inicio, fim), 0) / DIA;
        const culturas = await this.prisma.culturaMicrobiologica.findMany({ where: { doenteId: { in: ids }, resultado: 'positivo', dataColheita: { gte: inicio, lt: fim } }, select: { doenteId: true, dataColheita: true, agente: true, tipoAmostra: true } });
        const associadas = culturas.filter((c) => disp.some((d) => d.doenteId === c.doenteId && c.dataColheita.getTime() - d.dataInsercao.getTime() > H48 && (!d.dataRemocao || c.dataColheita <= d.dataRemocao)));
        resultados.push({ ...def(codigo), valor: por1000(associadas.length, diasDisp), numeradorValor: associadas.length, denominadorValor: Math.round(diasDisp * 10) / 10,
          casos: await casosDe(associadas.map((c) => ({ doenteId: c.doenteId, quando: c.dataColheita, detalhe: `${c.tipoAmostra}${c.agente ? ` — ${c.agente}` : ''}` }))) });
      } else if (codigo === 'reinternamento_30d') {
        const { altas, casos } = reinternamentos(todos, inicio, fim);
        resultados.push({ ...def(codigo), valor: percentagem(casos.length, altas.length), numeradorValor: casos.length, denominadorValor: altas.length,
          casos: await casosDe(casos.map((a) => ({ doenteId: a.doenteId, quando: a.dataAlta, detalhe: 'reinternado até 30 dias' }))) });
      } else if (codigo === 'tempo_urgencia_cama') {
        const deUrgencia = noPeriodo.filter((e) => e.episodioUrgenciaId && e.dataAdmissao >= inicio && e.dataAdmissao < fim);
        const urg = await this.prisma.episodioUrgencia.findMany({ where: { id: { in: deUrgencia.map((e) => e.episodioUrgenciaId!) } }, select: { id: true, dataEntrada: true } });
        const tempos = deUrgencia.flatMap((e) => {
          const u = urg.find((x) => x.id === e.episodioUrgenciaId);
          return u ? [{ e, min: Math.round((e.dataAdmissao.getTime() - u.dataEntrada.getTime()) / 60_000) }] : [];
        }).filter((t) => t.min >= 0);
        resultados.push({ ...def(codigo), valor: mediana(tempos.map((t) => t.min)), numeradorValor: tempos.length, denominadorValor: tempos.length,
          casos: await casosDe(tempos.sort((a, b) => b.min - a.min).map((t) => ({ doenteId: t.e.doenteId, quando: t.e.dataAdmissao, detalhe: `${t.min} min` }))) });
      }
    }
    return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10), servico: q.servico || null, diasInternamento: Math.round(dias * 10) / 10, indicadores: resultados };
  }

  /** CSV (separador ;, para o Excel em pt-PT) — o resumo, ou os casos de um indicador. */
  async exportarCsv(q: { inicio?: string; fim?: string; servico?: string; codigo?: string }): Promise<string> {
    const r = await this.calcular(q);
    const esc = (v: unknown) => celulaCsv(v, ';'); // SEC-15: sem injeção de fórmulas
    const linhas: unknown[][] = q.codigo
      ? [['indicador', 'versao', 'processo', 'doente', 'quando', 'detalhe'], ...(r.indicadores[0].casos ?? []).map((c) => [r.indicadores[0].codigo, r.indicadores[0].versao, c.numeroProcesso, c.nome, c.quando?.toISOString() ?? '', c.detalhe])]
      : [['indicador', 'versao', 'nome', 'valor', 'unidade', 'numerador', 'denominador', 'inicio', 'fim', 'servico'],
        ...r.indicadores.map((i) => [i.codigo, i.versao, i.nome, i.valor, i.unidade, i.numeradorValor, i.denominadorValor, r.inicio, r.fim, r.servico ?? 'todos'])];
    return '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { tomasPorDia } from '../medicacao/limites-dose';
import { turnoDe } from '../passagem-isbar/passagem-isbar.service';
import { PARAMETROS_REFERENCIA, calcularDotacao, categoriaDependencia, validarParametros, type Parametros, type Turno } from './dotacoes.regras';

/**
 * PROD-17 — dotação segura por serviço e turno: horas de cuidados necessárias (dependência dos
 * doentes) vs disponíveis (enfermeiros escalados), com semáforo e histórico.
 */
@Injectable()
export class DotacoesService {
  private readonly logger = new Logger(DotacoesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async parametros(servico: string): Promise<Parametros & { servico: string; personalizados: boolean }> {
    const p = await this.prisma.parametroDotacao.findUnique({ where: { servico } });
    if (!p) return { servico, personalizados: false, ...PARAMETROS_REFERENCIA };
    return {
      servico, personalizados: true,
      horasPorCategoria: p.horasPorCategoria as any, distribuicaoTurno: p.distribuicaoTurno as any,
      horasEfetivasTurno: p.horasEfetivasTurno, minimos: p.minimos as any,
      horasSemanaisMax: p.horasSemanaisMax, competenciaObrigatoria: p.competenciaObrigatoria,
    };
  }

  async guardarParametros(servico: string, utilizadorId: string, dto: Parametros) {
    const erros = validarParametros(dto);
    if (erros.length) throw new BadRequestException(erros.join(' '));
    const dados = {
      horasPorCategoria: dto.horasPorCategoria, distribuicaoTurno: dto.distribuicaoTurno, horasEfetivasTurno: dto.horasEfetivasTurno,
      minimos: dto.minimos, horasSemanaisMax: dto.horasSemanaisMax, competenciaObrigatoria: dto.competenciaObrigatoria || null, atualizadoPorId: utilizadorId,
    };
    await this.prisma.parametroDotacao.upsert({ where: { servico }, create: { servico, ...dados }, update: dados });
    return this.parametros(servico);
  }

  /** Serviços com camas (os nomes que a gestão de camas usa). */
  async servicos(): Promise<string[]> {
    const r = await this.prisma.cama.findMany({ where: { servico: { not: null } }, distinct: ['servico'], select: { servico: true }, orderBy: { servico: 'asc' } });
    return r.map((x) => x.servico!).filter(Boolean);
  }

  /** Dependência dos doentes internados no serviço, com o que levou a cada categoria. */
  async doentesDoServico(servico: string) {
    const doentes = await this.prisma.doente.findMany({
      where: { ativo: true, estadoRegisto: 'internado', cama: { servico } },
      select: { id: true, nome: true, cama: { select: { numero: true } } },
    });
    const ids = doentes.map((d) => d.id);
    const [barthel, vitais, intervencoes] = await Promise.all([
      this.prisma.escalaClinica.findMany({ where: { doenteId: { in: ids }, tipo: 'Barthel' }, orderBy: { registadaEm: 'desc' }, select: { doenteId: true, pontuacao: true } }),
      this.prisma.sinalVital.findMany({ where: { doenteId: { in: ids }, news2: { not: null } }, orderBy: { data: 'desc' }, distinct: ['doenteId'], select: { doenteId: true, news2: true } }),
      this.prisma.intervencaoEnfermagem.findMany({ where: { doenteId: { in: ids }, estado: 'ativa', diagnostico: { estado: 'ativo' } }, select: { doenteId: true, frequencia: true } }),
    ]);
    const primeiro = new Map<string, number | null>();
    for (const b of barthel) if (!primeiro.has(b.doenteId)) primeiro.set(b.doenteId, b.pontuacao);
    return doentes.map((d) => {
      const intervencoesDia = intervencoes.filter((i) => i.doenteId === d.id).reduce((t, i) => t + (tomasPorDia(i.frequencia) ?? 1), 0);
      const dados = { barthel: primeiro.get(d.id) ?? null, news2: vitais.find((v) => v.doenteId === d.id)?.news2 ?? null, intervencoesDia };
      return { doenteId: d.id, nome: d.nome, cama: d.cama?.numero ?? null, ...dados, categoria: categoriaDependencia(dados) };
    });
  }

  /** Enfermeiros escalados no serviço (escala do serviço; se não houver, a geral) para o dia e turno. */
  async enfermeirosEscalados(servico: string, data: string, turno: Turno): Promise<number> {
    const dia = new Date(`${data}T00:00:00.000Z`);
    const [ano, mes] = [dia.getUTCFullYear(), dia.getUTCMonth() + 1];
    for (const s of [servico, '']) {
      const turnoEscala = await this.prisma.horarioTurno.findFirst({
        where: { tipo: turno as any, data: dia, escala: { mes, ano, servico: s } },
        select: { profissionais: { select: { utilizador: { select: { role: true, unidade: true } } } } },
      });
      if (turnoEscala) {
        return turnoEscala.profissionais.filter((p) => p.utilizador.role === 'enfermeiro' && (s !== '' || !p.utilizador.unidade || p.utilizador.unidade === servico)).length;
      }
    }
    return 0;
  }

  async calcular(servico: string, quando?: { data: string; turno: Turno }) {
    const { data, turno } = quando ?? (turnoDe() as { data: string; turno: Turno });
    const [p, doentes] = await Promise.all([this.parametros(servico), this.doentesDoServico(servico)]);
    const enfermeiros = await this.enfermeirosEscalados(servico, data, turno);
    return { servico, data, turno, ...calcularDotacao(doentes.map((d) => d.categoria), enfermeiros, turno, p), parametrosPersonalizados: p.personalizados, detalhe: doentes };
  }

  async registar(servico: string, quando?: { data: string; turno: Turno }) {
    const r = await this.calcular(servico, quando);
    const dados = {
      doentes: r.doentes, porCategoria: r.porCategoria, horasNecessarias: r.horasNecessarias, horasDisponiveis: r.horasDisponiveis,
      enfermeiros: r.enfermeiros, racio: r.racio, semaforo: r.semaforo, calculadoEm: new Date(),
    };
    await this.prisma.registoDotacao.upsert({
      where: { servico_data_turno: { servico, data: r.data, turno: r.turno } },
      create: { servico, data: r.data, turno: r.turno, ...dados },
      update: dados,
    });
    return r;
  }

  /** De hora a hora, a fotografia do turno em curso em cada serviço (a última do turno fica). */
  @Cron('5 * * * *')
  async cronRegistar(): Promise<void> {
    if (!(await this.prisma.tryBecomeLeader('dotacoes-registo', 50 * 60_000))) return;
    for (const s of await this.servicos()) {
      await this.registar(s).catch((e) => this.logger.warn(`Dotação de ${s} falhou: ${e?.message}`));
    }
  }

  async historico(servico: string, dias = 14) {
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
    return this.prisma.registoDotacao.findMany({
      where: { servico, data: { gte: desde } },
      orderBy: [{ data: 'desc' }, { turno: 'asc' }],
      select: { data: true, turno: true, doentes: true, porCategoria: true, horasNecessarias: true, horasDisponiveis: true, enfermeiros: true, racio: true, semaforo: true },
    });
  }

  /** O turno em curso em todos os serviços (painel da direção / chefia). */
  async resumo() {
    const servicos = await this.servicos();
    const linhas = [];
    for (const s of servicos) {
      const { detalhe: _d, ...r } = await this.calcular(s);
      linhas.push(r);
    }
    return linhas;
  }
}

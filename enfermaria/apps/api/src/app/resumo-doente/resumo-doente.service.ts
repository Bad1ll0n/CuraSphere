import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VigilanciaService } from '../vigilancia/vigilancia.service';
import { classificarTomas, tomasPlaneadas } from '../medicacao/posologia';

const idadeDe = (d: Date | null) => (d ? Math.floor((Date.now() - d.getTime()) / (365.25 * 86_400_000)) : null);
const tendencia = (atual: number | null | undefined, anterior: number | null | undefined) =>
  atual == null || anterior == null ? null : atual > anterior ? 'sobe' : atual < anterior ? 'desce' : 'igual';

/**
 * UX-29 / UX-30 — o doente "num relance" e o turno do enfermeiro num só ecrã.
 * Agrega o que estava espalhado por 27 painéis (alergias, NEWS2, isolamento, risco de queda,
 * DNR, sinalizações) e, para "O meu turno", a medicação devida, os vitais em atraso e as tarefas.
 */
@Injectable()
export class ResumoDoenteService {
  constructor(private readonly prisma: PrismaService, private readonly vigilancia: VigilanciaService) {}

  /** Faixa de identificação (sticky) da ficha e dos modais clínicos. */
  async faixa(doenteId: string) {
    const d = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        id: true, nome: true, numeroProcesso: true, dataNascimento: true, sexo: true, estado: true,
        pesoReferenciaKg: true, emIsolamento: true, motivoIsolamento: true, avaliacaoAlergias: true,
        decisaoNaoReanimar: true, decisaoNaoReanimarEm: true,
        cama: { select: { numero: true, quarto: true, servico: true } },
        alergias: { where: { deletedAt: null }, select: { alergenio: true, severidade: true }, orderBy: { severidade: 'asc' } },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 2, select: { news2: true, data: true } },
        avaliacoesRisco: { orderBy: { criadaEm: 'desc' }, take: 6, select: { tipo: true, risco: true, pontuacao: true } },
        sinalizacoes: { where: { resolvida: false }, select: { motivo: true, nivelUrgencia: true }, take: 3 },
      },
    });
    if (!d) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const [sv, svAnt] = d.sinaisVitais;
    const morse = d.avaliacoesRisco.find((r) => r.tipo === 'morse');
    const braden = d.avaliacoesRisco.find((r) => r.tipo === 'braden');
    const resumoAlergias = { estado: d.avaliacaoAlergias, lista: d.alergias };
    return {
      id: d.id, nome: d.nome, numeroProcesso: d.numeroProcesso, idade: idadeDe(d.dataNascimento), dataNascimento: d.dataNascimento,
      sexo: d.sexo, estado: d.estado, cama: d.cama, pesoKg: d.pesoReferenciaKg,
      alergias: resumoAlergias,
      isolamento: d.emIsolamento ? (d.motivoIsolamento ?? 'sim') : null,
      naoReanimar: d.decisaoNaoReanimar ? { em: d.decisaoNaoReanimarEm } : null,
      riscoQueda: morse ? { risco: morse.risco, pontuacao: morse.pontuacao } : null,
      riscoUlcera: braden ? { risco: braden.risco, pontuacao: braden.pontuacao } : null,
      news2: sv ? { valor: sv.news2, em: sv.data, tendencia: tendencia(sv.news2, svAnt?.news2) } : null,
      sinalizacoes: d.sinalizacoes,
    };
  }

  /** UX-29: DNR só pelo médico, com nota; desactivar também fica registado. */
  async definirNaoReanimar(doenteId: string, medicoId: string, dto: { ativo: boolean; notas?: string }) {
    const notas = dto.notas?.trim();
    if (dto.ativo && (!notas || notas.length < 10)) {
      throw new BadRequestException('Registe a fundamentação da decisão de não reanimar (mínimo 10 caracteres).');
    }
    const d = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!d) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    return this.prisma.doente.update({
      where: { id: doenteId },
      data: { decisaoNaoReanimar: dto.ativo, decisaoNaoReanimarEm: new Date(), decisaoNaoReanimarPorId: medicoId, decisaoNaoReanimarNotas: notas ?? null },
      select: { id: true, decisaoNaoReanimar: true, decisaoNaoReanimarEm: true, decisaoNaoReanimarNotas: true },
    });
  }

  /** Doentes atribuídos ao utilizador no turno em curso (atribuição de turno e de horário). */
  private async meusDoentes(utilizadorId: string): Promise<string[]> {
    const agora = new Date();
    const [a, h] = await Promise.all([
      this.prisma.atribuicaoDoente.findMany({
        where: { enfermeiroId: utilizadorId, turno: { dataInicio: { lte: agora }, dataFim: { gte: agora } } }, select: { doenteId: true },
      }),
      this.prisma.atribuicaoHorarioTurno.findMany({
        where: { utilizadorId, horarioTurno: { data: { gte: new Date(agora.getTime() - 86_400_000) } } }, select: { doenteId: true },
      }),
    ]);
    return [...new Set([...a, ...h].map((x) => x.doenteId))];
  }

  /**
   * UX-30 — "O meu turno": os meus doentes por cama, com o que pede acção agora: medicação
   * devida/em atraso, vitais/escalas em atraso, NEWS2 a subir, tarefas.
   */
  async meuTurno(utilizadorId: string) {
    const ids = await this.meusDoentes(utilizadorId);
    if (!ids.length) return { doentes: [] };
    const agora = new Date();
    const desde = new Date(agora.getTime() - 4 * 3_600_000);
    const ate = new Date(agora.getTime() + 60 * 60_000);
    const doentes = await this.prisma.doente.findMany({
      where: { id: { in: ids }, ativo: true },
      select: {
        id: true, nome: true, numeroProcesso: true, dataNascimento: true, estado: true, emIsolamento: true,
        avaliacaoAlergias: true, decisaoNaoReanimar: true,
        cama: { select: { numero: true, quarto: true, servico: true } },
        alergias: { where: { deletedAt: null }, select: { alergenio: true } },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 2, select: { news2: true, data: true } },
        tarefas: { where: { estado: { in: ['pendente', 'em_progresso'] } }, select: { prioridade: true } },
        medicacoes: {
          where: { ativo: true, deletedAt: null },
          select: { id: true, nome: true, frequencia: true, iniciadoEm: true, registos: { where: { administradoEm: { gte: new Date(desde.getTime() - 2 * 3_600_000) } }, select: { administradoEm: true } } },
        },
      },
      orderBy: [{ cama: { quarto: 'asc' } }, { cama: { numero: 'asc' } }],
    });
    const resultado = [];
    for (const d of doentes) {
      let devidas = 0, emAtraso = 0;
      for (const m of d.medicacoes) {
        const tomas = tomasPlaneadas(m.frequencia, desde, ate, m.iniciadoEm);
        for (const t of classificarTomas(tomas, m.registos.map((r) => r.administradoEm), agora)) {
          if (t.estado === 'em_atraso') emAtraso++;
          else if (t.estado === 'devida' && t.hora.getTime() <= ate.getTime()) devidas++;
        }
      }
      const obs = (await this.vigilancia.doDoente(d.id)).filter((o) => o.atrasoMinutos > 0);
      const [sv, svAnt] = d.sinaisVitais;
      resultado.push({
        doente: {
          id: d.id, nome: d.nome, numeroProcesso: d.numeroProcesso, idade: idadeDe(d.dataNascimento), estado: d.estado, cama: d.cama,
          isolamento: d.emIsolamento, naoReanimar: d.decisaoNaoReanimar,
          alergias: d.alergias.length ? d.alergias.map((a) => a.alergenio) : d.avaliacaoAlergias === 'nao_avaliado' ? null : [],
        },
        medicacao: { devidas, emAtraso },
        observacoesEmAtraso: obs.map((o) => ({ tipo: o.tipo, motivo: o.motivo, atrasoMinutos: o.atrasoMinutos })),
        news2: sv ? { valor: sv.news2, em: sv.data, tendencia: tendencia(sv.news2, svAnt?.news2) } : null,
        tarefas: { pendentes: d.tarefas.length, urgentes: d.tarefas.filter((t) => t.prioridade === 'urgente' || t.prioridade === 'alta').length },
      });
    }
    return { doentes: resultado };
  }
}

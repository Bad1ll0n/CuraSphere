import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { intervalosDoServico, proximaAvaliacaoRisco, proximaAvaliacaoSinaisVitais } from '../common/vigilancia';
import { temPapel } from '../common/roles.util';

export type TipoVigilancia = 'sinais_vitais' | 'braden' | 'morse' | 'dor_pos_analgesia';

export interface ObservacaoDevida {
  doenteId: string;
  doente: string;
  numeroProcesso: string;
  cama: string | null;
  servico: string | null;
  tipo: TipoVigilancia;
  devidaEm: string;
  atrasoMinutos: number;
  motivo: string;
}

interface LinhaDoente {
  id: string; nome: string; numeroProcesso: string; dataAdmissao: Date;
  cama_numero: string | null; cama_quarto: string | null; servico: string | null;
  sv_data: Date | null; sv_news2: number | null; sv_completo: boolean | null; sv_isolado3: boolean | null; sv_proxima: Date | null;
  braden_em: Date | null; braden_proxima: Date | null; braden_risco: string | null;
  morse_em: Date | null; morse_proxima: Date | null; morse_risco: string | null;
  dor_ate: Date | null; dor_med: string | null;
}

/** Quem vê a vigilância de todo o serviço; os restantes vêem os doentes atribuídos no turno. */
const PAPEIS_SERVICO = ['chefe_enfermeiros', 'chefe_turno', 'chefe_medicos', 'direcao', 'qualidade'];

/**
 * PROD-10 — "observações em atraso" e "próximas devidas". Cada registo de sinais vitais, de
 * Braden/Morse e de analgesia fixou quando volta a ser devido; aqui compara-se com o relógio.
 * Doentes sem a avaliação inicial contam como devidos desde a admissão (+24 h no risco).
 */
@Injectable()
export class VigilanciaService {
  constructor(private readonly prisma: PrismaService) {}

  async doServico(utilizador: { sub: string; role: string; subRole?: string | null }, servico?: string, apenasEmAtraso = true): Promise<ObservacaoDevida[]> {
    const todos = temPapel(utilizador, PAPEIS_SERVICO);
    const filtroServico = servico ? Prisma.sql`AND c.servico = ${servico}` : Prisma.empty;
    const filtroAtribuicao = todos
      ? Prisma.empty
      : Prisma.sql`AND EXISTS (
          SELECT 1 FROM atribuicoes_doente a JOIN turnos t ON t.id = a."turnoId"
          WHERE a."doenteId" = d.id AND a."enfermeiroId" = ${utilizador.sub}
            AND t."dataInicio" <= now() AND t."dataFim" >= now())`;
    const linhas = await this.consultar(Prisma.sql`d."estadoRegisto" = 'internado' AND d.ativo AND d."deletedAt" IS NULL ${filtroServico} ${filtroAtribuicao}`);
    return this.observacoes(linhas, apenasEmAtraso);
  }

  async doDoente(doenteId: string): Promise<ObservacaoDevida[]> {
    return this.observacoes(await this.consultar(Prisma.sql`d.id = ${doenteId}`), false);
  }

  private consultar(onde: Prisma.Sql): Promise<LinhaDoente[]> {
    // Último registo de cada tipo por doente com LATERAL … LIMIT 1 (PERF-03).
    return this.prisma.$queryRaw<LinhaDoente[]>`
      SELECT d.id, d.nome, d."numeroProcesso", d."dataAdmissao",
             c.numero AS cama_numero, c.quarto AS cama_quarto, c.servico,
             sv.data AS sv_data, sv.news2 AS sv_news2, sv."news2Completo" AS sv_completo,
             sv."news2ParametroIsolado3" AS sv_isolado3, sv."proximaAvaliacaoEm" AS sv_proxima,
             br."criadaEm" AS braden_em, br."proximaAvaliacaoEm" AS braden_proxima, br.risco AS braden_risco,
             mo."criadaEm" AS morse_em, mo."proximaAvaliacaoEm" AS morse_proxima, mo.risco AS morse_risco,
             dor."reavaliarDorAte" AS dor_ate, dor.nome AS dor_med
      FROM doentes d
      LEFT JOIN camas c ON c.id = d."camaId"
      LEFT JOIN LATERAL (SELECT * FROM sinais_vitais s WHERE s."doenteId" = d.id ORDER BY s.data DESC LIMIT 1) sv ON true
      LEFT JOIN LATERAL (SELECT * FROM avaliacoes_risco a WHERE a."doenteId" = d.id AND a.tipo = 'braden' ORDER BY a."criadaEm" DESC LIMIT 1) br ON true
      LEFT JOIN LATERAL (SELECT * FROM avaliacoes_risco a WHERE a."doenteId" = d.id AND a.tipo = 'morse' ORDER BY a."criadaEm" DESC LIMIT 1) mo ON true
      LEFT JOIN LATERAL (
        SELECT r."reavaliarDorAte", m.nome FROM registos_medicacao r JOIN medicacoes m ON m.id = r."medicacaoId"
        WHERE r."doenteId" = d.id AND r."reavaliarDorAte" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM sinais_vitais s2 WHERE s2."doenteId" = d.id AND s2.dor IS NOT NULL AND s2.data >= r."administradoEm")
        ORDER BY r."administradoEm" DESC LIMIT 1
      ) dor ON true
      WHERE ${onde}`;
  }

  private observacoes(linhas: LinhaDoente[], apenasEmAtraso: boolean): ObservacaoDevida[] {
    const agora = Date.now();
    const H = 3_600_000;
    const r: ObservacaoDevida[] = [];
    for (const l of linhas) {
      const base = {
        doenteId: l.id, doente: l.nome, numeroProcesso: l.numeroProcesso,
        cama: l.cama_numero ? `${l.cama_quarto ?? ''}/${l.cama_numero}` : null, servico: l.servico,
      };
      const i = intervalosDoServico(l.servico);
      const juntar = (tipo: TipoVigilancia, devida: Date, motivo: string) => {
        const atraso = Math.floor((agora - devida.getTime()) / 60_000);
        if (apenasEmAtraso && atraso <= 0) return;
        r.push({ ...base, tipo, devidaEm: devida.toISOString(), atrasoMinutos: Math.max(atraso, 0), motivo });
      };

      if (!l.sv_data) juntar('sinais_vitais', new Date(l.dataAdmissao), 'Sem sinais vitais desde a admissão');
      else {
        const devida = l.sv_proxima ?? proximaAvaliacaoSinaisVitais({ data: l.sv_data, news2: l.sv_news2, news2Completo: l.sv_completo, news2ParametroIsolado3: l.sv_isolado3 }, l.servico);
        juntar('sinais_vitais', new Date(devida), l.sv_news2 == null ? 'NEWS2 incompleto' : `NEWS2 ${l.sv_news2}`);
      }
      for (const [tipo, em, proxima, risco] of [['braden', l.braden_em, l.braden_proxima, l.braden_risco], ['morse', l.morse_em, l.morse_proxima, l.morse_risco]] as const) {
        if (!em) juntar(tipo, new Date(new Date(l.dataAdmissao).getTime() + i.avaliacaoInicialHoras * H), 'Avaliação inicial em falta');
        else juntar(tipo, new Date(proxima ?? proximaAvaliacaoRisco(tipo, new Date(em), l.servico)), `Reavaliação periódica (último risco: ${risco})`);
      }
      if (l.dor_ate) juntar('dor_pos_analgesia', new Date(l.dor_ate), `Reavaliar a dor depois de ${l.dor_med}`);
    }
    return r.sort((a, b) => b.atrasoMinutos - a.atrasoMinutos || a.devidaEm.localeCompare(b.devidaEm));
  }
}

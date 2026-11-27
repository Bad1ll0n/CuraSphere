import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CamasService } from '../camas/camas.service';
import {
  abrirEpisodio, episodioAtivo, exigirCompatibilidade, ocuparCama, problemasCompatibilidade,
} from './episodios.core';

/**
 * PROD-02 / PROD-03 — episódios de internamento, reinternamento e transferência interna.
 */
@Injectable()
export class EpisodiosService {
  constructor(private readonly prisma: PrismaService, private readonly camas: CamasService) {}

  /** Histórico de internamentos do doente, com os movimentos de cama/serviço. */
  async listar(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    return this.prisma.episodioInternamento.findMany({
      where: { doenteId },
      orderBy: { numero: 'desc' },
      include: { movimentos: { orderBy: { em: 'asc' } }, sumarioAlta: { select: { id: true, motivoAlta: true, destino: true, criadoEm: true } } },
    });
  }

  /**
   * PROD-02: reinternar uma pessoa que já cá esteve. O processo (alergias, antecedentes,
   * contactos, ficha administrativa) mantém-se; abre-se um episódio novo. As alergias vindas
   * de internamentos anteriores ficam por rever até alguém as confirmar neste episódio.
   */
  async reinternar(doenteId: string, utilizadorId: string, dto: {
    camaId?: string; diagnosticoPrincipal: string; icd10Code?: string; dataAltaPrevista?: string; justificacaoCama?: string;
  }) {
    const r = await this.prisma.$transaction(async (tx) => {
      const doente = await tx.doente.findUnique({
        where: { id: doenteId },
        select: { id: true, ativo: true, deletedAt: true, sexo: true, emIsolamento: true },
      });
      if (!doente || doente.deletedAt) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
      if (doente.ativo) throw new BadRequestException('O doente tem um registo activo — não há reinternamento a fazer.');

      let cama: Awaited<ReturnType<typeof ocuparCama>> | null = null;
      let justificacao: string | null = null;
      if (dto.camaId) {
        const alvo = await tx.cama.findUnique({ where: { id: dto.camaId }, select: { sexo: true, isolamento: true } });
        if (!alvo) throw new NotFoundException(`Cama (ID ${dto.camaId}) não encontrada`);
        justificacao = exigirCompatibilidade(problemasCompatibilidade(alvo, doente), dto.justificacaoCama);
        cama = await ocuparCama(tx, dto.camaId);
      }

      const episodio = await abrirEpisodio(tx, {
        doenteId, origem: 'reinternamento', camaId: cama?.id, servico: cama?.servico,
        diagnosticoPrincipal: dto.diagnosticoPrincipal, icd10Code: dto.icd10Code, criadoPorId: utilizadorId,
        alergiasRevistas: false,
      });

      const atualizado = await tx.doente.update({
        where: { id: doenteId },
        data: {
          ativo: true,
          estado: 'estavel',
          estadoRegisto: cama ? 'internado' : 'pendente_cama',
          camaId: cama?.id ?? null,
          dataAdmissao: episodio.dataAdmissao,
          dataAlta: null,
          dataAltaPrevista: dto.dataAltaPrevista ? new Date(dto.dataAltaPrevista) : null,
          diagnosticoPrincipal: dto.diagnosticoPrincipal,
          ...(dto.icd10Code && { icd10Code: dto.icd10Code }),
        },
        include: { cama: true },
      });

      const alergias = await tx.alergia.findMany({
        where: { doenteId, deletedAt: null },
        select: { id: true, alergenio: true, severidade: true, reacao: true, certeza: true },
      });
      return { doente: atualizado, episodio, alergiasARever: alergias, justificacaoCama: justificacao };
    }, { isolationLevel: 'Serializable' });
    if (dto.camaId) await this.camas.invalidarCache();
    return r;
  }

  /** PROD-02: alguém confirmou com o doente/família as alergias que vinham de trás. */
  async marcarAlergiasRevistas(doenteId: string, utilizadorId: string) {
    const ep = await episodioAtivo(this.prisma as any, doenteId);
    if (!ep) throw new BadRequestException('O doente não tem um internamento em curso.');
    return this.prisma.episodioInternamento.update({
      where: { id: ep.id },
      data: { alergiasRevistasEm: new Date(), alergiasRevistasPorId: utilizadorId },
      select: { id: true, alergiasRevistasEm: true },
    });
  }

  /**
   * PROD-03: transferência interna — mudar de cama (no mesmo serviço) ou de serviço. Tudo
   * numa transacção: a cama nova é ocupada, a antiga vai para limpeza, o doente e o episódio
   * passam a apontar para a nova, o movimento fica registado e é deixada uma nota de
   * passagem para a equipa que recebe.
   */
  async transferir(doenteId: string, utilizadorId: string, dto: { camaId: string; motivo: string; justificacaoCama?: string }) {
    const motivo = dto.motivo?.trim();
    if (!motivo || motivo.length < 5) throw new BadRequestException('Indique o motivo da transferência.');
    const r = await this.prisma.$transaction(async (tx) => {
      const doente = await tx.doente.findUnique({
        where: { id: doenteId },
        select: { id: true, nome: true, ativo: true, camaId: true, sexo: true, emIsolamento: true, cama: { select: { id: true, numero: true, quarto: true, servico: true } } },
      });
      if (!doente || !doente.ativo) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado ou com alta`);
      if (!doente.camaId || !doente.cama) throw new BadRequestException('O doente não está numa cama — atribua-lhe uma primeiro.');
      if (doente.camaId === dto.camaId) throw new BadRequestException('O doente já está nessa cama.');

      const alvo = await tx.cama.findUnique({ where: { id: dto.camaId }, select: { sexo: true, isolamento: true } });
      if (!alvo) throw new NotFoundException(`Cama (ID ${dto.camaId}) não encontrada`);
      const justificacao = exigirCompatibilidade(problemasCompatibilidade(alvo, doente), dto.justificacaoCama);

      const nova = await ocuparCama(tx, dto.camaId);
      // Libertar a antiga ANTES de mover o vínculo único (Doente.camaId é @unique).
      await tx.doente.update({ where: { id: doenteId }, data: { camaId: nova.id } });
      await tx.cama.update({ where: { id: doente.camaId }, data: { estado: 'em_limpeza' } });

      let episodio = await episodioAtivo(tx, doenteId);
      if (!episodio) {
        // Registo antigo sem episódio aberto: abre-se aqui para o movimento ter onde ficar.
        episodio = await abrirEpisodio(tx, { doenteId, origem: 'registo', camaId: doente.camaId, servico: doente.cama.servico, criadoPorId: utilizadorId });
      }
      const mudaServico = (doente.cama.servico ?? null) !== (nova.servico ?? null);
      await tx.episodioInternamento.update({ where: { id: episodio.id }, data: { camaId: nova.id, servico: nova.servico } });
      const movimento = await tx.movimentoInternamento.create({
        data: {
          episodioId: episodio.id, doenteId,
          tipo: mudaServico ? 'servico' : 'cama',
          deCamaId: doente.camaId, paraCamaId: nova.id,
          deServico: doente.cama.servico, paraServico: nova.servico,
          motivo: justificacao ? `${motivo} (excepção de cama: ${justificacao})` : motivo,
          realizadoPorId: utilizadorId,
        },
      });
      await tx.notaTurno.create({
        data: {
          doenteId, autorId: utilizadorId,
          texto: `Transferência ${mudaServico ? 'de serviço' : 'de cama'}: ${doente.cama.quarto}/${doente.cama.numero}`
            + `${doente.cama.servico ? ` (${doente.cama.servico})` : ''} → ${nova.quarto}/${nova.numero}${nova.servico ? ` (${nova.servico})` : ''}. Motivo: ${motivo}.`,
        },
      });
      return { movimento, cama: nova };
    }, { isolationLevel: 'Serializable' });
    await this.camas.invalidarCache();
    return r;
  }

  /**
   * Indicador de reinternamento: episódios que começaram até N dias depois da alta de um
   * episódio anterior do mesmo doente (por omissão 30 dias), no período pedido.
   */
  async indicadorReinternamentos(dias = 30, desde?: string, ate?: string, servico?: string) {
    const fim = ate ? new Date(ate) : new Date();
    const inicio = desde ? new Date(desde) : new Date(fim.getTime() - 90 * 86_400_000);
    const altas = await this.prisma.episodioInternamento.findMany({
      where: { estado: 'alta', dataAlta: { gte: inicio, lte: fim }, ...(servico && { servico }) },
      select: { id: true, doenteId: true, numero: true, dataAlta: true },
    });
    if (!altas.length) return { dias, inicio, fim, altas: 0, reinternamentos: 0, taxa: null };
    const seguintes = await this.prisma.episodioInternamento.findMany({
      where: { doenteId: { in: [...new Set(altas.map((a) => a.doenteId))] }, numero: { gt: 1 } },
      select: { doenteId: true, numero: true, dataAdmissao: true },
    });
    const reinternamentos = altas.filter((a) => seguintes.some((s) =>
      s.doenteId === a.doenteId && s.numero === a.numero + 1
      && s.dataAdmissao.getTime() - a.dataAlta!.getTime() <= dias * 86_400_000)).length;
    return { dias, inicio, fim, altas: altas.length, reinternamentos, taxa: Math.round((reinternamentos / altas.length) * 1000) / 10 };
  }
}

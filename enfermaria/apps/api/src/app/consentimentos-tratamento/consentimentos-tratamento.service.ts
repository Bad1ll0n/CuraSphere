import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DecisaoTratamento, eFinalidade, FINALIDADES_TRATAMENTO, FinalidadeTratamento, tratamentoPermitido,
} from '../common/consentimento-tratamento';

export type OrigemDecisao = 'presencial' | 'portal';

/** SEC-19 — registo, consulta e revogação das decisões do doente. Ver common/consentimento-tratamento.ts. */
@Injectable()
export class ConsentimentosTratamentoService {
  constructor(private readonly prisma: PrismaService) {}

  async estado(doenteId: string) {
    const historico = await this.prisma.consentimentoTratamento.findMany({
      where: { doenteId },
      orderBy: { registadoEm: 'desc' },
      select: {
        id: true, finalidade: true, decisao: true, origem: true, observacoes: true,
        registadoEm: true, revogadoEm: true, origemRevogacao: true,
        registadoPor: { select: { nome: true } },
        revogadoPor: { select: { nome: true } },
      },
    });
    const finalidades = await Promise.all(
      (Object.keys(FINALIDADES_TRATAMENTO) as FinalidadeTratamento[]).map(async (f) => {
        const vigor = historico.find((h) => h.finalidade === f && !h.revogadoEm) ?? null;
        return {
          finalidade: f,
          ...FINALIDADES_TRATAMENTO[f],
          decisao: (vigor?.decisao as DecisaoTratamento) ?? null,
          registadoEm: vigor?.registadoEm ?? null,
          origem: vigor?.origem ?? null,
          permitido: await tratamentoPermitido(this.prisma, doenteId, f),
        };
      }),
    );
    return { finalidades, historico };
  }

  async registar(
    doenteId: string,
    dados: { finalidade: string; decisao: string; observacoes?: string },
    origem: OrigemDecisao,
    utilizadorId: string | null,
  ) {
    const finalidade = this.validarFinalidade(dados.finalidade);
    if (dados.decisao !== 'consentimento' && dados.decisao !== 'oposicao') {
      throw new BadRequestException('Decisão inválida (consentimento | oposicao)');
    }
    // Na IA clínica o regime é de oposição: "consentir" é simplesmente revogar a oposição.
    if (FINALIDADES_TRATAMENTO[finalidade].regime === 'oposicao' && dados.decisao === 'consentimento') {
      throw new BadRequestException('Para retirar uma oposição, revogue-a.');
    }
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    const agora = new Date();
    const criado = await this.prisma.$transaction(async (tx) => {
      // A decisão anterior desta finalidade deixa de vigorar (fica no histórico).
      await tx.consentimentoTratamento.updateMany({
        where: { doenteId, finalidade, revogadoEm: null },
        data: { revogadoEm: agora, revogadoPorId: utilizadorId, origemRevogacao: origem },
      });
      return tx.consentimentoTratamento.create({
        data: {
          doenteId, finalidade, decisao: dados.decisao, origem,
          observacoes: dados.observacoes?.trim() || null,
          registadoPorId: utilizadorId,
        },
      });
    });
    await this.aplicarEfeitos(doenteId, finalidade);
    return criado;
  }

  async revogar(doenteId: string, finalidadeBruta: string, origem: OrigemDecisao, utilizadorId: string | null) {
    const finalidade = this.validarFinalidade(finalidadeBruta);
    const r = await this.prisma.consentimentoTratamento.updateMany({
      where: { doenteId, finalidade, revogadoEm: null },
      data: { revogadoEm: new Date(), revogadoPorId: utilizadorId, origemRevogacao: origem },
    });
    if (r.count === 0) throw new NotFoundException('Não há decisão em vigor para esta finalidade');
    const efeitos = await this.aplicarEfeitos(doenteId, finalidade);
    return { finalidade, revogado: true, ...efeitos };
  }

  /**
   * Quando a finalidade deixa de estar permitida, o que dela depende fecha logo: os links de
   * familiares activos e a conta do portal. A IA verifica a oposição a cada pedido.
   */
  private async aplicarEfeitos(doenteId: string, finalidade: FinalidadeTratamento) {
    if (await tratamentoPermitido(this.prisma, doenteId, finalidade)) return {};
    if (finalidade === 'partilha_familiares') {
      const r = await this.prisma.acessoFamiliar.updateMany({ where: { doenteId, ativo: true }, data: { ativo: false } });
      return { acessosFamiliaresRevogados: r.count };
    }
    if (finalidade === 'portal_doente') {
      const r = await this.prisma.portalDoente.updateMany({ where: { doenteId, ativo: true }, data: { ativo: false } });
      return { contaPortalDesactivada: r.count > 0 };
    }
    return {};
  }

  private validarFinalidade(f: string): FinalidadeTratamento {
    if (!eFinalidade(f)) throw new BadRequestException(`Finalidade inválida (${Object.keys(FINALIDADES_TRATAMENTO).join(' | ')})`);
    return f;
  }
}

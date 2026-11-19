import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { episodioAtivo, episodioAtualOuUltimo } from '../episodios/episodios.core';
import {
  DESTINOS, TEMAS_ENSINO, diasAposAltaClinica, estaPendente, sinalizar, transicaoValida,
  type Destino, type EstadoReferenciacao,
} from './planeamento-alta.regras';

const quem = { select: { id: true, nome: true } } as const;

/**
 * PROD-13 — planeamento de alta e continuidade de cuidados: sinalização precoce, referenciação
 * (RNCCI, CSP, apoio social) com estado, ensinos com teach-back, e o indicador de altas
 * proteladas (dias internado depois da alta clínica).
 */
@Injectable()
export class PlaneamentoAltaService {
  constructor(private readonly prisma: PrismaService) {}

  private async episodio(doenteId: string, exigirAtivo = false) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const ep = exigirAtivo ? await episodioAtivo(this.prisma as any, doenteId) : await episodioAtualOuUltimo(this.prisma as any, doenteId);
    if (exigirAtivo && !ep) throw new BadRequestException('O doente não tem um internamento em curso.');
    return ep as { id: string; estado: string; servico: string | null } | null;
  }

  async resumo(doenteId: string) {
    const ep = await this.episodio(doenteId);
    const porEpisodio = ep ? { episodioId: ep.id } : {};
    const [plano, barthel, avaliacao, referenciacoes, ensinos] = await Promise.all([
      ep ? this.prisma.planoAlta.findUnique({ where: { episodioId: ep.id }, select: { altaClinicaEm: true } }) : null,
      this.prisma.escalaClinica.findFirst({ where: { doenteId, tipo: 'Barthel' }, orderBy: { registadaEm: 'desc' }, select: { pontuacao: true, registadaEm: true } }),
      this.prisma.avaliacaoInicialEnfermagem.findFirst({ where: { doenteId, ...porEpisodio }, orderBy: { atualizadaEm: 'desc' }, select: { dados: true } }),
      this.prisma.referenciacaoContinuidade.findMany({ where: { doenteId, ...porEpisodio }, orderBy: { criadaEm: 'desc' }, include: { criadaPor: quem } }),
      this.prisma.ensinoDoente.findMany({ where: { doenteId, ...porEpisodio }, orderBy: { realizadoEm: 'desc' }, include: { realizadoPor: quem } }),
    ]);
    return {
      internado: ep?.estado === 'ativo',
      altaClinicaEm: plano?.altaClinicaEm ?? null,
      diasAposAltaClinica: ep?.estado === 'ativo' ? diasAposAltaClinica(plano?.altaClinicaEm) : null,
      barthel: barthel ? { pontuacao: barthel.pontuacao, registadaEm: barthel.registadaEm } : null,
      sinalizacao: sinalizar({ barthel: barthel?.pontuacao, avaliacaoInicial: avaliacao as any, ensinos }),
      referenciacoes,
      ensinos,
    };
  }

  catalogo() {
    return {
      destinos: Object.entries(DESTINOS).map(([codigo, nome]) => ({ codigo, nome })),
      temasEnsino: Object.entries(TEMAS_ENSINO).map(([codigo, t]) => ({ codigo, ...t })),
    };
  }

  /** O médico marca (ou desmarca) a alta clínica. A partir daí contam os dias de alta protelada. */
  async marcarAltaClinica(doenteId: string, utilizadorId: string, altaClinica: boolean) {
    const ep = await this.episodio(doenteId, true);
    const data = altaClinica ? { altaClinicaEm: new Date(), altaClinicaPorId: utilizadorId } : { altaClinicaEm: null, altaClinicaPorId: null };
    return this.prisma.planoAlta.upsert({
      where: { episodioId: ep!.id },
      create: { doenteId, episodioId: ep!.id, ...data },
      update: data,
      select: { altaClinicaEm: true },
    });
  }

  async criarReferenciacao(doenteId: string, utilizadorId: string, dto: { destino: string; motivo: string }) {
    if (!(dto.destino in DESTINOS)) throw new BadRequestException('Destino de referenciação desconhecido');
    const ep = await this.episodio(doenteId, true);
    const agora = new Date();
    return this.prisma.referenciacaoContinuidade.create({
      data: {
        doenteId, episodioId: ep!.id, destino: dto.destino as Destino, motivo: dto.motivo.trim(), criadaPorId: utilizadorId,
        historico: [{ estado: 'proposta', em: agora.toISOString(), porId: utilizadorId }],
      },
      include: { criadaPor: quem },
    });
  }

  async alterarEstado(id: string, utilizadorId: string, dto: { estado: EstadoReferenciacao; nota?: string }) {
    const r = await this.prisma.referenciacaoContinuidade.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Referenciação não encontrada');
    if (!transicaoValida(r.estado as EstadoReferenciacao, dto.estado)) {
      throw new BadRequestException(`Não é possível passar de "${r.estado}" a "${dto.estado}".`);
    }
    if (['recusada', 'cancelada'].includes(dto.estado) && (dto.nota ?? '').trim().length < 5) {
      throw new BadRequestException('Indique o motivo (mínimo 5 caracteres).');
    }
    const agora = new Date();
    const marcas: Partial<Record<EstadoReferenciacao, Record<string, Date>>> = {
      enviada: { enviadaEm: agora }, aceite: { aceiteEm: agora }, vaga_atribuida: { vagaEm: agora }, recusada: { fechadaEm: agora }, cancelada: { fechadaEm: agora },
    };
    const marca = marcas[dto.estado] ?? {};
    const historico = [...((r.historico as any[]) ?? []), { estado: dto.estado, em: agora.toISOString(), porId: utilizadorId, ...(dto.nota ? { nota: dto.nota.trim() } : {}) }];
    // Otimista: só altera se ninguém mudou o estado entretanto.
    const n = await this.prisma.referenciacaoContinuidade.updateMany({
      where: { id, estado: r.estado },
      data: { estado: dto.estado, ...marca, historico, ...(dto.nota ? { nota: dto.nota.trim().slice(0, 1000) } : {}) },
    });
    if (n.count === 0) throw new BadRequestException('A referenciação foi alterada entretanto — recarregue.');
    return this.prisma.referenciacaoContinuidade.findUnique({ where: { id }, include: { criadaPor: quem } });
  }

  async registarEnsino(doenteId: string, utilizadorId: string, dto: {
    tema: string; titulo?: string; destinatario: string; cuidadorNome?: string; compreensao: string; nota?: string;
  }) {
    const tema = TEMAS_ENSINO[dto.tema];
    if (!tema && dto.tema !== 'outro') throw new BadRequestException('Tema de ensino desconhecido');
    const titulo = (tema?.titulo ?? dto.titulo ?? '').trim();
    if (!titulo) throw new BadRequestException('Indique o tema do ensino.');
    if (dto.destinatario !== 'doente' && !(dto.cuidadorNome ?? '').trim()) {
      throw new BadRequestException('Indique o nome do cuidador a quem foi feito o ensino.');
    }
    if (dto.compreensao !== 'compreendeu' && (dto.nota ?? '').trim().length < 5) {
      throw new BadRequestException('Quando o ensino não foi compreendido, registe o que falta (nota, mínimo 5 caracteres).');
    }
    const ep = await this.episodio(doenteId, true);
    return this.prisma.ensinoDoente.create({
      data: {
        doenteId, episodioId: ep!.id, tema: dto.tema, titulo, destinatario: dto.destinatario,
        cuidadorNome: dto.cuidadorNome?.trim() || null, compreensao: dto.compreensao, nota: dto.nota?.trim() || null, realizadoPorId: utilizadorId,
      },
      include: { realizadoPor: quem },
    });
  }

  /**
   * Indicador: doentes internados com alta clínica dada — os dias "a mais" e o que os prende
   * (referenciação pendente). Por serviço, para a gestão de camas.
   */
  async altasProteladas(servico?: string) {
    const planos = await this.prisma.planoAlta.findMany({
      where: { altaClinicaEm: { not: null }, episodio: { estado: 'ativo', ...(servico ? { servico } : {}) } },
      select: {
        doenteId: true, episodioId: true, altaClinicaEm: true,
        episodio: { select: { servico: true } },
        doente: { select: { nome: true, numeroProcesso: true, cama: { select: { numero: true } } } },
      },
    });
    const refs = await this.prisma.referenciacaoContinuidade.findMany({
      where: { episodioId: { in: planos.map((p) => p.episodioId) } },
      select: { episodioId: true, destino: true, estado: true },
    });
    const linhas = planos.map((p) => {
      const pendentes = refs.filter((r) => r.episodioId === p.episodioId && estaPendente(r.estado));
      return {
        doenteId: p.doenteId,
        nome: p.doente.nome,
        numeroProcesso: p.doente.numeroProcesso,
        cama: p.doente.cama?.numero ?? null,
        servico: p.episodio.servico,
        altaClinicaEm: p.altaClinicaEm,
        dias: diasAposAltaClinica(p.altaClinicaEm) ?? 0,
        aguarda: pendentes.map((r) => ({ destino: r.destino, estado: r.estado })),
      };
    }).sort((a, b) => b.dias - a.dias);
    return { doentes: linhas.length, diasTotal: linhas.reduce((t, l) => t + l.dias, 0), linhas };
  }
}

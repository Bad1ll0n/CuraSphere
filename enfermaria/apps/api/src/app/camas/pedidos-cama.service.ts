import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { CamasService } from './camas.service';
import {
  abrirEpisodio, episodioAtivo, exigirCompatibilidade, ocuparCama, problemasCompatibilidade,
} from '../episodios/episodios.core';

export interface CriarPedidoCama {
  doenteId?: string;
  episodioUrgenciaId?: string;
  nomeTemporario?: string;
  origem: string;
  servicoDestino: string;
  sexo?: string;
  isolamento?: boolean;
  motivoIsolamento?: string;
  prioridade?: string;
  diagnostico?: string;
  notas?: string;
}

/** Quanto tempo uma cama fica reservada para um pedido antes de voltar a estar livre. */
const RESERVA_HORAS = Number(process.env['PEDIDO_CAMA_RESERVA_HORAS'] ?? 4);

/**
 * PROD-03 — pedido de cama: urgência, bloco, consulta ou outro serviço → cama atribuída
 * (reservada) → ocupada (o doente entra e o episódio de internamento abre). O tempo entre o
 * pedido e a ocupação é o indicador "tempo urgência → cama".
 */
@Injectable()
export class PedidosCamaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly camas: CamasService,
  ) {}

  async criar(dto: CriarPedidoCama, pedidoPorId: string) {
    if (!dto.doenteId && !dto.nomeTemporario?.trim()) {
      throw new BadRequestException('Indique o doente ou, se ainda não estiver registado, um nome temporário.');
    }
    let sexo = dto.sexo ?? null;
    let isolamento = dto.isolamento ?? false;
    if (dto.doenteId) {
      const doente = await this.prisma.doente.findUnique({
        where: { id: dto.doenteId }, select: { id: true, ativo: true, camaId: true, sexo: true, emIsolamento: true },
      });
      if (!doente) throw new NotFoundException(`Doente (ID ${dto.doenteId}) não encontrado`);
      if (doente.ativo && doente.camaId) throw new ConflictException('O doente já está numa cama — use a transferência interna.');
      sexo = sexo ?? doente.sexo;
      isolamento = dto.isolamento ?? doente.emIsolamento;
    }
    const aberto = await this.prisma.pedidoCama.findFirst({
      where: {
        estado: { in: ['pedido', 'atribuida'] },
        OR: [
          ...(dto.doenteId ? [{ doenteId: dto.doenteId }] : []),
          ...(dto.episodioUrgenciaId ? [{ episodioUrgenciaId: dto.episodioUrgenciaId }] : []),
        ],
      },
      select: { id: true },
    });
    if ((dto.doenteId || dto.episodioUrgenciaId) && aberto) {
      throw new ConflictException('Já existe um pedido de cama em aberto para este doente.');
    }
    return this.prisma.pedidoCama.create({
      data: {
        tenantId: this.tenant.tenantId,
        doenteId: dto.doenteId ?? null,
        episodioUrgenciaId: dto.episodioUrgenciaId ?? null,
        nomeTemporario: dto.nomeTemporario?.trim() || null,
        origem: dto.origem,
        servicoDestino: dto.servicoDestino,
        sexo,
        isolamento,
        motivoIsolamento: dto.motivoIsolamento ?? null,
        prioridade: dto.prioridade ?? 'normal',
        diagnostico: dto.diagnostico ?? null,
        notas: dto.notas ?? null,
        pedidoPorId,
      },
    });
  }

  async listar(estado?: string, servico?: string) {
    const estados = estado ? [estado] : ['pedido', 'atribuida'];
    const pedidos = await this.prisma.pedidoCama.findMany({
      where: { estado: { in: estados }, ...(servico && { servicoDestino: servico }) },
      include: {
        doente: { select: { id: true, nome: true, numeroProcesso: true, sexo: true, emIsolamento: true } },
        episodioUrgencia: { select: { id: true, triagem: true, dataEntrada: true } },
      },
      orderBy: [{ prioridade: 'desc' }, { pedidoEm: 'asc' }], // 'urgente' > 'normal'
      take: 200,
    });
    const camaIds = pedidos.map((p) => p.camaId).filter((x): x is string => !!x);
    const camas = camaIds.length
      ? await this.prisma.cama.findMany({ where: { id: { in: camaIds } }, select: { id: true, numero: true, quarto: true, servico: true } })
      : [];
    const agora = Date.now();
    return pedidos.map((p) => ({
      ...p,
      cama: camas.find((c) => c.id === p.camaId) ?? null,
      esperaMinutos: Math.round(((p.ocupadaEm?.getTime() ?? agora) - p.pedidoEm.getTime()) / 60_000),
    }));
  }

  /** Reserva uma cama para o pedido (sexo e isolamento verificados; excepção justificada). */
  async atribuir(id: string, dto: { camaId: string; justificacao?: string }, utilizadorId: string) {
    const r = await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoCama.findUnique({ where: { id } });
      if (!pedido) throw new NotFoundException('Pedido de cama não encontrado');
      if (!['pedido', 'atribuida'].includes(pedido.estado)) throw new BadRequestException(`O pedido está ${pedido.estado}.`);
      const cama = await tx.cama.findUnique({ where: { id: dto.camaId } });
      if (!cama) throw new NotFoundException(`Cama (ID ${dto.camaId}) não encontrada`);
      const justificacao = exigirCompatibilidade(
        problemasCompatibilidade(cama, { sexo: pedido.sexo, emIsolamento: pedido.isolamento }), dto.justificacao,
      );
      // Reserva atómica: só uma cama livre (não reservada por outro pedido).
      const reservada = await tx.cama.updateMany({
        where: { id: dto.camaId, OR: [{ estado: 'livre' }, { estado: 'reservada', reservadaAte: { lt: new Date() } }] },
        data: { estado: 'reservada', reservadaPedidoId: id, reservadaAte: new Date(Date.now() + RESERVA_HORAS * 3_600_000) },
      });
      if (reservada.count !== 1) throw new BadRequestException('A cama não está livre.');
      // Reatribuição: a cama anterior volta a estar livre.
      if (pedido.camaId && pedido.camaId !== dto.camaId) {
        await tx.cama.updateMany({
          where: { id: pedido.camaId, estado: 'reservada', reservadaPedidoId: id },
          data: { estado: 'livre', reservadaPedidoId: null, reservadaAte: null },
        });
      }
      return tx.pedidoCama.update({
        where: { id },
        data: { estado: 'atribuida', camaId: dto.camaId, atribuidaPorId: utilizadorId, atribuidaEm: new Date(), justificacaoAtribuicao: justificacao },
      });
    }, { isolationLevel: 'Serializable' });
    await this.camas.invalidarCache();
    return r;
  }

  /**
   * O doente entra na cama: ocupa-a, passa a internado e abre-se o episódio. Se a pessoa
   * tinha alta, é um reinternamento (alergias por rever).
   */
  async ocupar(id: string, dto: { doenteId?: string; diagnosticoPrincipal?: string }, utilizadorId: string) {
    const r = await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoCama.findUnique({ where: { id } });
      if (!pedido) throw new NotFoundException('Pedido de cama não encontrado');
      if (pedido.estado !== 'atribuida' || !pedido.camaId) throw new BadRequestException('Atribua uma cama ao pedido antes de o doente entrar.');
      const doenteId = pedido.doenteId ?? dto.doenteId;
      if (!doenteId) throw new BadRequestException('Registe o doente (ou indique-o) antes de ocupar a cama.');
      const doente = await tx.doente.findUnique({
        where: { id: doenteId }, select: { id: true, ativo: true, camaId: true, diagnosticoPrincipal: true, icd10Code: true, deletedAt: true },
      });
      if (!doente || doente.deletedAt) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
      if (doente.ativo && doente.camaId) throw new ConflictException('O doente já está numa cama — use a transferência interna.');

      const cama = await ocuparCama(tx, pedido.camaId, pedido.id);
      const diagnostico = dto.diagnosticoPrincipal ?? pedido.diagnostico ?? doente.diagnosticoPrincipal;
      const ativo = doente.ativo ? await episodioAtivo(tx, doenteId) : null;
      const episodio = ativo
        ? await tx.episodioInternamento.update({ where: { id: ativo.id }, data: { camaId: cama.id, servico: cama.servico, pedidoCamaId: pedido.id } })
        : await abrirEpisodio(tx, {
          doenteId,
          origem: pedido.origem === 'urgencia' ? 'urgencia' : doente.ativo ? 'pedido_cama' : 'reinternamento',
          camaId: cama.id, servico: cama.servico, diagnosticoPrincipal: diagnostico, icd10Code: doente.icd10Code,
          criadoPorId: utilizadorId, episodioUrgenciaId: pedido.episodioUrgenciaId, pedidoCamaId: pedido.id,
          // Quem tinha alta traz alergias de antes, que se revêem neste internamento.
          alergiasRevistas: doente.ativo,
        });
      await tx.doente.update({
        where: { id: doenteId },
        data: {
          ativo: true, estadoRegisto: 'internado', camaId: cama.id, dataAlta: null,
          dataAdmissao: episodio.dataAdmissao, ...(diagnostico && { diagnosticoPrincipal: diagnostico }),
          ...(!doente.ativo && { estado: 'estavel', dataAltaPrevista: null }),
        },
      });
      return tx.pedidoCama.update({ where: { id }, data: { estado: 'ocupada', ocupadaEm: new Date(), doenteId } });
    }, { isolationLevel: 'Serializable' });
    await this.camas.invalidarCache();
    return r;
  }

  async cancelar(id: string, motivo: string) {
    if (!motivo?.trim() || motivo.trim().length < 5) throw new BadRequestException('Indique o motivo do cancelamento.');
    const r = await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoCama.findUnique({ where: { id } });
      if (!pedido) throw new NotFoundException('Pedido de cama não encontrado');
      if (!['pedido', 'atribuida'].includes(pedido.estado)) throw new BadRequestException(`O pedido está ${pedido.estado}.`);
      if (pedido.camaId) {
        await tx.cama.updateMany({
          where: { id: pedido.camaId, estado: 'reservada', reservadaPedidoId: id },
          data: { estado: 'livre', reservadaPedidoId: null, reservadaAte: null },
        });
      }
      return tx.pedidoCama.update({ where: { id }, data: { estado: 'cancelado', canceladoEm: new Date(), motivoCancelamento: motivo.trim() } });
    });
    await this.camas.invalidarCache();
    return r;
  }

  /** Tempo pedido → cama (e, para a urgência, entrada na urgência → cama), em minutos. */
  async indicadores(desde?: string) {
    const inicio = desde ? new Date(desde) : new Date(Date.now() - 30 * 86_400_000);
    const ocupados = await this.prisma.pedidoCama.findMany({
      where: { estado: 'ocupada', ocupadaEm: { gte: inicio } },
      select: { origem: true, pedidoEm: true, ocupadaEm: true, episodioUrgencia: { select: { dataEntrada: true } } },
    });
    const mediana = (xs: number[]) => {
      if (!xs.length) return null;
      const o = [...xs].sort((a, b) => a - b); const m = Math.floor(o.length / 2);
      return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
    };
    const pedidoCama = ocupados.map((p) => (p.ocupadaEm!.getTime() - p.pedidoEm.getTime()) / 60_000);
    const urgenciaCama = ocupados.filter((p) => p.episodioUrgencia)
      .map((p) => (p.ocupadaEm!.getTime() - p.episodioUrgencia!.dataEntrada.getTime()) / 60_000);
    const emEspera = await this.prisma.pedidoCama.count({ where: { estado: { in: ['pedido', 'atribuida'] } } });
    return {
      desde: inicio,
      ocupados: ocupados.length,
      emEspera,
      medianaPedidoCamaMin: mediana(pedidoCama.map(Math.round)),
      medianaUrgenciaCamaMin: mediana(urgenciaCama.map(Math.round)),
    };
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { CriarPedidoTransfusaoDto } from './dto/criar-pedido-transfusao.dto';
import { AdicionarBolsaDto } from './dto/adicionar-bolsa.dto';
import { RegistarTransfusaoDto } from './dto/registar-transfusao.dto';
import { RegistarReacaoDto } from './dto/registar-reacao.dto';

// ── Compatibilidade ABO/Rh ────────────────────────────────────────────────────
// Regras de compatibilidade DADOR → RECETOR. Núcleo de segurança da transfusão.
const RECETOR_ACEITA_ERITROCITOS: Record<string, string[]> = {
  O:  ['O'],
  A:  ['O', 'A'],
  B:  ['O', 'B'],
  AB: ['O', 'A', 'B', 'AB'],
};
// Plasma: compatibilidade ABO é INVERSA (AB é dador universal de plasma).
const RECETOR_ACEITA_PLASMA: Record<string, string[]> = {
  O:  ['O', 'A', 'B', 'AB'],
  A:  ['A', 'AB'],
  B:  ['B', 'AB'],
  AB: ['AB'],
};
const COMPONENTES_ERITROCITARIOS = ['concentrado_eritrocitos', 'sangue_total'];
// As plaquetas são suspensas em plasma: a compatibilidade ABO segue a regra do PLASMA
// (inversa), não a dos eritrócitos. Estavam classificadas como eritrocitárias — um doente O
// receberia plaquetas O quando o correcto é poder receber de qualquer grupo ABO.
const COMPONENTES_PLASMATICOS = ['plasma_fresco_congelado', 'crioprecipitado', 'concentrado_plaquetas'];

export interface CompatibilidadeResultado {
  compativel: boolean;
  motivo: string;
}

@Injectable()
export class TransfusaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  /**
   * Determina se uma bolsa é compatível com o doente para o componente pedido.
   * Se o grupo do doente for desconhecido, só admite dador universal
   * (O Rh- para eritrócitos, AB para plasma) — nunca assume compatibilidade.
   */
  verificarCompatibilidade(
    componente: string,
    doenteABO: string | null | undefined,
    doenteRh: string | null | undefined,
    bolsaABO: string,
    bolsaRh: string,
  ): CompatibilidadeResultado {
    const eritro = COMPONENTES_ERITROCITARIOS.includes(componente);
    const plasma = COMPONENTES_PLASMATICOS.includes(componente);

    // Grupo do doente por determinar → exigir dador universal.
    if (!doenteABO) {
      if (eritro) {
        const ok = bolsaABO === 'O' && bolsaRh === 'negativo';
        return { compativel: ok, motivo: ok ? 'Dador universal O Rh- (grupo do doente por determinar)' : 'Grupo do doente por determinar — só é seguro dador universal O Rh-' };
      }
      const ok = bolsaABO === 'AB';
      return { compativel: ok, motivo: ok ? 'Plasma AB dador universal (grupo por determinar)' : 'Grupo do doente por determinar — plasma só AB' };
    }

    const tabela = plasma ? RECETOR_ACEITA_PLASMA : RECETOR_ACEITA_ERITROCITOS;
    const aceites = tabela[doenteABO] ?? [];
    if (!aceites.includes(bolsaABO)) {
      return { compativel: false, motivo: `Incompatibilidade ABO: doente ${doenteABO} não pode receber ${bolsaABO} (${componente})` };
    }
    // Rh: só relevante para componentes eritrocitários. Recetor Rh- só recebe Rh-.
    if (eritro && doenteRh === 'negativo' && bolsaRh === 'positivo') {
      return { compativel: false, motivo: 'Incompatibilidade Rh: doente Rh- não pode receber Rh+' };
    }
    return { compativel: true, motivo: `Compatível (${doenteABO}${doenteRh === 'negativo' ? ' Rh-' : ' Rh+'} recebe ${bolsaABO} ${bolsaRh})` };
  }

  // ── Pedidos ────────────────────────────────────────────────────────────────
  listarPorDoente(doenteId: string) {
    return this.prisma.pedidoTransfusao.findMany({
      where: { doenteId, deletedAt: null },
      orderBy: { criadaEm: 'desc' },
      include: {
        prescritoPor: { select: { id: true, nome: true } },
        bolsasReservadas: { select: { id: true, numeroUnidade: true, componente: true, grupoABO: true, rhD: true, estado: true } },
        registos: {
          include: {
            bolsa: { select: { numeroUnidade: true, grupoABO: true, rhD: true } },
            administradoPor: { select: { id: true, nome: true } },
            reacao: true,
          },
          orderBy: { iniciadoEm: 'desc' },
        },
      },
    });
  }

  async criarPedido(doenteId: string, dto: CriarPedidoTransfusaoDto, prescritoPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    return this.prisma.pedidoTransfusao.create({
      data: {
        doenteId,
        prescritoPorId,
        componente: dto.componente,
        numeroUnidades: dto.numeroUnidades,
        grupoABO: dto.grupoABO,
        rhD: dto.rhD,
        urgencia: dto.urgencia ?? 'rotina',
        indicacao: dto.indicacao,
      },
      include: { prescritoPor: { select: { id: true, nome: true } } },
    });
  }

  async cancelarPedido(pedidoId: string, motivo: string) {
    const pedido = await this.prisma.pedidoTransfusao.findUnique({ where: { id: pedidoId } });
    if (!pedido || pedido.deletedAt) throw new NotFoundException('Pedido de transfusão não encontrado');
    if (pedido.estado === 'administrado') throw new BadRequestException('Pedido já administrado — não pode ser cancelado');
    return this.prisma.$transaction(async (tx) => {
      // Liberta as bolsas reservadas para este pedido.
      await tx.bolsaSangue.updateMany({
        where: { reservadaParaId: pedidoId, estado: 'reservada' },
        data: { estado: 'disponivel', reservadaParaId: null },
      });
      return tx.pedidoTransfusao.update({
        where: { id: pedidoId },
        data: { estado: 'cancelado', motivoCancelamento: motivo },
      });
    });
  }

  // ── Banco de sangue (stock) ──────────────────────────────────────────────────
  listarBanco(filtros: { componente?: string; grupoABO?: string; estado?: string }) {
    return this.prisma.bolsaSangue.findMany({
      where: {
        componente: filtros.componente || undefined,
        grupoABO: filtros.grupoABO || undefined,
        estado: filtros.estado || undefined,
      },
      orderBy: [{ estado: 'asc' }, { dataValidade: 'asc' }],
      take: 500,
    });
  }

  async adicionarBolsa(dto: AdicionarBolsaDto) {
    const existe = await this.prisma.bolsaSangue.findUnique({ where: { numeroUnidade: dto.numeroUnidade }, select: { id: true } });
    if (existe) throw new BadRequestException(`Já existe uma bolsa com o número ${dto.numeroUnidade}`);
    return this.prisma.bolsaSangue.create({
      data: {
        numeroUnidade: dto.numeroUnidade,
        componente: dto.componente,
        grupoABO: dto.grupoABO,
        rhD: dto.rhD,
        volumeMl: dto.volumeMl,
        dataColheita: dto.dataColheita ? new Date(dto.dataColheita) : undefined,
        dataValidade: new Date(dto.dataValidade),
      },
    });
  }

  /** Bolsas disponíveis compatíveis com o pedido (para reservar/administrar). */
  async bolsasCompativeis(pedidoId: string) {
    const pedido = await this.prisma.pedidoTransfusao.findUnique({
      where: { id: pedidoId },
      include: { doente: { select: { grupoSanguineo: true } } },
    });
    if (!pedido) throw new NotFoundException('Pedido de transfusão não encontrado');
    // Grupo derivado SEMPRE do doente; o do pedido serve só de conferência.
    const { doenteABO, doenteRh } = this.grupoDoDoente(pedido.doente?.grupoSanguineo);
    this.assertGrupoPedidoConsistente(pedido, { doenteABO, doenteRh });
    const candidatas = await this.prisma.bolsaSangue.findMany({
      where: { componente: pedido.componente, estado: 'disponivel', dataValidade: { gt: new Date() } },
      orderBy: { dataValidade: 'asc' },
    });
    return candidatas
      .map((b) => ({ ...b, compat: this.verificarCompatibilidade(pedido.componente, doenteABO, doenteRh, b.grupoABO, b.rhD) }))
      .filter((b) => b.compat.compativel);
  }

  async reservarBolsa(pedidoId: string, bolsaId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoTransfusao.findUnique({ where: { id: pedidoId } });
      if (!pedido || pedido.deletedAt) throw new NotFoundException('Pedido não encontrado');
      const bolsa = await tx.bolsaSangue.findUnique({ where: { id: bolsaId } });
      if (!bolsa) throw new NotFoundException('Bolsa não encontrada');
      if (bolsa.estado !== 'disponivel') throw new BadRequestException(`Bolsa ${bolsa.numeroUnidade} não está disponível (estado: ${bolsa.estado})`);
      const { doenteABO, doenteRh } = await this.grupoValidadoDoPedido(tx as never, pedido);
      const compat = this.verificarCompatibilidade(pedido.componente, doenteABO, doenteRh, bolsa.grupoABO, bolsa.rhD);
      if (!compat.compativel) throw new BadRequestException(`Não é possível reservar: ${compat.motivo}`);
      // F3: a escrita era incondicional e a transacção corria no isolamento por omissão. Duas
      // reservas simultâneas liam ambas `disponivel`, e a segunda sobrepunha-se à primeira: a
      // mesma unidade de sangue ficava reservada para dois doentes. Duas barreiras, as mesmas
      // que o `administrar` aqui ao lado já usa — o estado no `where` e Serializable.
      const reservada = await tx.bolsaSangue.updateMany({
        where: { id: bolsaId, estado: 'disponivel' },
        data: { estado: 'reservada', reservadaParaId: pedidoId },
      });
      if (reservada.count === 0) {
        throw new ConflictException(
          `Bolsa ${bolsa.numeroUnidade} deixou de estar disponível — foi reservada entretanto por outro pedido`,
        );
      }
      if (pedido.estado === 'pendente') await tx.pedidoTransfusao.update({ where: { id: pedidoId }, data: { estado: 'reservado' } });
      return { ok: true, motivo: compat.motivo };
    }, { isolationLevel: 'Serializable' });
  }

  /**
   * Administração à cabeceira. Rejeita quando:
   *  · as três verificações não estão todas confirmadas;
   *  · não há um **segundo verificador** identificado e distinto de quem administra
   *    (antes a "dupla verificação" era um único utilizador a marcar três booleanos);
   *  · não há consentimento informado válido para transfusão (BA-08);
   *  · a compatibilidade ABO/Rh, recalculada no servidor **a partir do grupo do doente**,
   *    falha, ou o grupo declarado no pedido diverge do grupo tipado do doente.
   */
  async administrar(
    pedidoId: string,
    dto: RegistarTransfusaoDto & { segundoVerificadorId?: string },
    administradoPorId: string,
  ) {
    if (!dto.verificacaoABO || !dto.verificacaoUnidade || !dto.verificacaoValidade) {
      throw new BadRequestException('Dupla-verificação incompleta — confirme grupo/doente, número da unidade e validade antes de administrar');
    }
    const segundoVerificadorId = dto.segundoVerificadorId?.trim();
    if (!segundoVerificadorId) {
      throw new BadRequestException(
        'Dupla-verificação exige um segundo profissional identificado (segundoVerificadorId)',
      );
    }
    if (segundoVerificadorId === administradoPorId) {
      throw new BadRequestException(
        'O segundo verificador tem de ser um profissional diferente de quem administra',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoTransfusao.findUnique({ where: { id: pedidoId } });
      if (!pedido || pedido.deletedAt) throw new NotFoundException('Pedido não encontrado');
      if (pedido.estado === 'cancelado') throw new BadRequestException('Pedido cancelado');
      const bolsa = await tx.bolsaSangue.findUnique({ where: { id: dto.bolsaId } });
      if (!bolsa) throw new NotFoundException('Bolsa não encontrada');
      if (bolsa.estado === 'transfundida') throw new BadRequestException('Bolsa já foi transfundida');
      if (bolsa.dataValidade < new Date()) throw new BadRequestException('Bolsa fora da validade');

      const segundo = await tx.utilizador.findUnique({
        where: { id: segundoVerificadorId },
        select: { id: true, ativo: true },
      });
      if (!segundo || !segundo.ativo) {
        throw new BadRequestException('Segundo verificador inexistente ou inactivo');
      }

      const consentimentoId = await this.validarConsentimentoTransfusao(tx, pedido.doenteId, pedido.urgencia);

      // O grupo do doente vem do type & screen (`Doente.grupoSanguineo`), nunca do pedido.
      const { doenteABO, doenteRh } = await this.grupoValidadoDoPedido(tx as never, pedido);
      const compat = this.verificarCompatibilidade(pedido.componente, doenteABO, doenteRh, bolsa.grupoABO, bolsa.rhD);
      if (!compat.compativel) throw new BadRequestException(`Transfusão bloqueada — ${compat.motivo}`);

      const registo = await tx.registoTransfusao.create({
        data: {
          pedidoTransfusaoId: pedidoId,
          bolsaId: dto.bolsaId,
          doenteId: pedido.doenteId,
          administradoPorId,
          segundoVerificadorId,
          consentimentoId,
          verificacaoABO: true,
          verificacaoUnidade: true,
          verificacaoValidade: true,
          compativel: true,
          observacoes: dto.observacoes,
        },
      });
      await tx.bolsaSangue.update({ where: { id: dto.bolsaId }, data: { estado: 'transfundida', reservadaParaId: pedidoId } });

      // Se já se transfundiu o número de unidades pedido, o pedido fica administrado.
      const totalTransfundidas = await tx.registoTransfusao.count({ where: { pedidoTransfusaoId: pedidoId } });
      if (totalTransfundidas >= pedido.numeroUnidades) {
        await tx.pedidoTransfusao.update({ where: { id: pedidoId }, data: { estado: 'administrado' } });
      }
      return registo;
    }, { isolationLevel: 'Serializable' });
  }

  async registarReacao(registoTransfusaoId: string, dto: RegistarReacaoDto, registadoPorId: string) {
    const registo = await this.prisma.registoTransfusao.findUnique({ where: { id: registoTransfusaoId } });
    if (!registo) throw new NotFoundException('Registo de transfusão não encontrado');
    const jaExiste = await this.prisma.reacaoTransfusional.findUnique({ where: { registoTransfusaoId }, select: { id: true } });
    if (jaExiste) throw new BadRequestException('Já foi registada uma reação para esta transfusão');

    const reacao = await this.prisma.reacaoTransfusional.create({
      data: {
        registoTransfusaoId,
        doenteId: registo.doenteId,
        registadoPorId,
        tipo: dto.tipo,
        gravidade: dto.gravidade,
        sintomas: dto.sintomas,
        medidas: dto.medidas,
      },
    });

    // Alerta clínico (as reações graves/fatais devem ser visíveis de imediato à equipa).
    const grave = dto.gravidade === 'grave' || dto.gravidade === 'fatal';
    await this.alertas.criarAlerta(
      registo.doenteId,
      grave ? 'reacao_transfusional_grave' : 'reacao_transfusional',
      `Reação transfusional (${dto.tipo.replace(/_/g, ' ')}, ${dto.gravidade}): ${dto.sintomas}`,
      grave ? 4 : 3,
    ).catch(() => null);

    return reacao;
  }

  // ── Resolução de doente (para o guard IDOR no controller) ────────────────────
  async doenteIdDoPedido(pedidoId: string): Promise<string> {
    const p = await this.prisma.pedidoTransfusao.findUnique({ where: { id: pedidoId }, select: { doenteId: true } });
    if (!p) throw new NotFoundException('Pedido de transfusão não encontrado');
    return p.doenteId;
  }

  async doenteIdDoRegisto(registoId: string): Promise<string> {
    const r = await this.prisma.registoTransfusao.findUnique({ where: { id: registoId }, select: { doenteId: true } });
    if (!r) throw new NotFoundException('Registo de transfusão não encontrado');
    return r.doenteId;
  }

  /**
   * BA-08 — o módulo de consentimentos existia e assinava-se, mas nenhum procedimento o lia.
   * Vale a decisão mais recente do doente sobre transfusão:
   *  · recusa registada → bloqueia **sempre**, mesmo em emergência (é uma recusa expressa,
   *    do tipo Testemunha de Jeová: ultrapassá-la seria uma decisão médico-legal, não técnica);
   *  · sem decisão nenhuma → bloqueia, excepto em pedido `emergencia`, onde a transfusão avança
   *    sem consentimento prévio (dispensa clássica em risco de vida) e fica registada como tal.
   *
   * @returns o id do consentimento usado, ou `null` quando avançou por emergência.
   */
  private async validarConsentimentoTransfusao(
    tx: {
      consentimentoInformado: {
        findMany: (args: never) => Promise<
          { id: string; recusado: boolean; motivoRecusa: string | null; assinadoDoenteEm: Date | null }[]
        >;
      };
    },
    doenteId: string,
    urgencia: string,
  ): Promise<string | null> {
    const consentimentos = await tx.consentimentoInformado.findMany({
      where: { doenteId, tipo: 'transfusao' },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, recusado: true, motivoRecusa: true, assinadoDoenteEm: true },
    } as never);

    // A decisão mais recente é a que vale.
    const decisao = consentimentos.find((c) => c.recusado || c.assinadoDoenteEm != null);

    if (decisao?.recusado) {
      throw new BadRequestException(
        `Transfusão bloqueada — o doente tem recusa de consentimento registada` +
        `${decisao.motivoRecusa ? ` (${decisao.motivoRecusa})` : ''}.`,
      );
    }
    if (!decisao) {
      if (urgencia === 'emergencia') return null; // dispensa por risco de vida, registada
      throw new BadRequestException(
        'Transfusão bloqueada — sem consentimento informado assinado para transfusão. ' +
        'Obtenha o consentimento, ou registe o pedido como urgência "emergencia" se houver risco de vida.',
      );
    }
    return decisao.id;
  }

  // ── Auxiliares ───────────────────────────────────────────────────────────────
  /**
   * Grupo do DOENTE, derivado exclusivamente de `Doente.grupoSanguineo` (ex.: "A+", "O-").
   *
   * O grupo escrito no pedido é auto-declarado por quem prescreve e **nunca** é usado para
   * validar compatibilidade — era esse o defeito BA-05. Se o doente não tiver grupo tipado,
   * devolve-se `null`, o que faz `verificarCompatibilidade` exigir dador universal.
   */
  private grupoDoDoente(grupoSanguineo?: string | null): { doenteABO: string | null; doenteRh: string | null } {
    if (grupoSanguineo) {
      const abo = grupoSanguineo.replace(/[+-]/g, '').trim().toUpperCase();
      const rh = grupoSanguineo.includes('-') ? 'negativo' : grupoSanguineo.includes('+') ? 'positivo' : null;
      if (['A', 'B', 'AB', 'O'].includes(abo)) return { doenteABO: abo, doenteRh: rh };
    }
    return { doenteABO: null, doenteRh: null };
  }

  /**
   * O grupo declarado no pedido só serve de dupla-conferência: se divergir do grupo tipado do
   * doente, alguém se enganou e a transfusão pára. Nunca se usa o do pedido para decidir.
   */
  private assertGrupoPedidoConsistente(
    pedido: { grupoABO?: string | null; rhD?: string | null },
    doente: { doenteABO: string | null; doenteRh: string | null },
  ) {
    if (pedido.grupoABO && doente.doenteABO && pedido.grupoABO.toUpperCase() !== doente.doenteABO) {
      throw new BadRequestException(
        `Transfusão bloqueada — o grupo ABO indicado no pedido (${pedido.grupoABO}) não corresponde ` +
        `ao grupo tipado do doente (${doente.doenteABO}). Confirmar o type & screen antes de prosseguir.`,
      );
    }
    if (pedido.rhD && doente.doenteRh && pedido.rhD !== doente.doenteRh) {
      throw new BadRequestException(
        `Transfusão bloqueada — o Rh indicado no pedido (${pedido.rhD}) não corresponde ao Rh tipado ` +
        `do doente (${doente.doenteRh}). Confirmar o type & screen antes de prosseguir.`,
      );
    }
  }

  /** Grupo do doente do pedido, já conferido contra o que foi declarado no pedido. */
  private async grupoValidadoDoPedido(
    tx: { doente: { findUnique: (args: never) => Promise<{ grupoSanguineo: string | null } | null> } },
    pedido: { doenteId: string; grupoABO?: string | null; rhD?: string | null },
  ) {
    const doente = await tx.doente.findUnique({
      where: { id: pedido.doenteId }, select: { grupoSanguineo: true },
    } as never);
    const grupo = this.grupoDoDoente(doente?.grupoSanguineo);
    this.assertGrupoPedidoConsistente(pedido, grupo);
    return grupo;
  }
}

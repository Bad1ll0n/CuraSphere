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
const COMPONENTES_ERITROCITARIOS = ['concentrado_eritrocitos', 'sangue_total', 'concentrado_plaquetas'];
const COMPONENTES_PLASMATICOS = ['plasma_fresco_congelado', 'crioprecipitado'];

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
    const { doenteABO, doenteRh } = this.parseGrupo(pedido.grupoABO, pedido.rhD, pedido.doente?.grupoSanguineo);
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
      const compat = this.verificarCompatibilidade(pedido.componente, pedido.grupoABO, pedido.rhD, bolsa.grupoABO, bolsa.rhD);
      if (!compat.compativel) throw new BadRequestException(`Não é possível reservar: ${compat.motivo}`);
      await tx.bolsaSangue.update({ where: { id: bolsaId }, data: { estado: 'reservada', reservadaParaId: pedidoId } });
      if (pedido.estado === 'pendente') await tx.pedidoTransfusao.update({ where: { id: pedidoId }, data: { estado: 'reservado' } });
      return { ok: true, motivo: compat.motivo };
    });
  }

  /**
   * Administração à cabeceira. Rejeita se as três verificações não estiverem todas
   * confirmadas OU se a compatibilidade ABO/Rh (recalculada no servidor) falhar.
   */
  async administrar(pedidoId: string, dto: RegistarTransfusaoDto, administradoPorId: string) {
    if (!dto.verificacaoABO || !dto.verificacaoUnidade || !dto.verificacaoValidade) {
      throw new BadRequestException('Dupla-verificação incompleta — confirme grupo/doente, número da unidade e validade antes de administrar');
    }
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoTransfusao.findUnique({ where: { id: pedidoId } });
      if (!pedido || pedido.deletedAt) throw new NotFoundException('Pedido não encontrado');
      if (pedido.estado === 'cancelado') throw new BadRequestException('Pedido cancelado');
      const bolsa = await tx.bolsaSangue.findUnique({ where: { id: dto.bolsaId } });
      if (!bolsa) throw new NotFoundException('Bolsa não encontrada');
      if (bolsa.estado === 'transfundida') throw new BadRequestException('Bolsa já foi transfundida');
      if (bolsa.dataValidade < new Date()) throw new BadRequestException('Bolsa fora da validade');

      const compat = this.verificarCompatibilidade(pedido.componente, pedido.grupoABO, pedido.rhD, bolsa.grupoABO, bolsa.rhD);
      if (!compat.compativel) throw new BadRequestException(`Transfusão bloqueada — ${compat.motivo}`);

      const registo = await tx.registoTransfusao.create({
        data: {
          pedidoTransfusaoId: pedidoId,
          bolsaId: dto.bolsaId,
          doenteId: pedido.doenteId,
          administradoPorId,
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

  // ── Auxiliares ───────────────────────────────────────────────────────────────
  /** Deriva ABO/Rh do doente a partir do pedido ou do campo grupoSanguineo (ex.: "A+", "O-"). */
  private parseGrupo(pedidoABO?: string | null, pedidoRh?: string | null, grupoSanguineo?: string | null) {
    if (pedidoABO) return { doenteABO: pedidoABO, doenteRh: pedidoRh ?? null };
    if (grupoSanguineo) {
      const abo = grupoSanguineo.replace(/[+-]/g, '').toUpperCase();
      const rh = grupoSanguineo.includes('-') ? 'negativo' : grupoSanguineo.includes('+') ? 'positivo' : null;
      if (['A', 'B', 'AB', 'O'].includes(abo)) return { doenteABO: abo, doenteRh: rh };
    }
    return { doenteABO: null, doenteRh: null };
  }
}

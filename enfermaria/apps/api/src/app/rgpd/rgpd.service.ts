import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { AcessoLeituraService } from '../common/acesso-leitura.service';
import { recolherDadosDoTitular } from './exportacao-titular';

export const NOME_ANONIMIZADO = 'Titular anonimizado';

const numero = (v: string | undefined, omissao: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : omissao;
};

/**
 * SEC-20 — política de retenção. Os prazos são configuráveis porque dependem do regulamento
 * interno e do enquadramento legal que o DPO da instituição fixar; os valores por omissão são
 * conservadores (não se apaga nada clínico antes do prazo) e estão documentados em
 * docs/RGPD-RETENCAO.md.
 *  - processo clínico: depois de `RETENCAO_PROCESSO_ANOS` (20) sobre a última alta, a identificação
 *    do titular é anonimizada; o conteúdo clínico fica, sem ligação à pessoa (estatística, qualidade);
 *  - dados de atendimento do quiosque (nome e telefone na senha): `RETENCAO_QUIOSQUE_DIAS` (30);
 *  - a anonimização automática só corre com `ANONIMIZACAO_AUTOMATICA=true`; sem isso, o DPO recebe
 *    a lista dos processos elegíveis e decide caso a caso.
 */
export function politicaRetencao(env: NodeJS.ProcessEnv = process.env) {
  return {
    anosProcessoClinico: numero(env['RETENCAO_PROCESSO_ANOS'], 20),
    diasDadosQuiosque: numero(env['RETENCAO_QUIOSQUE_DIAS'], 30),
    anonimizacaoAutomatica: env['ANONIMIZACAO_AUTOMATICA'] === 'true',
  };
}

@Injectable()
export class RgpdService {
  private readonly logger = new Logger(RgpdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notificacoes: NotificacoesService,
    private readonly leituras: AcessoLeituraService,
  ) {}

  /** Art.º 15.º/20.º: tudo o que é do titular, mais quem consultou o processo. */
  async exportar(doenteId: string, pedidoPor: { utilizadorId?: string; via: 'portal' | 'dpo' }) {
    const { titular, dados, incompletas } = await recolherDadosDoTitular(this.prisma, doenteId);
    if (!titular) throw new NotFoundException('Titular não encontrado');
    const acessos = await this.leituras.listarPorDoente(doenteId, { paraTitular: true, limite: 1000 });
    this.audit.registar({
      utilizadorId: pedidoPor.utilizadorId ?? null,
      acao: 'RGPD_EXPORTACAO_TITULAR',
      entidadeTipo: 'Doente',
      entidadeId: doenteId,
      detalhes: JSON.stringify({ via: pedidoPor.via, tabelas: Object.keys(dados).length, incompletas }),
      ip: null,
    } as any);
    return {
      exportadoEm: new Date().toISOString(),
      regulamento: 'RGPD art.º 15.º (direito de acesso) e art.º 20.º (portabilidade)',
      titular,
      dados,
      acessos,
      ...(incompletas.length ? { incompletas } : {}),
    };
  }

  private limiteProcesso(agora = new Date()) {
    const d = new Date(agora);
    d.setFullYear(d.getFullYear() - politicaRetencao().anosProcessoClinico);
    return d;
  }

  /** Processos já sem atividade há mais do que o prazo e ainda não anonimizados. */
  async elegiveis(agora = new Date()) {
    return this.prisma.doente.findMany({
      where: { anonimizadoEm: null, ativo: false, dataAlta: { not: null, lt: this.limiteProcesso(agora) } },
      select: { id: true, numeroProcesso: true, dataAlta: true },
      orderBy: { dataAlta: 'asc' },
      take: 500,
    });
  }

  /**
   * Anonimiza a identificação do titular (nunca o conteúdo clínico). Só para processos fora do
   * prazo de retenção — antes disso o apagamento não se aplica a dados de saúde (art.º 17.º, n.º 3,
   * al. c) RGPD). Irreversível, por isso exige motivo e fica auditado.
   */
  async anonimizar(doenteId: string, porId: string | null, motivo: string, agora = new Date()) {
    const d = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true, ativo: true, dataAlta: true, anonimizadoEm: true, dataNascimento: true } });
    if (!d) throw new NotFoundException('Titular não encontrado');
    if (d.anonimizadoEm) throw new ConflictException('Este processo já foi anonimizado');
    if (d.ativo || !d.dataAlta || d.dataAlta >= this.limiteProcesso(agora)) {
      throw new BadRequestException(`Ainda dentro do prazo de retenção (${politicaRetencao().anosProcessoClinico} anos após a última alta)`);
    }
    if (!motivo || motivo.trim().length < 10) throw new BadRequestException('Indique o motivo (pelo menos 10 caracteres)');

    const ano = d.dataNascimento ? new Date(Date.UTC(d.dataNascimento.getUTCFullYear(), 0, 1)) : null;
    await this.prisma.$transaction([
      this.prisma.doente.update({
        where: { id: doenteId },
        data: { nome: NOME_ANONIMIZADO, dataNascimento: ano, numeroProcesso: `ANON-${doenteId.slice(0, 8)}`, identificadorHis: null, fotoUrl: null, anonimizadoEm: agora },
      }),
      this.prisma.ficheiroPessoalDoente.updateMany({
        where: { doenteId },
        data: { nif: null, nifBusca: null, numeroSNS: null, morada: null, codigoPostal: null, localidade: null, telefone: null, email: null, numeroApolice: null },
      }),
      this.prisma.contactoEmergencia.updateMany({ where: { doenteId }, data: { nome: NOME_ANONIMIZADO, telefone: '—', relacao: '—' } }),
      this.prisma.consulta.updateMany({ where: { doenteId }, data: { nomeDoente: NOME_ANONIMIZADO } }),
      this.prisma.listaEspera.updateMany({ where: { doenteId }, data: { nomeDoente: NOME_ANONIMIZADO } }),
      // Credenciais que já não têm razão de existir.
      this.prisma.acessoFamiliar.deleteMany({ where: { doenteId } }),
      this.prisma.portalDoente.deleteMany({ where: { doenteId } }),
    ]);
    this.audit.registar({
      utilizadorId: porId, acao: 'RGPD_TITULAR_ANONIMIZADO', entidadeTipo: 'Doente', entidadeId: doenteId,
      detalhes: JSON.stringify({ motivo: motivo.trim(), automatica: porId === null }), ip: null,
    } as any);
    return { anonimizado: true, doenteId };
  }

  /** Dados de atendimento (senhas do quiosque, check-ins da sala de espera) além do prazo. */
  async limparQuiosque(agora = new Date()) {
    const limite = new Date(agora.getTime() - politicaRetencao().diasDadosQuiosque * 24 * 60 * 60 * 1000);
    const [senhas, salaEspera] = await this.prisma.$transaction([
      this.prisma.ticket.updateMany({
        where: { criadoEm: { lt: limite }, OR: [{ nomeUtente: { not: null } }, { telefone: { not: null } }] },
        data: { nomeUtente: null, telefone: null },
      }),
      // Check-ins da sala de espera: nome, data de nascimento e n.º de utente de quem passou.
      this.prisma.checkinSalaEspera.updateMany({
        where: { chegadaEm: { lt: limite }, nomeDoente: { not: NOME_ANONIMIZADO } },
        data: { nomeDoente: NOME_ANONIMIZADO, dataNascimento: null, numeroUtente: null },
      }),
    ]);
    return senhas.count + salaEspera.count;
  }

  /** Diário: limpa o quiosque; informa o DPO (qualidade) dos elegíveis; anonimiza só se configurado. */
  @Cron('30 3 * * *')
  async aplicarRetencao(agora = new Date()) {
    if (!(await this.prisma.tryBecomeLeader('rgpd-retencao', 23 * 3600_000))) return null;
    const quiosque = await this.limparQuiosque(agora);
    const elegiveis = await this.elegiveis(agora);
    let anonimizados = 0;
    if (politicaRetencao().anonimizacaoAutomatica) {
      for (const e of elegiveis) {
        try { await this.anonimizar(e.id, null, 'Anonimização automática — fim do prazo de retenção', agora); anonimizados++; }
        catch (err) { this.logger.warn(`Anonimização de ${e.id} falhou: ${(err as Error).message}`); }
      }
    } else if (elegiveis.length) {
      this.notificacoes.enviarParaRole('qualidade', 'Processos fora do prazo de retenção',
        `${elegiveis.length} processo(s) ultrapassaram o prazo de retenção e aguardam decisão de anonimização.`, { tipo: 'rgpd_retencao' },
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }
    return { quiosque, elegiveis: elegiveis.length, anonimizados };
  }
}

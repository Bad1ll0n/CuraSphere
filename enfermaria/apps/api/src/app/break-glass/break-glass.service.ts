import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class BreakGlassService {
  private readonly logger = new Logger(BreakGlassService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly audit: AuditService,
  ) {}

  async ativar(utilizadorId: string, doenteId: string, motivo: string, ip?: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    const expiradoEm = new Date(Date.now() + 4 * 60 * 60 * 1000); // +4 horas

    const acesso = await this.prisma.breakGlassAccess.create({
      data: { utilizadorId, doenteId, motivo, ip, expiradoEm },
      include: {
        utilizador: { select: { id: true, nome: true, role: true } },
        doente: { select: { id: true, nome: true, numeroProcesso: true } },
      },
    });

    this.audit.registar({
      utilizadorId,
      acao: 'BREAK_GLASS_ACTIVADO',
      entidadeTipo: 'Doente',
      entidadeId: doenteId,
      detalhes: JSON.stringify({ motivo, ip, expiradoEm }),
      ip: ip ?? null,
    });

    this.notificacoes.enviarParaRole('ti', '🚨 Break-Glass Activado',
      `${acesso.utilizador.nome} (${acesso.utilizador.role}) acedeu em emergência ao doente ${doente.nome}. Motivo: ${motivo}`,
      { breakGlassId: acesso.id, doenteId },
    ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    // Liderança a notificar: direcao (papel base) + chefia de enfermagem (sub-papel, pois têm
    // role='enfermeiro'). Antes a query filtrava por role='chefe_enfermeiros', que nenhum
    // utilizador tem — logo só a direcao recebia os alertas de emergência.
    const chefesTurno = await this.prisma.utilizador.findMany({
      where: {
        ativo: true,
        OR: [
          { role: 'direcao' },
          { subRole: { in: ['chefe_enfermeiros', 'supervisor_enfermagem'] } },
        ],
      },
      select: { id: true },
    });
    await Promise.all(chefesTurno.map((u) =>
      this.notificacoes.enviarParaUtilizador(
        u.id,
        '🚨 Break-Glass Activado',
        `${acesso.utilizador.nome} acedeu em emergência ao processo de ${doente.nome}. Motivo: ${motivo}`,
        { breakGlassId: acesso.id },
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err))),
    ));

    return acesso;
  }

  async verificarAtivoParaDoente(utilizadorId: string, doenteId: string): Promise<boolean> {
    const agora = new Date();
    const acesso = await this.prisma.breakGlassAccess.findFirst({
      where: {
        utilizadorId,
        doenteId,
        ativo: true,
        expiradoEm: { gt: agora },
      },
    });
    return acesso !== null;
  }

  /**
   * SEC-14 — os acessos de emergência por rever (o mais antigo primeiro). Cada acesso tem de ser
   * revisto por alguém da direção, qualidade ou chefia que não seja quem o fez.
   */
  async porRever() {
    return this.prisma.breakGlassAccess.findMany({
      where: { revistoEm: null },
      orderBy: { criadoEm: 'asc' },
      take: 200,
      include: {
        utilizador: { select: { id: true, nome: true, role: true } },
        doente: { select: { id: true, nome: true, numeroProcesso: true } },
      },
    });
  }

  async rever(id: string, revisorId: string, resultado: 'justificado' | 'injustificado', nota?: string) {
    const acesso = await this.prisma.breakGlassAccess.findUnique({ where: { id }, select: { id: true, utilizadorId: true, doenteId: true, revistoEm: true } });
    if (!acesso) throw new NotFoundException('Acesso de emergência não encontrado');
    if (acesso.utilizadorId === revisorId) throw new ForbiddenException('Não pode rever o seu próprio acesso de emergência');
    if (acesso.revistoEm) throw new ConflictException('Este acesso já foi revisto');
    const texto = nota?.trim() || null;
    if (resultado === 'injustificado' && (!texto || texto.length < 10)) {
      throw new BadRequestException('Indique o motivo (pelo menos 10 caracteres) para considerar o acesso injustificado');
    }

    // Só um revisor fica com a decisão, mesmo com dois pedidos ao mesmo tempo.
    const r = await this.prisma.breakGlassAccess.updateMany({
      where: { id, revistoEm: null },
      // Injustificado: o acesso termina já (se ainda estava em vigor).
      data: { revistoEm: new Date(), revistoPorId: revisorId, revisaoResultado: resultado, revisaoNota: texto, ...(resultado === 'injustificado' ? { ativo: false } : {}) },
    });
    if (r.count !== 1) throw new ConflictException('Este acesso já foi revisto');

    this.audit.registar({
      utilizadorId: revisorId,
      acao: 'BREAK_GLASS_REVISTO',
      entidadeTipo: 'BreakGlassAccess',
      entidadeId: id,
      detalhes: JSON.stringify({ resultado, nota: texto, doenteId: acesso.doenteId, utilizadorId: acesso.utilizadorId }),
      ip: null,
    });
    if (resultado === 'injustificado') {
      this.notificacoes.enviarParaRole('qualidade', 'Acesso de emergência injustificado',
        'Um acesso de emergência foi considerado injustificado na revisão — ver o registo de acessos.', { breakGlassId: id },
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }
    return this.prisma.breakGlassAccess.findUnique({ where: { id } });
  }

  /** SEC-14: acessos sem revisão há mais de 72 h escalam para a direção e a qualidade (uma vez). */
  @Cron('15 * * * *')
  async escalarPorRever(agora = new Date()) {
    if (!(await this.prisma.tryBecomeLeader('break-glass-escalar', 3_300_000))) return 0;
    const limite = new Date(agora.getTime() - 72 * 60 * 60 * 1000);
    const atrasados = await this.prisma.breakGlassAccess.findMany({
      where: { revistoEm: null, escaladoEm: null, criadoEm: { lt: limite } },
      select: { id: true },
      take: 500,
    });
    if (atrasados.length === 0) return 0;
    await this.prisma.breakGlassAccess.updateMany({ where: { id: { in: atrasados.map((a) => a.id) } }, data: { escaladoEm: agora } });
    const destinos = await this.prisma.utilizador.findMany({ where: { ativo: true, role: { in: ['direcao', 'qualidade'] } }, select: { id: true } });
    await Promise.all(destinos.map((u) => this.notificacoes.enviarParaUtilizador(u.id, 'Acessos de emergência por rever',
      `${atrasados.length} acesso(s) de emergência sem revisão há mais de 72 horas.`, { tipo: 'break_glass_revisao' },
    ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)))));
    return atrasados.length;
  }

  async listar(doenteId?: string) {
    return this.prisma.breakGlassAccess.findMany({
      where: doenteId ? { doenteId } : {},
      orderBy: { criadoEm: 'desc' },
      take: 100,
      include: {
        utilizador: { select: { id: true, nome: true, role: true } },
        doente: { select: { id: true, nome: true, numeroProcesso: true } },
        revistoPor: { select: { id: true, nome: true } },
      },
    });
  }
}

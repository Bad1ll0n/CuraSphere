import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async listar(doenteId?: string) {
    return this.prisma.breakGlassAccess.findMany({
      where: doenteId ? { doenteId } : {},
      orderBy: { criadoEm: 'desc' },
      take: 100,
      include: {
        utilizador: { select: { id: true, nome: true, role: true } },
        doente: { select: { id: true, nome: true, numeroProcesso: true } },
      },
    });
  }
}

import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { avaliarRisco } from '../common/escalas-motor';
import { proximaAvaliacaoRisco } from '../common/vigilancia';

const ROLES_PODEM = [
  'enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos',
];

// PROD-08: o cálculo vive em common/escalas-motor.ts (motor único, cortes DGS configuráveis).

@Injectable()
export class EscalasService {
  private readonly logger = new Logger(EscalasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertasService: AlertasService,
    private readonly notificacoesService: NotificacoesService,
  ) {}

  async listarUltimas(doenteId: string) {
    const [braden, morse] = await Promise.all([
      this.prisma.avaliacaoRisco.findFirst({
        where: { doenteId, tipo: 'braden' },
        orderBy: { criadaEm: 'desc' },
        include: { registadoPor: { select: { nome: true } } },
      }),
      this.prisma.avaliacaoRisco.findFirst({
        where: { doenteId, tipo: 'morse' },
        orderBy: { criadaEm: 'desc' },
        include: { registadoPor: { select: { nome: true } } },
      }),
    ]);
    return { braden, morse };
  }

  async historico(doenteId: string, tipo?: string) {
    return this.prisma.avaliacaoRisco.findMany({
      where: { doenteId, ...(tipo ? { tipo } : {}) },
      orderBy: { criadaEm: 'desc' },
      include: { registadoPor: { select: { nome: true } } },
    });
  }

  async criar(doenteId: string, registadoPorId: string, role: string, tipo: string, itens: Record<string, number>) {
    if (!ROLES_PODEM.includes(role)) throw new ForbiddenException('Sem permissão para registar avaliações de risco');

    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    // PROD-08: itens validados (incompleta → 400), cortes DGS configuráveis e versionados.
    const r = avaliarRisco(tipo === 'braden' ? 'braden' : 'morse', itens);
    const { pontuacao, risco } = r;
    const agora = new Date();
    const servico = await this.prisma.cama.findFirst({ where: { doente: { id: doenteId } }, select: { servico: true } }).catch(() => null);

    const avaliacao = await this.prisma.avaliacaoRisco.create({
      data: {
        doenteId, registadoPorId, tipo, pontuacao, itens: r.itens, risco, versao: r.versao,
        // PROD-10: reavaliação programada.
        proximaAvaliacaoEm: proximaAvaliacaoRisco(tipo === 'braden' ? 'braden' : 'morse', agora, servico?.servico),
      },
      include: { registadoPor: { select: { nome: true } } },
    });

    // Criar alerta e push se risco elevado
    // PROD-08: o motor só devolve baixo/moderado/alto (cortes DGS); 'alto' pede alerta.
    if (risco === 'alto') {
      const nomeEscala = tipo === 'braden' ? 'Braden (úlceras)' : 'Morse (quedas)';
      const nivelLabel = 'Alto';
      const msg = `Risco ${nivelLabel} — Escala ${nomeEscala}: ${pontuacao} pontos`;
      this.alertasService.criarAlerta(doenteId, 'risco_clinico', msg);
      this.notificacoesService.enviarParaDoente(
        doenteId,
        `⚠ Risco ${nivelLabel} — ${doente.nome}`,
        msg,
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }

    return avaliacao;
  }
}

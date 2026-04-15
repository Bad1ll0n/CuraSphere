import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const ROLES_PODEM = [
  'enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos',
];

function calcularBraden(itens: Record<string, number>): { pontuacao: number; risco: string } {
  const pontuacao =
    (itens['percepcaoSensorial'] ?? 0) +
    (itens['humidade'] ?? 0) +
    (itens['atividade'] ?? 0) +
    (itens['mobilidade'] ?? 0) +
    (itens['nutricao'] ?? 0) +
    (itens['friccaoCisalhamento'] ?? 0);

  let risco: string;
  if (pontuacao <= 9)       risco = 'muito_alto';
  else if (pontuacao <= 12) risco = 'alto';
  else if (pontuacao <= 14) risco = 'moderado';
  else                       risco = 'baixo';

  return { pontuacao, risco };
}

function calcularMorse(itens: Record<string, number>): { pontuacao: number; risco: string } {
  const pontuacao =
    (itens['historiaQueda'] ?? 0) +
    (itens['diagnosticoSecundario'] ?? 0) +
    (itens['ajudaMarcha'] ?? 0) +
    (itens['heparinaIV'] ?? 0) +
    (itens['marchaTransferencia'] ?? 0) +
    (itens['estadoMental'] ?? 0);

  let risco: string;
  if (pontuacao >= 45)       risco = 'alto';
  else if (pontuacao >= 25)  risco = 'moderado';
  else                        risco = 'baixo';

  return { pontuacao, risco };
}

@Injectable()
export class EscalasService {
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
    if (!ROLES_PODEM.includes(role)) throw new ForbiddenException('Sem permissão');

    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException('Doente não encontrado');

    const { pontuacao, risco } = tipo === 'braden' ? calcularBraden(itens) : calcularMorse(itens);

    const avaliacao = await this.prisma.avaliacaoRisco.create({
      data: { doenteId, registadoPorId, tipo, pontuacao, itens, risco },
      include: { registadoPor: { select: { nome: true } } },
    });

    // Criar alerta e push se risco elevado
    if (risco === 'alto' || risco === 'muito_alto') {
      const nomeEscala = tipo === 'braden' ? 'Braden (úlceras)' : 'Morse (quedas)';
      const nivelLabel = risco === 'muito_alto' ? 'Muito Alto' : 'Alto';
      const msg = `Risco ${nivelLabel} — Escala ${nomeEscala}: ${pontuacao} pontos`;
      this.alertasService.criarAlerta(doenteId, 'risco_clinico', msg);
      this.notificacoesService.enviarParaDoente(
        doenteId,
        `⚠ Risco ${nivelLabel} — ${doente.nome}`,
        msg,
      ).catch(() => {});
    }

    return avaliacao;
  }
}

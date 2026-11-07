import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { codificarAlergenio } from '../medicacao/alergias.helper';

const ROLES_PODEM = [
  'enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos', 'administrativo',
];

@Injectable()
export class AlergiasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(doenteId: string) {
    return this.prisma.alergia.findMany({
      where: { doenteId, deletedAt: null },
      orderBy: { criadaEm: 'desc' },
    });
  }

  async criar(doenteId: string, role: string, body: Record<string, any>, utilizadorId?: string) {
    if (!ROLES_PODEM.includes(role)) throw new ForbiddenException('Sem permissão para registar alergias');
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const agora = new Date();
    // PROD-06: medicamentos codificados contra o catálogo interno (substância/classe).
    const codificacao = body['tipo'] === 'medicamento' ? codificarAlergenio(body['alergenio']) : { codigo: null, sistemaCodigo: 'livre' };
    const [alergia] = await this.prisma.$transaction([
      this.prisma.alergia.create({
        data: {
          doenteId,
          alergenio: body['alergenio'] as string,
          tipo: body['tipo'] as string,
          severidade: body['severidade'] as string,
          notas: body['notas'] as string | undefined,
          codigo: codificacao.codigo,
          sistemaCodigo: codificacao.sistemaCodigo,
          reacao: (body['reacao'] as string | undefined) ?? null,
          certeza: (body['certeza'] as string | undefined) ?? null,
          fonte: (body['fonte'] as string | undefined) ?? null,
          verificadaEm: agora,
          verificadaPorId: utilizadorId ?? null,
        },
      }),
      this.prisma.doente.update({
        where: { id: doenteId },
        data: { avaliacaoAlergias: 'com_alergias', avaliacaoAlergiasEm: agora, avaliacaoAlergiasPorId: utilizadorId ?? null },
      }),
    ]);
    return alergia;
  }

  /** PROD-06: estado da avaliação de alergias do doente. */
  async avaliacao(doenteId: string) {
    const d = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: { avaliacaoAlergias: true, avaliacaoAlergiasEm: true, avaliacaoAlergiasPorId: true },
    });
    if (!d) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    return { estado: d.avaliacaoAlergias, em: d.avaliacaoAlergiasEm, porId: d.avaliacaoAlergiasPorId };
  }

  /** PROD-06: registar "sem alergias conhecidas" — só se não houver alergias activas. */
  async registarSemAlergias(doenteId: string, utilizadorId: string, role: string) {
    if (!ROLES_PODEM.includes(role)) throw new ForbiddenException('Sem permissão para registar alergias');
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const activas = await this.prisma.alergia.count({ where: { doenteId, deletedAt: null } });
    if (activas > 0) {
      throw new ConflictException(`O doente tem ${activas} alergia(s) registada(s) — remova-as primeiro, se foram registadas por engano.`);
    }
    await this.prisma.doente.update({
      where: { id: doenteId },
      data: { avaliacaoAlergias: 'sem_alergias_conhecidas', avaliacaoAlergiasEm: new Date(), avaliacaoAlergiasPorId: utilizadorId },
    });
    return this.avaliacao(doenteId);
  }

  /**
   * Remoção lógica (QA-02). A alergia deixa de contar nas verificações de prescrição, mas
   * fica na BD com quem a removeu, quando e porquê — antes era um `delete` sem rasto.
   */
  async remover(id: string, utilizadorId: string, role: string, motivo: string) {
    if (role !== 'medico') throw new ForbiddenException('Só um médico pode remover uma alergia');
    const alergia = await this.prisma.alergia.findUnique({ where: { id } });
    if (!alergia || alergia.deletedAt) throw new NotFoundException('Alergia não encontrada');
    const removida = await this.prisma.alergia.update({
      where: { id },
      data: { deletedAt: new Date(), removidaPorId: utilizadorId, motivoRemocao: motivo.trim() },
    });
    // PROD-06: retirada a última alergia (registada por engano), o estado volta a "não avaliado"
    // — não passa a "sem alergias conhecidas" sem alguém o confirmar.
    const restantes = await this.prisma.alergia.count({ where: { doenteId: alergia.doenteId, deletedAt: null } });
    if (restantes === 0) {
      await this.prisma.doente.update({
        where: { id: alergia.doenteId },
        data: { avaliacaoAlergias: 'nao_avaliado', avaliacaoAlergiasEm: new Date(), avaliacaoAlergiasPorId: utilizadorId },
      });
    }
    return removida;
  }
}

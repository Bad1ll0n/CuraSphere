import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async criar(doenteId: string, role: string, body: Record<string, any>) {
    if (!ROLES_PODEM.includes(role)) throw new ForbiddenException('Sem permissão para registar alergias');
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    return this.prisma.alergia.create({
      data: {
        doenteId,
        alergenio: body['alergenio'] as string,
        tipo: body['tipo'] as string,
        severidade: body['severidade'] as string,
        notas: body['notas'] as string | undefined,
      },
    });
  }

  /**
   * Remoção lógica (QA-02). A alergia deixa de contar nas verificações de prescrição, mas
   * fica na BD com quem a removeu, quando e porquê — antes era um `delete` sem rasto.
   */
  async remover(id: string, utilizadorId: string, role: string, motivo: string) {
    if (role !== 'medico') throw new ForbiddenException('Só um médico pode remover uma alergia');
    const alergia = await this.prisma.alergia.findUnique({ where: { id } });
    if (!alergia || alergia.deletedAt) throw new NotFoundException('Alergia não encontrada');
    return this.prisma.alergia.update({
      where: { id },
      data: { deletedAt: new Date(), removidaPorId: utilizadorId, motivoRemocao: motivo.trim() },
    });
  }
}

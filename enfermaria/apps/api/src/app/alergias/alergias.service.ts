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
      where: { doenteId },
      orderBy: { criadaEm: 'desc' },
    });
  }

  async criar(doenteId: string, role: string, body: Record<string, any>) {
    if (!ROLES_PODEM.includes(role)) throw new ForbiddenException('Sem permissão');
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException('Doente não encontrado');
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

  async remover(id: string, role: string) {
    if (!ROLES_PODEM.includes(role)) throw new ForbiddenException('Sem permissão');
    const alergia = await this.prisma.alergia.findUnique({ where: { id } });
    if (!alergia) throw new NotFoundException('Alergia não encontrada');
    return this.prisma.alergia.delete({ where: { id } });
  }
}

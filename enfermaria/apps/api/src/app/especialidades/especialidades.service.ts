import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SUBROLE_TIPO: Record<string, string> = {
  nutricao_clinica:    'nutricao',
  psicologia_clinica:  'psicologia',
  reabilitacao_fala:   'terapia_fala',
  tae:                 'tae',
};

@Injectable()
export class EspecialidadesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(profissionalId: string, subRole: string) {
    const tipo = SUBROLE_TIPO[subRole];
    return this.prisma.sessaoEspecialidade.findMany({
      where: { profissionalId, ...(tipo ? { tipo } : {}) },
      orderBy: { data: 'desc' },
      include: { doente: { select: { id: true, nome: true } } },
    });
  }

  async porDoente(doenteId: string, subRole?: string) {
    const tipo = subRole ? SUBROLE_TIPO[subRole] : undefined;
    return this.prisma.sessaoEspecialidade.findMany({
      where: { doenteId, ...(tipo ? { tipo } : {}) },
      orderBy: { data: 'desc' },
      include: { profissional: { select: { id: true, nome: true, subRole: true } } },
    });
  }

  async criar(profissionalId: string, subRole: string, dto: {
    doenteId: string; data: string; duracao: number; descricao?: string;
  }) {
    const tipo = SUBROLE_TIPO[subRole];
    if (!tipo) throw new ForbiddenException('Sub-role sem tipo de especialidade associado');
    return this.prisma.sessaoEspecialidade.create({
      data: {
        tipo,
        doenteId: dto.doenteId,
        profissionalId,
        data: new Date(dto.data),
        duracao: dto.duracao,
        descricao: dto.descricao ?? null,
        estado: 'agendada',
      },
      include: {
        doente: { select: { id: true, nome: true } },
        profissional: { select: { id: true, nome: true } },
      },
    });
  }

  async realizar(id: string, dto: { evolucao: string }) {
    const sessao = await this.prisma.sessaoEspecialidade.findUnique({ where: { id } });
    if (!sessao) throw new NotFoundException('Sessão não encontrada');
    return this.prisma.sessaoEspecialidade.update({
      where: { id },
      data: { estado: 'realizada', evolucao: dto.evolucao },
    });
  }

  async cancelar(id: string) {
    const sessao = await this.prisma.sessaoEspecialidade.findUnique({ where: { id } });
    if (!sessao) throw new NotFoundException('Sessão não encontrada');
    return this.prisma.sessaoEspecialidade.update({
      where: { id },
      data: { estado: 'cancelada' },
    });
  }
}

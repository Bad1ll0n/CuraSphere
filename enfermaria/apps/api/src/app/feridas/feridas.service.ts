import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarAvaliacaoFerida } from './dto/criar-avaliacao-ferida.dto';

const ROLES_PODEM_REGISTAR = ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros'];

@Injectable()
export class FeridasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(doenteId: string, dto: CriarAvaliacaoFerida, userId: string, role: string) {
    if (!ROLES_PODEM_REGISTAR.includes(role)) {
      throw new ForbiddenException('Sem permissão para registar avaliação de ferida');
    }
    await this.assertDoente(doenteId);

    return this.prisma.avaliacaoFerida.create({
      data: {
        doenteId,
        registadoPorId: userId,
        tipo: dto.tipo,
        localizacao: dto.localizacao,
        estadoCicatrizacao: dto.estadoCicatrizacao,
        comprimento: dto.comprimento,
        largura: dto.largura,
        profundidade: dto.profundidade,
        leito: dto.leito,
        exsudadoVolume: dto.exsudadoVolume,
        exsudadoTipo: dto.exsudadoTipo,
        periferia: dto.periferia,
        dor: dto.dor,
        odor: dto.odor ?? false,
        pensoAplicado: dto.pensoAplicado,
        proximaTroca: dto.proximaTroca ? new Date(dto.proximaTroca) : undefined,
        notas: dto.notas,
      },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async listar(doenteId: string) {
    await this.assertDoente(doenteId);
    return this.prisma.avaliacaoFerida.findMany({
      where: { doenteId, deletedAt: null },
      orderBy: { criadaEm: 'desc' },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async buscarUltima(doenteId: string) {
    await this.assertDoente(doenteId);
    return this.prisma.avaliacaoFerida.findFirst({
      where: { doenteId, deletedAt: null },
      orderBy: { criadaEm: 'desc' },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async apagar(id: string, userId: string, role: string) {
    const avaliacao = await this.prisma.avaliacaoFerida.findUnique({ where: { id } });
    if (!avaliacao || avaliacao.deletedAt) throw new NotFoundException('Avaliação não encontrada');
    if (avaliacao.registadoPorId !== userId && !['medico', 'chefe_enfermeiros'].includes(role)) {
      throw new ForbiddenException('Sem permissão para apagar esta avaliação');
    }
    return this.prisma.avaliacaoFerida.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertDoente(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException('Doente não encontrado');
  }
}

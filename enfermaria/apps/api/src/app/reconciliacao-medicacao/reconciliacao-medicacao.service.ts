import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, MaxLength, IsOptional } from 'class-validator';

export class CriarReconciliacaoDto {
  @IsString()
  @MaxLength(5000)
  medicacaoCasa: string; // JSON serialized

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  discrepancias?: string; // JSON serialized
}

@Injectable()
export class ReconciliacaoMedicacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(doenteId: string, dto: CriarReconciliacaoDto, criadoPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    return this.prisma.reconciliacaoMedicacao.create({
      data: {
        doenteId,
        criadoPorId,
        medicacaoCasa: dto.medicacaoCasa,
        discrepancias: dto.discrepancias ?? '[]',
      },
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async aprovar(id: string, aprovadaPorId: string) {
    const rec = await this.prisma.reconciliacaoMedicacao.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Reconciliação não encontrada');
    return this.prisma.reconciliacaoMedicacao.update({
      where: { id },
      data: { aprovadaEm: new Date(), aprovadaPorId },
    });
  }

  listar(doenteId: string) {
    return this.prisma.reconciliacaoMedicacao.findMany({
      where: { doenteId },
      orderBy: { criadaEm: 'desc' },
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
        aprovadaPor: { select: { id: true, nome: true } },
      },
    });
  }

  listarPendenteAprovacao() {
    return this.prisma.reconciliacaoMedicacao.findMany({
      where: { aprovadaEm: null },
      orderBy: { criadaEm: 'asc' },
      include: {
        doente: { select: { id: true, nome: true, cama: { select: { numero: true } } } },
        criadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }
}

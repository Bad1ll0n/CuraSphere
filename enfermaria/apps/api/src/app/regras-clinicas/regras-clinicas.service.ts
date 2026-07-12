import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RegrasCliniciasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(ativa?: boolean) {
    return this.prisma.regraClinica.findMany({
      where: ativa !== undefined ? { ativa } : undefined,
      include: { criadoPor: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async criar(criadoPorId: string, dto: {
    nome: string;
    condicao: Record<string, any>;
    acoes: Array<Record<string, any>>;
    servicoId?: string;
  }) {
    return this.prisma.regraClinica.create({
      data: {
        nome: dto.nome,
        condicao: dto.condicao,
        acoes: dto.acoes,
        servicoId: dto.servicoId ?? null,
        criadoPorId,
        ativa: true,
      },
      include: { criadoPor: { select: { id: true, nome: true } } },
    });
  }

  async atualizar(id: string, dto: {
    nome?: string;
    condicao?: Record<string, any>;
    acoes?: Array<Record<string, any>>;
    ativa?: boolean;
  }) {
    const regra = await this.prisma.regraClinica.findUnique({ where: { id } });
    if (!regra) throw new NotFoundException(`Regra clínica (ID ${id}) não encontrada`);

    const data: Record<string, any> = {};
    if (dto.nome !== undefined) data['nome'] = dto.nome;
    if (dto.condicao !== undefined) data['condicao'] = dto.condicao;
    if (dto.acoes !== undefined) data['acoes'] = dto.acoes;
    if (dto.ativa !== undefined) data['ativa'] = dto.ativa;

    return this.prisma.regraClinica.update({
      where: { id },
      data,
      include: { criadoPor: { select: { id: true, nome: true } } },
    });
  }

  async apagar(id: string) {
    const regra = await this.prisma.regraClinica.findUnique({ where: { id } });
    if (!regra) throw new NotFoundException(`Regra clínica (ID ${id}) não encontrada`);
    return this.prisma.regraClinica.delete({ where: { id } });
  }
}

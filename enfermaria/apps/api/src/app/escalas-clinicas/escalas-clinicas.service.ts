import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EscalasClinicasService {
  constructor(private readonly prisma: PrismaService) {}

  async registar(doenteId: string, dto: {
    tipo: string; valores: Record<string, any>; pontuacao?: number; classificacao?: string; observacoes?: string;
  }, registadoPorId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.escalaClinica.create({
      data: {
        doenteId,
        registadoPorId,
        tipo: dto.tipo as any,
        valores: dto.valores,
        pontuacao: dto.pontuacao,
        classificacao: dto.classificacao,
        observacoes: dto.observacoes,
      },
      include: { registadoPor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async listar(doenteId: string, tipo?: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.escalaClinica.findMany({
      where: { doenteId, ...(tipo ? { tipo: tipo as any } : {}) },
      orderBy: { registadaEm: 'desc' },
      include: { registadoPor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async listarRecentes(doenteId: string) {
    // Último registo de cada tipo de escala para o doente
    await this.buscarDoente(doenteId);
    const tipos = ['RASS', 'CPOT', 'SOFA', 'CTG', 'Apgar', 'PEWS', 'FLACC'];
    const resultados = await Promise.all(
      tipos.map(tipo =>
        this.prisma.escalaClinica.findFirst({
          where: { doenteId, tipo: tipo as any },
          orderBy: { registadaEm: 'desc' },
          include: { registadoPor: { select: { id: true, nome: true } } },
        })
      )
    );
    return resultados.filter(Boolean);
  }

  private async buscarDoente(id: string) {
    const d = await this.prisma.doente.findUnique({ where: { id } });
    if (!d) throw new NotFoundException(`Doente (ID ${id}) não encontrado`);
    return d;
  }
}

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotasClinicasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(doenteId: string, dto: {
    subjetivo: string; objetivo: string; avaliacao: string; plano: string;
  }, autorId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.notaClinica.create({
      data: { doenteId, autorId, ...dto },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async listar(doenteId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.notaClinica.findMany({
      where: { doenteId },
      orderBy: { criadaEm: 'desc' },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async atualizar(id: string, dto: {
    subjetivo?: string; objetivo?: string; avaliacao?: string; plano?: string;
  }) {
    await this.buscarNota(id);
    return this.prisma.notaClinica.update({
      where: { id },
      data: { ...dto, editadaEm: new Date() },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async apagar(id: string) {
    await this.buscarNota(id);
    return this.prisma.notaClinica.delete({ where: { id } });
  }

  private async buscarDoente(id: string) {
    const d = await this.prisma.doente.findUnique({ where: { id } });
    if (!d) throw new NotFoundException(`Doente (ID ${id}) não encontrado`);
    return d;
  }

  async assinar(notaId: string, utilizadorId: string, totpCode: string) {
    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: utilizadorId } });
    if (!utilizador) throw new NotFoundException('Utilizador não encontrado');
    if (!utilizador.mfaAtivo || !utilizador.mfaSecret) {
      throw new ForbiddenException('MFA não configurado. Configure o autenticador antes de assinar.');
    }

    const valido = authenticator.verify({ token: totpCode, secret: utilizador.mfaSecret });
    if (!valido) throw new ForbiddenException('Código TOTP inválido');

    const nota = await this.buscarNota(notaId);
    if (nota.assinadaEm) throw new BadRequestException('Nota já assinada');

    return this.prisma.notaClinica.update({
      where: { id: notaId },
      data: { assinadaEm: new Date(), assinadaPorId: utilizadorId },
      select: { id: true, assinadaEm: true, assinadaPor: { select: { id: true, nome: true } } },
    });
  }

  private async buscarNota(id: string) {
    const n = await this.prisma.notaClinica.findUnique({ where: { id } });
    if (!n) throw new NotFoundException(`Nota clínica (ID ${id}) não encontrada`);
    return n;
  }
}

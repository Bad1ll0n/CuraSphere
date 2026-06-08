import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { authenticator } = require('otplib') as any;
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
      where: { doenteId, deletedAt: null },
      orderBy: { criadaEm: 'desc' },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async atualizar(id: string, utilizadorId: string, role: string, dto: {
    subjetivo?: string; objetivo?: string; avaliacao?: string; plano?: string;
  }) {
    const nota = await this.buscarNota(id);
    const rolesSupervision = ['direcao', 'chefe_medicos', 'chefe_enfermeiros'];
    const podeEditar = nota.autorId === utilizadorId || rolesSupervision.includes(role);
    if (!podeEditar) throw new ForbiddenException('Só o autor pode editar esta nota');
    return this.prisma.notaClinica.update({
      where: { id },
      data: { ...dto, editadaEm: new Date() },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async apagar(id: string, utilizadorId: string, role: string) {
    const nota = await this.buscarNota(id);
    const rolesSupervision = ['direcao', 'chefe_medicos'];
    const podeApagar = nota.autorId === utilizadorId || rolesSupervision.includes(role);
    if (!podeApagar) throw new ForbiddenException('Só o autor pode apagar esta nota');
    return this.prisma.notaClinica.update({ where: { id }, data: { deletedAt: new Date() } });
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

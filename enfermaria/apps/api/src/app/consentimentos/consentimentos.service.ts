import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsentimentosService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: {
    doenteId: string;
    tipo: string;
    descricao: string;
    criadoPorId: string;
  }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: dto.doenteId } });
    if (!doente) throw new NotFoundException(`Doente (ID ${dto.doenteId}) não encontrado`);

    return this.prisma.consentimentoInformado.create({
      data: {
        doenteId: dto.doenteId,
        tipo: dto.tipo,
        descricao: dto.descricao,
        criadoPorId: dto.criadoPorId,
      },
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async listarPorDoente(doenteId: string) {
    return this.prisma.consentimentoInformado.findMany({
      where: { doenteId },
      orderBy: { criadoEm: 'desc' },
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
        testemunha: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async assinar(id: string, testemunhaId?: string) {
    const c = await this.prisma.consentimentoInformado.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Consentimento (ID ${id}) não encontrado`);
    if (c.recusado) throw new BadRequestException('Consentimento foi recusado');
    if (c.assinadoDoenteEm) throw new BadRequestException('Consentimento já assinado pelo doente');

    return this.prisma.consentimentoInformado.update({
      where: { id },
      data: {
        assinadoDoenteEm: new Date(),
        ...(testemunhaId && {
          testemunhaId,
          assinadoTestemunhaEm: new Date(),
        }),
      },
      include: {
        criadoPor: { select: { id: true, nome: true } },
        testemunha: { select: { id: true, nome: true } },
      },
    });
  }

  async recusar(id: string, motivo: string) {
    const c = await this.prisma.consentimentoInformado.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Consentimento (ID ${id}) não encontrado`);
    if (c.assinadoDoenteEm) throw new BadRequestException('Consentimento já foi assinado');

    return this.prisma.consentimentoInformado.update({
      where: { id },
      data: { recusado: true, motivoRecusa: motivo },
    });
  }
}

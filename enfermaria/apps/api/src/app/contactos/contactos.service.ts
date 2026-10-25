import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(doenteId: string) {
    return this.prisma.contactoEmergencia.findMany({
      where: { doenteId },
      orderBy: [{ principal: 'desc' }, { nome: 'asc' }],
    });
  }

  async criar(doenteId: string, body: Record<string, any>) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    if (body.principal) {
      await this.prisma.contactoEmergencia.updateMany({
        where: { doenteId, principal: true },
        data: { principal: false },
      });
    }

    return this.prisma.contactoEmergencia.create({
      data: {
        doenteId,
        nome: body['nome'] as string,
        relacao: body['relacao'] as string,
        telefone: body['telefone'] as string,
        principal: body['principal'] as boolean | undefined,
      },
    });
  }

  async remover(id: string) {
    const contacto = await this.prisma.contactoEmergencia.findUnique({ where: { id } });
    if (!contacto) throw new NotFoundException(`Contacto (ID ${id}) não encontrado`);
    return this.prisma.contactoEmergencia.delete({ where: { id } });
  }
}

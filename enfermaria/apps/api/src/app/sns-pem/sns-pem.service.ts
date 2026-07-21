import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { criarPemClient, PemClient } from './pem-client';
import { EmitirReceitaDto } from './dto/emitir-receita.dto';

@Injectable()
export class SnsPemService {
  private readonly pem: PemClient = criarPemClient();

  constructor(private readonly prisma: PrismaService) {}

  async emitir(doenteId: string, prescritoPorId: string, dto: EmitirReceitaDto) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    try {
      const res = await this.pem.emitir({ doenteId, numeroUtenteSNS: dto.numeroUtenteSNS, medicamentos: dto.medicamentos });
      return this.prisma.receitaEletronica.create({
        data: {
          doenteId,
          prescritoPorId,
          numeroReceita: res.numeroReceita,
          codigoDispensa: res.codigoDispensa,
          estado: res.estado,
          ambiente: this.pem.ambiente,
          medicamentos: dto.medicamentos as any,
        },
      });
    } catch (e: any) {
      // Persiste a tentativa falhada (rastreabilidade), mas propaga o erro ao chamador.
      await this.prisma.receitaEletronica.create({
        data: { doenteId, prescritoPorId, estado: 'erro', ambiente: this.pem.ambiente, medicamentos: dto.medicamentos as any, erro: e?.message ?? 'erro desconhecido' },
      }).catch(() => null);
      throw e;
    }
  }

  listarPorDoente(doenteId: string) {
    return this.prisma.receitaEletronica.findMany({
      where: { doenteId },
      orderBy: { criadaEm: 'desc' },
      take: 50,
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdicionarListaEsperaDto } from './dto/lista-espera.dto';

const ORDEM_PRIORIDADE: Record<string, number> = { urgente: 0, alta: 1, normal: 2 };

@Injectable()
export class ListaEsperaService {
  constructor(private readonly prisma: PrismaService) {}

  adicionar(dto: AdicionarListaEsperaDto) {
    return this.prisma.listaEspera.create({
      data: {
        especialidade: dto.especialidade,
        doenteId: dto.doenteId,
        nomeDoente: dto.nomeDoente,
        medicoId: dto.medicoId,
        prioridade: dto.prioridade ?? 'normal',
        contactoTelefone: dto.contactoTelefone,
        notas: dto.notas,
      },
    });
  }

  async listar(especialidade?: string, estado?: string) {
    const itens = await this.prisma.listaEspera.findMany({
      where: { especialidade: especialidade || undefined, estado: estado || 'em_espera' },
      take: 500,
    });
    // Ordena por prioridade e antiguidade (mais antigo primeiro).
    return itens.sort((a, b) =>
      (ORDEM_PRIORIDADE[a.prioridade] ?? 9) - (ORDEM_PRIORIDADE[b.prioridade] ?? 9) ||
      a.criadaEm.getTime() - b.criadaEm.getTime(),
    );
  }

  async atualizarEstado(id: string, estado: string) {
    const item = await this.prisma.listaEspera.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Entrada da lista de espera não encontrada');
    return this.prisma.listaEspera.update({ where: { id }, data: { estado } });
  }

  /**
   * Próximo doente em espera para uma especialidade (ao libertar-se uma vaga por cancelamento).
   * Marca-o como 'contactado'. Devolve null se a lista estiver vazia.
   */
  async proximoParaVaga(especialidade: string) {
    const fila = await this.listar(especialidade, 'em_espera');
    const proximo = fila[0];
    if (!proximo) return null;
    await this.prisma.listaEspera.update({ where: { id: proximo.id }, data: { estado: 'contactado' } });
    return proximo;
  }
}

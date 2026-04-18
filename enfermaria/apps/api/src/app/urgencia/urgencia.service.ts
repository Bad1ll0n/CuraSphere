import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ORDEM_TRIAGEM = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };

@Injectable()
export class UrgenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async registarEntrada(dto: {
    doenteId?: string; nomeTemporario?: string; queixaPrincipal: string;
    triagem: string; sinaisVitaisTriagem?: object; notas?: string;
  }, triadoPorId: string) {
    return this.prisma.episodioUrgencia.create({
      data: {
        doenteId: dto.doenteId ?? null,
        nomeTemporario: dto.nomeTemporario ?? null,
        queixaPrincipal: dto.queixaPrincipal,
        triagem: dto.triagem as any,
        estadoEpisodio: 'sala_espera',
        triadoPorId,
        sinaisVitaisTriagem: dto.sinaisVitaisTriagem ?? undefined,
        notas: dto.notas ?? null,
      },
      include: { doente: { select: { id: true, nome: true, dataNascimento: true } }, triadoPor: { select: { id: true, nome: true } } },
    });
  }

  async listaEspera() {
    const episodios = await this.prisma.episodioUrgencia.findMany({
      where: { estadoEpisodio: { notIn: ['alta_urgencia', 'internado', 'transferido'] } },
      include: {
        doente: { select: { id: true, nome: true, dataNascimento: true } },
        triadoPor: { select: { id: true, nome: true } },
        medicoResponsavel: { select: { id: true, nome: true } },
      },
    });
    return episodios.sort((a, b) => {
      const ordemA = ORDEM_TRIAGEM[a.triagem] ?? 99;
      const ordemB = ORDEM_TRIAGEM[b.triagem] ?? 99;
      if (ordemA !== ordemB) return ordemA - ordemB;
      return a.dataEntrada.getTime() - b.dataEntrada.getTime();
    });
  }

  async atualizarEstado(id: string, estado: string) {
    await this.buscar(id);
    const dataSaida = ['alta_urgencia', 'internado', 'transferido'].includes(estado) ? new Date() : undefined;
    return this.prisma.episodioUrgencia.update({
      where: { id },
      data: { estadoEpisodio: estado as any, ...(dataSaida ? { dataSaida } : {}) },
      include: { doente: { select: { id: true, nome: true } }, medicoResponsavel: { select: { id: true, nome: true } } },
    });
  }

  async atribuirMedico(id: string, medicoResponsavelId: string) {
    await this.buscar(id);
    return this.prisma.episodioUrgencia.update({
      where: { id },
      data: { medicoResponsavelId, estadoEpisodio: 'em_atendimento' },
      include: { doente: { select: { id: true, nome: true } }, medicoResponsavel: { select: { id: true, nome: true } } },
    });
  }

  async dashboard() {
    const episodios = await this.prisma.episodioUrgencia.findMany({
      where: { estadoEpisodio: { notIn: ['alta_urgencia', 'internado', 'transferido'] } },
    });
    const agora = Date.now();
    const tempoMedio = episodios.length
      ? Math.round(episodios.reduce((acc, e) => acc + (agora - e.dataEntrada.getTime()), 0) / episodios.length / 60000)
      : 0;
    return {
      total: episodios.length,
      porCor: {
        vermelho: episodios.filter(e => e.triagem === 'vermelho').length,
        laranja: episodios.filter(e => e.triagem === 'laranja').length,
        amarelo: episodios.filter(e => e.triagem === 'amarelo').length,
        verde: episodios.filter(e => e.triagem === 'verde').length,
        azul: episodios.filter(e => e.triagem === 'azul').length,
      },
      tempoMedioEsperaMin: tempoMedio,
    };
  }

  private async buscar(id: string) {
    const e = await this.prisma.episodioUrgencia.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Episódio não encontrado');
    return e;
  }
}

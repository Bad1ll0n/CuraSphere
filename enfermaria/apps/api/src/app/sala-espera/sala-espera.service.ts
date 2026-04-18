import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalaEsperaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(incluirAtendidos = false) {
    const where = incluirAtendidos ? {} : { estado: { in: ['aguardando', 'em_atendimento'] as any[] } };
    return this.prisma.checkinSalaEspera.findMany({
      where,
      orderBy: [{ prioridade: 'asc' }, { chegadaEm: 'asc' }],
      include: {
        rececionista: { select: { nome: true } },
        medico: { select: { nome: true } },
      },
    });
  }

  async registar(dto: {
    nomeDoente: string;
    dataNascimento?: string;
    numeroUtente?: string;
    motivo: string;
    prioridade?: number;
    observacoes?: string;
  }, rececionistadoPorId: string) {
    return this.prisma.checkinSalaEspera.create({
      data: {
        nomeDoente: dto.nomeDoente,
        dataNascimento: dto.dataNascimento ? new Date(dto.dataNascimento) : null,
        numeroUtente: dto.numeroUtente ?? null,
        motivo: dto.motivo,
        prioridade: dto.prioridade ?? 3,
        observacoes: dto.observacoes ?? null,
        rececionistadoPorId,
      },
      include: {
        rececionista: { select: { nome: true } },
        medico: { select: { nome: true } },
      },
    });
  }

  async chamar(id: string, medicoId: string) {
    return this.prisma.checkinSalaEspera.update({
      where: { id },
      data: { estado: 'em_atendimento', chamadoEm: new Date(), medicoId },
      include: { rececionista: { select: { nome: true } }, medico: { select: { nome: true } } },
    });
  }

  async concluir(id: string, estado: 'atendido' | 'desistiu' | 'ausente') {
    return this.prisma.checkinSalaEspera.update({
      where: { id },
      data: { estado, atendidoEm: new Date() },
      include: { rececionista: { select: { nome: true } }, medico: { select: { nome: true } } },
    });
  }

  async estatisticas() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [aguardando, em_atendimento, atendidos, tempo] = await Promise.all([
      this.prisma.checkinSalaEspera.count({ where: { estado: 'aguardando' } }),
      this.prisma.checkinSalaEspera.count({ where: { estado: 'em_atendimento' } }),
      this.prisma.checkinSalaEspera.count({ where: { estado: 'atendido', chegadaEm: { gte: hoje } } }),
      this.prisma.checkinSalaEspera.findMany({
        where: { estado: 'atendido', chegadaEm: { gte: hoje }, atendidoEm: { not: null } },
        select: { chegadaEm: true, atendidoEm: true },
      }),
    ]);
    const tempoMedio = tempo.length > 0
      ? Math.round(tempo.reduce((s, r) => s + (r.atendidoEm!.getTime() - r.chegadaEm.getTime()), 0) / tempo.length / 60000)
      : null;
    return { aguardando, em_atendimento, atendidos, tempoMedioMin: tempoMedio };
  }
}

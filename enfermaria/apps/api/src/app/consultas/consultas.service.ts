import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsultasService {
  constructor(private readonly prisma: PrismaService) {}

  async agendar(dto: {
    doenteId?: string; nomeDoente?: string; medicoId: string; especialidade: string;
    dataHora: string; duracao?: number; notas?: string;
  }) {
    return this.prisma.consulta.create({
      data: {
        doenteId: dto.doenteId ?? null,
        nomeDoente: dto.nomeDoente ?? null,
        medicoId: dto.medicoId,
        especialidade: dto.especialidade,
        dataHora: new Date(dto.dataHora),
        duracao: dto.duracao ?? 30,
        notas: dto.notas ?? null,
      },
      include: this.includeRelations(),
    });
  }

  async listar(medicoId?: string, especialidade?: string, data?: string) {
    const where: any = {};
    if (medicoId) where.medicoId = medicoId;
    if (especialidade) where.especialidade = especialidade;
    if (data) {
      const d = new Date(data); const fim = new Date(d); fim.setDate(fim.getDate() + 1);
      where.dataHora = { gte: d, lt: fim };
    }
    return this.prisma.consulta.findMany({ where, orderBy: { dataHora: 'asc' }, include: this.includeRelations() });
  }

  async agendaMedico(medicoId: string) {
    return this.prisma.consulta.findMany({
      where: { medicoId, estado: { in: ['agendada'] }, dataHora: { gte: new Date() } },
      orderBy: { dataHora: 'asc' },
      include: this.includeRelations(),
    });
  }

  async realizar(id: string, dto: { notas?: string; diagnostico?: string; proximaConsulta?: string }) {
    await this.buscar(id);
    return this.prisma.consulta.update({
      where: { id },
      data: { estado: 'realizada', notas: dto.notas ?? null, diagnostico: dto.diagnostico ?? null, proximaConsulta: dto.proximaConsulta ? new Date(dto.proximaConsulta) : null },
      include: this.includeRelations(),
    });
  }

  async atualizarEstado(id: string, estado: string) {
    await this.buscar(id);
    return this.prisma.consulta.update({ where: { id }, data: { estado: estado as any } });
  }

  private async buscar(id: string) {
    const c = await this.prisma.consulta.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Consulta não encontrada');
    return c;
  }

  private includeRelations() {
    return {
      doente: { select: { id: true, nome: true, dataNascimento: true, numeroProcesso: true } },
      medico: { select: { id: true, nome: true, role: true } },
    };
  }
}

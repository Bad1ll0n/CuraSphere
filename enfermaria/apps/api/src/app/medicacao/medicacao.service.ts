import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MedicacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorDoente(doenteId: string) {
    return this.prisma.medicacao.findMany({
      where: { doenteId },
      include: {
        prescritoPor: { select: { id: true, nome: true } },
        registos: {
          include: { administradoPor: { select: { id: true, nome: true } } },
          orderBy: { administradoEm: 'desc' },
          take: 10,
        },
      },
      orderBy: { iniciadoEm: 'desc' },
    });
  }

  async prescrever(data: {
    doenteId: string;
    nome: string;
    dose: string;
    via: string;
    frequencia: string;
    prescritoPorId: string;
  }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: data.doenteId } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    return this.prisma.medicacao.create({
      data,
      include: { prescritoPor: { select: { id: true, nome: true } } },
    });
  }

  async registarAdministracao(data: {
    medicacaoId: string;
    administradoPorId: string;
    observacoes?: string;
    verificacao5Certas?: boolean;
  }) {
    const medicacao = await this.prisma.medicacao.findUnique({ where: { id: data.medicacaoId } });
    if (!medicacao) throw new NotFoundException('Medicação não encontrada');
    if (!medicacao.ativo) throw new NotFoundException('Medicação já foi descontinuada');

    return this.prisma.registoMedicacao.create({
      data: {
        medicacaoId: data.medicacaoId,
        doenteId: medicacao.doenteId,
        administradoPorId: data.administradoPorId,
        observacoes: data.observacoes,
        verificacao5Certas: data.verificacao5Certas ?? false,
      },
      include: {
        administradoPor: { select: { id: true, nome: true } },
        medicacao: { select: { nome: true, dose: true, via: true } },
      },
    });
  }

  async naoAdministrar(data: {
    medicacaoId: string;
    registadoPorId: string;
    motivo: string;
  }) {
    const medicacao = await this.prisma.medicacao.findUnique({ where: { id: data.medicacaoId } });
    if (!medicacao) throw new NotFoundException('Medicação não encontrada');

    return this.prisma.registoMedicacao.create({
      data: {
        medicacaoId: data.medicacaoId,
        doenteId: medicacao.doenteId,
        administradoPorId: data.registadoPorId,
        naoAdministrada: true,
        motivoNaoAdmin: data.motivo,
        verificacao5Certas: false,
      },
      include: {
        administradoPor: { select: { id: true, nome: true } },
        medicacao: { select: { nome: true, dose: true } },
      },
    });
  }

  async descontinuar(id: string) {
    const medicacao = await this.prisma.medicacao.findUnique({ where: { id } });
    if (!medicacao) throw new NotFoundException('Medicação não encontrada');

    return this.prisma.medicacao.update({
      where: { id },
      data: { ativo: false, terminadoEm: new Date() },
      select: { id: true, nome: true, ativo: true, terminadoEm: true },
    });
  }

  async historicoAdministracao(doenteId: string) {
    return this.prisma.registoMedicacao.findMany({
      where: { doenteId },
      include: {
        medicacao: { select: { nome: true, dose: true, via: true } },
        administradoPor: { select: { nome: true } },
      },
      orderBy: { administradoEm: 'desc' },
    });
  }

  async mar(utilizadorId: string) {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipo: string;
    const dataRef = new Date(agora);
    if (min >= 8 * 60 && min < 16 * 60 + 30) tipo = 'manha';
    else if (min >= 16 * 60 && min < 23 * 60 + 30) tipo = 'tarde';
    else { tipo = 'noite'; if (min < 8 * 60 + 30) dataRef.setDate(dataRef.getDate() - 1); }

    const diaStr = dataRef.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(diaStr + 'T23:59:59.999Z');

    const atribuicoes = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        utilizadorId,
        horarioTurno: { tipo: tipo as any, data: { gte: dataInicio, lte: dataFim } },
      },
      select: { doenteId: true },
    });

    const doenteIds = [...new Set(atribuicoes.map((a) => a.doenteId))];

    return this.prisma.medicacao.findMany({
      where: { doenteId: { in: doenteIds }, ativo: true },
      include: {
        doente: { select: { id: true, nome: true, cama: { select: { numero: true, quarto: true } } } },
        prescritoPor: { select: { nome: true } },
        registos: {
          include: { administradoPor: { select: { nome: true } } },
          orderBy: { administradoEm: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ doenteId: 'asc' }, { iniciadoEm: 'asc' }],
    });
  }

  async pendentesValidacao(page = 1, limit = 100) {
    return this.prisma.medicacao.findMany({
      where: { ativo: true, estadoValidacao: null },
      include: {
        doente: { select: { id: true, nome: true, cama: { select: { numero: true, quarto: true } } } },
        prescritoPor: { select: { nome: true, role: true } },
      },
      orderBy: { iniciadoEm: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });
  }

  async validarPrescricao(id: string, validadoPorId: string) {
    const med = await this.prisma.medicacao.findUnique({ where: { id } });
    if (!med) throw new NotFoundException('Medicação não encontrada');
    return this.prisma.medicacao.update({
      where: { id },
      data: { estadoValidacao: 'aprovada', validadoPorId, validadaEm: new Date() },
      select: { id: true, nome: true, estadoValidacao: true, validadaEm: true },
    });
  }

  async rejeitarPrescricao(id: string, validadoPorId: string, motivoRejeicao: string) {
    const med = await this.prisma.medicacao.findUnique({ where: { id } });
    if (!med) throw new NotFoundException('Medicação não encontrada');
    return this.prisma.medicacao.update({
      where: { id },
      data: { estadoValidacao: 'rejeitada', validadoPorId, validadaEm: new Date(), motivoRejeicao },
      select: { id: true, nome: true, estadoValidacao: true, motivoRejeicao: true },
    });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { classeIcps, registoNotifica } from './icps';

@Injectable()
export class EventosAdversosService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: {
    tipo: string; gravidade: string; descricao: string;
    servicoId?: string; doenteId?: string; acaoCorretiva?: string;
    ocorridoEm?: string;
    classeIcps?: string; anonimo?: boolean;
  }, registadoPorId: string) {
    // PROD-18: classe ICPS (escolhida ou deduzida do tipo) e notificação anónima — sem autor
    // guardado, para que notificar não dependa de o profissional se identificar.
    const classe = classeIcps(dto.tipo, dto.classeIcps);
    if (dto.classeIcps && !classe) throw new BadRequestException('Classe ICPS desconhecida');
    return this.prisma.eventoAdverso.create({
      data: {
        tipo: dto.tipo,
        gravidade: dto.gravidade,
        descricao: dto.descricao,
        servicoId: dto.servicoId ?? null,
        doenteId: dto.doenteId ?? null,
        acaoCorretiva: dto.acaoCorretiva ?? null,
        ocorridoEm: dto.ocorridoEm ? new Date(dto.ocorridoEm) : new Date(),
        classeIcps: classe,
        anonimo: dto.anonimo === true,
        registadoPorId: dto.anonimo === true ? null : registadoPorId,
      },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async listar(filtros: { tipo?: string; gravidade?: string; estado?: string; servicoId?: string }) {
    return this.prisma.eventoAdverso.findMany({
      where: {
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.gravidade ? { gravidade: filtros.gravidade } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.servicoId ? { servicoId: filtros.servicoId } : {}),
      },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true, role: true } },
      },
      orderBy: { ocorridoEm: 'desc' },
    });
  }

  async atualizar(id: string, dto: { acaoCorretiva?: string; estado?: string }) {
    const ev = await this.prisma.eventoAdverso.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException(`Evento adverso (ID ${id}) não encontrado`);
    return this.prisma.eventoAdverso.update({
      where: { id },
      data: {
        ...(dto.acaoCorretiva !== undefined ? { acaoCorretiva: dto.acaoCorretiva } : {}),
        ...(dto.estado ? { estado: dto.estado } : {}),
      },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  /**
   * PROD-18 — exportação para o NOTIFICA (DGS) no período: anónima (sem doente nem notificador),
   * com a classe ICPS e o grau de dano. `marcar` regista a data de exportação, para não enviar o
   * mesmo incidente duas vezes (`soNovos`).
   */
  async exportarNotifica(q: { inicio?: string; fim?: string; soNovos?: boolean; marcar?: boolean }) {
    const fim = q.fim ? new Date(`${q.fim}T00:00:00.000Z`) : new Date();
    const inicio = q.inicio ? new Date(`${q.inicio}T00:00:00.000Z`) : new Date(fim.getTime() - 31 * 86_400_000);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio >= fim) throw new BadRequestException('Período inválido');
    const eventos = await this.prisma.eventoAdverso.findMany({
      where: { ocorridoEm: { gte: inicio, lt: fim }, ...(q.soNovos ? { exportadoNotificaEm: null } : {}) },
      orderBy: { ocorridoEm: 'asc' },
      select: { id: true, tipo: true, gravidade: true, descricao: true, servicoId: true, acaoCorretiva: true, ocorridoEm: true, classeIcps: true },
    });
    if (q.marcar && eventos.length) {
      await this.prisma.eventoAdverso.updateMany({ where: { id: { in: eventos.map((e) => e.id) } }, data: { exportadoNotificaEm: new Date() } });
    }
    return { formato: 'NOTIFICA/ICPS', geradoEm: new Date().toISOString(), total: eventos.length, incidentes: eventos.map(registoNotifica) };
  }

  async indicadores() {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const fimMesPassado = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);
    const trintaDias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total30d, porTipo, porGravidade, porEstado, totalMes, totalMesPassado, abertos] = await Promise.all([
      this.prisma.eventoAdverso.count({ where: { ocorridoEm: { gte: trintaDias } } }),
      this.prisma.eventoAdverso.groupBy({
        by: ['tipo'],
        where: { ocorridoEm: { gte: trintaDias } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.eventoAdverso.groupBy({
        by: ['gravidade'],
        where: { ocorridoEm: { gte: trintaDias } },
        _count: { id: true },
      }),
      this.prisma.eventoAdverso.groupBy({
        by: ['estado'],
        _count: { id: true },
      }),
      this.prisma.eventoAdverso.count({ where: { ocorridoEm: { gte: inicioMes } } }),
      this.prisma.eventoAdverso.count({ where: { ocorridoEm: { gte: mesPassado, lte: fimMesPassado } } }),
      this.prisma.eventoAdverso.count({ where: { estado: 'aberto' } }),
    ]);

    return {
      total30d,
      porTipo: porTipo.map(g => ({ tipo: g.tipo, total: g._count.id })),
      porGravidade: porGravidade.map(g => ({ gravidade: g.gravidade, total: g._count.id })),
      porEstado: porEstado.map(g => ({ estado: g.estado, total: g._count.id })),
      totalMes,
      totalMesPassado,
      abertos,
    };
  }
}

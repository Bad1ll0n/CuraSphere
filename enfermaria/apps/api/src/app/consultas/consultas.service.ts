import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarCodigo(): string {
  return 'CON-' + Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

@Injectable()
export class ConsultasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

  // ─── Agenda semanal ───────────────────────────────────────────────────────

  async criarAgenda(dto: {
    medicoId: string; diaSemana: number; horaInicio: string; horaFim: string; duracaoSlot?: number; ativo?: boolean;
  }) {
    const ativo = dto.ativo ?? true;
    return this.prisma.agendaMedico.upsert({
      where: { medicoId_diaSemana: { medicoId: dto.medicoId, diaSemana: dto.diaSemana } },
      create: {
        medicoId: dto.medicoId, diaSemana: dto.diaSemana,
        horaInicio: dto.horaInicio, horaFim: dto.horaFim,
        duracaoSlot: 30, ativo,
      },
      update: { horaInicio: dto.horaInicio, horaFim: dto.horaFim, duracaoSlot: 30, ativo },
    });
  }

  async atualizarAgenda(id: string, dto: {
    horaInicio?: string; horaFim?: string; duracaoSlot?: number; ativo?: boolean;
  }) {
    return this.prisma.agendaMedico.update({ where: { id }, data: dto });
  }

  async removerAgenda(id: string) {
    return this.prisma.agendaMedico.delete({ where: { id } });
  }

  async agendaSemanal(medicoId: string) {
    return this.prisma.agendaMedico.findMany({
      where: { medicoId },
      orderBy: { diaSemana: 'asc' },
    });
  }

  // ─── Slots disponíveis ────────────────────────────────────────────────────

  async calcularSlots(medicoId: string, dataStr: string) {
    const data = new Date(dataStr);
    const diaSemana = data.getDay(); // 0=Dom

    const agenda = await this.prisma.agendaMedico.findUnique({
      where: { medicoId_diaSemana: { medicoId, diaSemana } },
    });

    if (!agenda || !agenda.ativo) return [];

    const [hIni, mIni] = agenda.horaInicio.split(':').map(Number);
    const [hFim, mFim] = agenda.horaFim.split(':').map(Number);
    const inicioMin = hIni * 60 + mIni;
    const fimMin    = hFim * 60 + mFim;

    // Gerar todos os slots
    const slots: { dataHora: Date; disponivel: boolean }[] = [];
    for (let m = inicioMin; m + agenda.duracaoSlot <= fimMin; m += agenda.duracaoSlot) {
      const slotHora = new Date(data);
      slotHora.setHours(Math.floor(m / 60), m % 60, 0, 0);
      slots.push({ dataHora: slotHora, disponivel: true });
    }

    // Buscar consultas agendadas nesse dia
    const inicioData = new Date(data); inicioData.setHours(0, 0, 0, 0);
    const fimData    = new Date(data); fimData.setHours(23, 59, 59, 999);

    const ocupadas = await this.prisma.consulta.findMany({
      where: { medicoId, estado: 'agendada', dataHora: { gte: inicioData, lte: fimData } },
      select: { dataHora: true, duracao: true },
    });

    // Marcar slots ocupados
    return slots.map((slot) => {
      const slotMs = slot.dataHora.getTime();
      const ocupado = ocupadas.some((c) => {
        const cIni = c.dataHora.getTime();
        const cFim = cIni + c.duracao * 60_000;
        return slotMs >= cIni && slotMs < cFim;
      });
      return { ...slot, disponivel: !ocupado };
    });
  }

  // ─── Marcações (Consulta) ─────────────────────────────────────────────────

  async agendar(dto: {
    doenteId?: string; nomeDoente?: string; medicoId: string; especialidade: string;
    dataHora: string; duracao?: number; notas?: string;
  }) {
    const duracao = dto.duracao ?? 30;
    const dataHora = new Date(dto.dataHora);
    const dataFim  = new Date(dataHora.getTime() + duracao * 60_000);

    // Anti-dupla-marcação
    const conflito = await this.prisma.consulta.findFirst({
      where: {
        medicoId: dto.medicoId,
        estado: 'agendada',
        dataHora: { gte: dataHora, lt: dataFim },
      },
    });
    if (conflito) throw new ConflictException('Médico já tem consulta agendada nesse horário');

    // Gerar código único
    let codigo: string;
    let tentativas = 0;
    do {
      codigo = gerarCodigo();
      tentativas++;
      if (tentativas > 20) throw new Error('Não foi possível gerar código único');
    } while (await this.prisma.consulta.findUnique({ where: { codigo } }));

    return this.prisma.consulta.create({
      data: {
        doenteId: dto.doenteId ?? null,
        nomeDoente: dto.nomeDoente ?? null,
        medicoId: dto.medicoId,
        especialidade: dto.especialidade,
        dataHora,
        duracao,
        notas: dto.notas ?? null,
        codigo,
      },
      include: this.includeRelations(),
    });
  }

  async listar(medicoId?: string, especialidade?: string, data?: string, doenteId?: string) {
    const where: any = {};
    if (medicoId) where.medicoId = medicoId;
    if (especialidade) where.especialidade = especialidade;
    if (doenteId) where.doenteId = doenteId;
    if (data) {
      const d = new Date(data); const fim = new Date(d); fim.setDate(fim.getDate() + 1);
      where.dataHora = { gte: d, lt: fim };
    }
    return this.prisma.consulta.findMany({ where, orderBy: { dataHora: 'asc' }, include: this.includeRelations() });
  }

  async agendaMedico(medicoId: string) {
    return this.prisma.consulta.findMany({
      where: { medicoId, estado: 'agendada', dataHora: { gte: new Date() } },
      orderBy: { dataHora: 'asc' },
      include: this.includeRelations(),
    });
  }

  async buscarPorCodigo(codigo: string) {
    const c = await this.prisma.consulta.findUnique({
      where: { codigo },
      include: this.includeRelations(),
    });
    if (!c) throw new NotFoundException('Marcação não encontrada');
    return c;
  }

  async realizar(id: string, dto: { notas?: string; diagnostico?: string; proximaConsulta?: string }, userId: string) {
    await this.buscar(id);
    const consulta = await this.prisma.consulta.update({
      where: { id },
      data: {
        estado: 'realizada',
        notas: dto.notas ?? null,
        diagnostico: dto.diagnostico ?? null,
        proximaConsulta: dto.proximaConsulta ? new Date(dto.proximaConsulta) : null,
      },
      include: {
        ...this.includeRelations(),
        atosConsulta: { include: { ato: true } },
      },
    });

    // Auto-faturação (só para doentes registados)
    if (consulta.doenteId) {
      let episodio = await this.prisma.episodioFaturacao.findUnique({ where: { consultaId: id } });
      if (!episodio) {
        episodio = await this.prisma.episodioFaturacao.create({
          data: {
            doenteId: consulta.doenteId,
            estado: 'pendente',
            consultaId: id,
            totalBase: 0,
            totalCobrado: 0,
            criadoPorId: userId,
          },
        });
      }

      const itens: { descricao: string; categoria: string; quantidade: number; precoUnitario: number; total: number }[] = [];

      // Ato-base da especialidade
      const atoBase = await this.prisma.atoClinico.findFirst({
        where: { especialidade: consulta.especialidade, ativo: true },
      });
      if (atoBase) {
        itens.push({ descricao: atoBase.descricao, categoria: atoBase.categoria,
          quantidade: 1, precoUnitario: atoBase.precoBase, total: atoBase.precoBase });
      }

      // Atos adicionados pelo médico
      for (const ac of (consulta as any).atosConsulta ?? []) {
        itens.push({ descricao: ac.ato.descricao, categoria: ac.ato.categoria,
          quantidade: ac.quantidade, precoUnitario: ac.precoUnitario,
          total: ac.quantidade * ac.precoUnitario });
      }

      if (itens.length > 0) {
        await this.prisma.itemFatura.createMany({
          data: itens.map((i) => ({ ...i, episodioFaturacaoId: episodio.id })),
        });
        const soma = itens.reduce((s, i) => s + i.total, 0);
        await this.prisma.episodioFaturacao.update({
          where: { id: episodio.id },
          data: { totalBase: soma, totalCobrado: soma },
        });
      }
    }

    return consulta;
  }

  async adicionarAto(consultaId: string, dto: { atoId: string; quantidade?: number }) {
    const ato = await this.prisma.atoClinico.findUniqueOrThrow({ where: { id: dto.atoId } });
    return this.prisma.atoConsulta.create({
      data: {
        consultaId,
        atoId: dto.atoId,
        quantidade: dto.quantidade ?? 1,
        precoUnitario: ato.precoBase,
      },
      include: { ato: true },
    });
  }

  async removerAto(consultaId: string, atoConsultaId: string) {
    return this.prisma.atoConsulta.deleteMany({
      where: { id: atoConsultaId, consultaId },
    });
  }

  async listarAtos(consultaId: string) {
    return this.prisma.atoConsulta.findMany({
      where: { consultaId },
      include: { ato: true },
    });
  }

  async atualizarEstado(id: string, estado: string) {
    await this.buscar(id);
    return this.prisma.consulta.update({ where: { id }, data: { estado: estado as any } });
  }

  async checkin(id: string) {
    const consulta = await this.buscar(id);
    if (consulta.checkinEm) return { consulta, ticket: null, jaFezCheckin: true };

    const atualizada = await this.prisma.consulta.update({
      where: { id },
      data: { checkinEm: new Date() },
      include: this.includeRelations(),
    });

    const nomeUtente = consulta.nomeDoente ?? (atualizada.doente as any)?.nome ?? undefined;
    const ticket = await this.ticketsService.tirarSenha({
      tipo: 'consulta',
      prioridade: 'normal',
      nomeUtente,
    });

    return { consulta: atualizada, ticket, jaFezCheckin: false };
  }

  private async buscar(id: string) {
    const c = await this.prisma.consulta.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!c) throw new NotFoundException('Consulta não encontrada');
    return c;
  }

  private includeRelations() {
    return {
      doente: { select: { id: true, nome: true, dataNascimento: true, numeroProcesso: true } },
      medico: { select: { id: true, nome: true, role: true, subRole: true } },
    } as any;
  }
}

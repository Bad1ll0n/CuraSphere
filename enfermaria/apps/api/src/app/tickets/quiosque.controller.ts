import { Controller, Post, Get, Param, Query, Body, Sse, NotFoundException, BadRequestException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { map } from 'rxjs';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('quiosque')
export class QuiosqueController {
  constructor(
    private readonly service: TicketsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  tirarSenha(
    @Body()
    body: {
      tipo: string;
      prioridade?: string;
      nomeUtente?: string;
      telefone?: string;
    },
  ) {
    return this.service.tirarSenha(body);
  }

  @Get('fila')
  fila() {
    return this.service.listarFila();
  }

  @Get('ultimos')
  ultimos(@Query('n') n?: string) {
    return this.service.ultimos(n ? parseInt(n, 10) : 10);
  }

  @Get('stats')
  stats() {
    return this.service.statsHoje();
  }

  // ─── NIF ──────────────────────────────────────────────────────────────────

  @Get('paciente')
  async buscarPaciente(@Query('nif') nif: string) {
    if (!nif) throw new BadRequestException('NIF obrigatório');
    const ficha = await this.prisma.ficheiroPessoalDoente.findFirst({
      where: { nif: nif.trim() },
      include: { doente: { select: { id: true, nome: true, dataNascimento: true } } },
    });
    if (!ficha) throw new NotFoundException('Nenhum utente encontrado com esse NIF');
    return {
      id: ficha.doente.id,
      nome: ficha.doente.nome,
      dataNascimento: ficha.doente.dataNascimento,
    };
  }

  @Get('paciente/:doenteId/marcacoes-hoje')
  async marcacoesHoje(@Param('doenteId') doenteId: string) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    return this.prisma.consulta.findMany({
      where: { doenteId, estado: 'agendada', dataHora: { gte: hoje, lt: amanha } },
      include: { medico: { select: { nome: true, especialidade: true } } },
      orderBy: { dataHora: 'asc' },
    });
  }

  // ─── Marcações ───────────────────────────────────────────────────────────

  @Get('marcacao')
  async buscarMarcacao(@Query('codigo') codigo: string) {
    if (!codigo) throw new BadRequestException('Código obrigatório');
    const consulta = await this.prisma.consulta.findUnique({
      where: { codigo: codigo.toUpperCase() },
      include: {
        doente: { select: { id: true, nome: true, numeroProcesso: true } },
        medico: { select: { id: true, nome: true, especialidade: true } },
      },
    });
    if (!consulta) throw new NotFoundException('Marcação não encontrada');
    if (consulta.estado !== 'agendada') throw new BadRequestException(`Marcação com estado: ${consulta.estado}`);
    return consulta;
  }

  @Post('marcacao/:id/checkin')
  async checkinMarcacao(@Param('id') id: string) {
    const consulta = await this.prisma.consulta.findUnique({
      where: { id },
      include: {
        doente: { select: { nome: true } },
      },
    });
    if (!consulta) throw new NotFoundException('Marcação não encontrada');
    if (consulta.checkinEm) {
      return { jaFezCheckin: true, consulta };
    }

    const [atualizada, ticket] = await Promise.all([
      this.prisma.consulta.update({
        where: { id },
        data: { checkinEm: new Date() },
        include: {
          medico: { select: { id: true, nome: true } },
          doente: { select: { id: true, nome: true } },
        },
      }),
      this.service.tirarSenha({
        tipo: 'consulta',
        prioridade: 'normal',
        nomeUtente: consulta.nomeDoente ?? (consulta.doente as any)?.nome ?? undefined,
      }),
    ]);

    return { jaFezCheckin: false, consulta: atualizada, ticket };
  }

  @Sse('eventos')
  @SkipThrottle()
  eventos() {
    return this.service.eventStream().pipe(
      map((evento) => ({
        type: evento.type ?? 'mensagem',
        data: evento.data,
      })),
    );
  }
}

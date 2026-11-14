import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { VigilanciaService } from '../vigilancia/vigilancia.service';
import { chaveDiaClinico } from '../common/dia-clinico.helper';
import { temPapel } from '../common/roles.util';

export type Turno = 'manha' | 'tarde' | 'noite';
export interface ConteudoIsbar { identificacao: string; situacao: string; antecedentes: string; avaliacao: string; recomendacoes: string }

const TZ = process.env['TZ_CLINICO'] ?? 'Europe/Lisbon';
const PAPEIS_SERVICO = ['chefe_enfermeiros', 'chefe_turno', 'chefe_medicos', 'direcao'];

/** Turno e dia (do hospital) de um instante: manhã 08–16, tarde 16–24, noite 00–08. */
export function turnoDe(instante: Date = new Date()): { data: string; turno: Turno } {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(instante));
  const turno: Turno = h >= 8 && h < 16 ? 'manha' : h >= 16 ? 'tarde' : 'noite';
  return { data: chaveDiaClinico(instante), turno };
}

/** O turno anterior a (data, turno) — de quem se recebe a passagem. */
export function turnoAnterior(data: string, turno: Turno): { data: string; turno: Turno } {
  if (turno === 'tarde') return { data, turno: 'manha' };
  if (turno === 'noite') {
    const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
    return { data: d.toISOString().slice(0, 10), turno: 'tarde' };
  }
  return { data, turno: 'noite' };
}

const fmtHora = (d: Date) => d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ });
const juntar = (xs: (string | null | undefined | false)[], sep = ' ') => xs.filter(Boolean).join(sep);

/**
 * UX-22 — passagem de turno ÚNICA, por doente, estruturada em ISBAR (recomendação DGS para as
 * transições de cuidados). Substitui as duas passagens que existiam (lista + "Pro" com outro
 * backend). O conteúdo é pré-preenchido a partir do registo e editado por quem entrega; quem
 * entra confirma a receção.
 */
@Injectable()
export class PassagemIsbarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly vigilancia: VigilanciaService,
  ) {}

  /** Doentes do turno: do serviço (chefias, ou quem o pedir) ou os atribuídos ao utilizador. */
  async listar(utilizador: { sub: string; role: string; subRole?: string | null }, servico?: string) {
    const { data, turno } = turnoDe();
    const anterior = turnoAnterior(data, turno);
    let doenteIds: string[];
    if (servico) {
      const ds = await this.prisma.doente.findMany({
        where: { ativo: true, estadoRegisto: 'internado', cama: { servico } }, select: { id: true },
      });
      doenteIds = ds.map((d) => d.id);
    } else {
      const agora = new Date();
      const [a, h] = await Promise.all([
        this.prisma.atribuicaoDoente.findMany({
          where: { enfermeiroId: utilizador.sub, turno: { dataInicio: { lte: agora }, dataFim: { gte: agora } } }, select: { doenteId: true },
        }),
        this.prisma.atribuicaoHorarioTurno.findMany({
          where: { utilizadorId: utilizador.sub, horarioTurno: { data: { gte: new Date(agora.getTime() - 86_400_000) } } }, select: { doenteId: true },
        }),
      ]);
      doenteIds = [...new Set([...a, ...h].map((x) => x.doenteId))];
    }
    const [doentes, passagens, paraReceber] = await Promise.all([
      this.prisma.doente.findMany({
        where: { id: { in: doenteIds }, ativo: true },
        select: { id: true, nome: true, numeroProcesso: true, estado: true, cama: { select: { numero: true, quarto: true, servico: true } } },
        orderBy: [{ cama: { quarto: 'asc' } }, { cama: { numero: 'asc' } }],
      }),
      this.prisma.passagemIsbar.findMany({ where: { doenteId: { in: doenteIds }, data, turno } }),
      this.prisma.passagemIsbar.findMany({
        where: { doenteId: { in: doenteIds }, data: anterior.data, turno: anterior.turno, estado: 'entregue' },
      }),
    ]);
    return {
      data, turno, anterior, podeVerServico: temPapel(utilizador, PAPEIS_SERVICO),
      doentes: doentes.map((d) => ({
        doente: d,
        passagem: passagens.find((p) => p.doenteId === d.id) ?? null,
        recebida: paraReceber.find((p) => p.doenteId === d.id) ?? null,
      })),
    };
  }

  /** Pré-preenchimento ISBAR a partir do registo clínico (o enfermeiro revê e edita). */
  async sugestao(doenteId: string): Promise<ConteudoIsbar> {
    const d = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        id: true, nome: true, numeroProcesso: true, dataNascimento: true, diagnosticoPrincipal: true, estado: true,
        emIsolamento: true, motivoIsolamento: true, dataAdmissao: true, dataAltaPrevista: true, avaliacaoAlergias: true,
        cama: { select: { numero: true, quarto: true, servico: true } },
        alergias: { where: { deletedAt: null }, select: { alergenio: true, severidade: true } },
        sinaisVitais: {
          orderBy: { data: 'desc' }, take: 1,
          select: { data: true, news2: true, pressaoSistolica: true, pressaoDiastolica: true, pulso: true, saturacaoO2: true, temperatura: true, frequenciaRespiratoria: true, dor: true, escalaDor: true, avpu: true },
        },
        alertasClinicos: { where: { lido: false }, select: { mensagem: true }, orderBy: { criadoEm: 'desc' }, take: 3 },
        sinalizacoes: { where: { resolvida: false }, select: { motivo: true, nivelUrgencia: true }, take: 2 },
        alertasSepsis: { where: { resolvido: false }, select: { criterio: true, score: true }, take: 1 },
        problemas: { where: { estado: { in: ['ativo', 'cronico'] } }, select: { descricao: true }, take: 6 },
        dispositivosInvasivos: { where: { ativo: true }, select: { tipo: true, localizacao: true, dataInsercao: true } },
        avaliacoesRisco: { orderBy: { criadaEm: 'desc' }, take: 4, select: { tipo: true, pontuacao: true, risco: true } },
        tarefas: { where: { estado: { in: ['pendente', 'em_progresso'] } }, select: { descricao: true, prioridade: true }, take: 6 },
        medicacoes: { where: { ativo: true, deletedAt: null }, select: { nome: true, estadoValidacao: true } },
      },
    });
    if (!d) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const ep = await this.prisma.episodioInternamento.findFirst({ where: { doenteId, estado: 'ativo' }, select: { numero: true, dataAdmissao: true } });
    const idade = d.dataNascimento ? Math.floor((Date.now() - d.dataNascimento.getTime()) / (365.25 * 86_400_000)) : null;
    const dias = Math.max(0, Math.floor((Date.now() - (ep?.dataAdmissao ?? d.dataAdmissao).getTime()) / 86_400_000));
    const sv = d.sinaisVitais[0];
    const braden = d.avaliacoesRisco.find((r) => r.tipo === 'braden');
    const morse = d.avaliacoesRisco.find((r) => r.tipo === 'morse');
    const emAtraso = (await this.vigilancia.doDoente(doenteId)).filter((o) => o.atrasoMinutos > 0);
    const alergias = d.alergias.length
      ? d.alergias.map((a) => `${a.alergenio} (${a.severidade})`).join(', ')
      : d.avaliacaoAlergias === 'sem_alergias_conhecidas' ? 'sem alergias conhecidas' : 'NÃO AVALIADAS';

    return {
      identificacao: juntar([
        `${d.nome}${idade != null ? `, ${idade} anos` : ''}, processo ${d.numeroProcesso}.`,
        d.cama ? `Cama ${d.cama.quarto}/${d.cama.numero}${d.cama.servico ? ` (${d.cama.servico})` : ''}.` : 'Sem cama.',
        `Internado há ${dias} dia(s)${ep ? ` (episódio n.º ${ep.numero})` : ''}.`,
        `Alergias: ${alergias}.`,
      ]),
      situacao: juntar([
        `Diagnóstico: ${d.diagnosticoPrincipal ?? '—'}. Estado: ${d.estado}.`,
        sv && `NEWS2 ${sv.news2 ?? '?'} (${fmtHora(sv.data)}).`,
        sv?.dor != null && `Dor ${sv.dor}${sv.escalaDor === 'cpot' ? '/8 CPOT' : '/10'}.`,
        d.alertasSepsis[0] && `ALERTA DE SÉPSIS (${d.alertasSepsis[0].criterio}, score ${d.alertasSepsis[0].score}).`,
        ...d.sinalizacoes.map((s) => `Sinalizado${s.nivelUrgencia === 'urgente' ? ' (URGENTE)' : ''}: ${s.motivo}.`),
        ...d.alertasClinicos.map((a) => `Alerta: ${a.mensagem}.`),
      ]),
      antecedentes: juntar([
        d.problemas.length ? `Problemas: ${d.problemas.map((p) => p.descricao).join('; ')}.` : null,
        d.emIsolamento && `Em isolamento${d.motivoIsolamento ? ` (${d.motivoIsolamento})` : ''}.`,
        d.dispositivosInvasivos.length
          ? `Dispositivos: ${d.dispositivosInvasivos.map((x) => `${x.tipo}${x.localizacao ? ` ${x.localizacao}` : ''} desde ${x.dataInsercao.toLocaleDateString('pt-PT')}`).join('; ')}.`
          : null,
      ]) || 'Sem antecedentes relevantes registados.',
      avaliacao: juntar([
        sv && `Últimos SV: TA ${sv.pressaoSistolica ?? '?'}/${sv.pressaoDiastolica ?? '?'}, FC ${sv.pulso ?? '?'}, SpO₂ ${sv.saturacaoO2 ?? '?'}%, T ${sv.temperatura ?? '?'} °C, FR ${sv.frequenciaRespiratoria ?? '?'}${sv.avpu ? `, AVPU ${sv.avpu}` : ''}.`,
        braden && `Braden ${braden.pontuacao} (${braden.risco}).`,
        morse && `Morse ${morse.pontuacao} (${morse.risco}).`,
        emAtraso.length ? `Em atraso: ${emAtraso.map((o) => o.motivo).join('; ')}.` : null,
      ]) || 'Sem avaliações registadas.',
      recomendacoes: juntar([
        d.tarefas.length ? `Tarefas pendentes: ${d.tarefas.map((t) => `${t.prioridade === 'urgente' ? '[URGENTE] ' : ''}${t.descricao}`).join('; ')}.` : null,
        d.medicacoes.length ? `${d.medicacoes.length} prescrição(ões) activa(s)${d.medicacoes.some((m) => m.estadoValidacao === 'pendente') ? ', com validação farmacêutica pendente' : ''}.` : null,
        d.dataAltaPrevista && `Alta prevista: ${d.dataAltaPrevista.toLocaleDateString('pt-PT')}.`,
      ]) || 'Manter vigilância.',
    };
  }

  /** Guarda (e opcionalmente entrega) a passagem deste turno para o doente. */
  async guardar(doenteId: string, autorId: string, dto: ConteudoIsbar & { entregar?: boolean }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true, ativo: true, cama: { select: { servico: true } } } });
    if (!doente || !doente.ativo) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado ou com alta`);
    const { data, turno } = turnoDe();
    const existente = await this.prisma.passagemIsbar.findUnique({ where: { doenteId_data_turno: { doenteId, data, turno } } });
    if (existente?.estado === 'recebida') throw new ConflictException('Esta passagem já foi recebida por quem entrou no turno e não pode ser alterada.');
    const ep = await this.prisma.episodioInternamento.findFirst({ where: { doenteId, estado: 'ativo' }, select: { id: true } });
    const conteudo = {
      identificacao: dto.identificacao.trim(), situacao: dto.situacao.trim(), antecedentes: dto.antecedentes.trim(),
      avaliacao: dto.avaliacao.trim(), recomendacoes: dto.recomendacoes.trim(),
    };
    if (dto.entregar && Object.values(conteudo).some((v) => !v)) throw new BadRequestException('Preencha as cinco secções ISBAR antes de entregar.');
    const estado = dto.entregar ? 'entregue' : (existente?.estado ?? 'rascunho');
    return this.prisma.passagemIsbar.upsert({
      where: { doenteId_data_turno: { doenteId, data, turno } },
      create: {
        tenantId: this.tenant.tenantId, doenteId, episodioId: ep?.id ?? null, servico: doente.cama?.servico ?? null,
        data, turno, autorId, ...conteudo, estado, entregueEm: dto.entregar ? new Date() : null,
      },
      update: { ...conteudo, autorId, estado, ...(dto.entregar && { entregueEm: new Date() }) },
    });
  }

  /** Quem entra no turno confirma que recebeu (e leu) a passagem. */
  async receber(id: string, utilizadorId: string) {
    const p = await this.prisma.passagemIsbar.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Passagem não encontrada');
    if (p.autorId === utilizadorId) throw new BadRequestException('Quem entrega a passagem não pode confirmar a receção.');
    if (p.estado !== 'entregue') throw new BadRequestException(p.estado === 'recebida' ? 'A passagem já foi recebida.' : 'A passagem ainda não foi entregue.');
    const r = await this.prisma.passagemIsbar.updateMany({
      where: { id, estado: 'entregue' },
      data: { estado: 'recebida', recebidaPorId: utilizadorId, recebidaEm: new Date() },
    });
    if (r.count !== 1) throw new ConflictException('A passagem mudou entretanto. Recarregue.');
    return this.prisma.passagemIsbar.findUnique({ where: { id } });
  }

  historico(doenteId: string) {
    return this.prisma.passagemIsbar.findMany({ where: { doenteId }, orderBy: [{ data: 'desc' }, { criadaEm: 'desc' }], take: 15 });
  }
}

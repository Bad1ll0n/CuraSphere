import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { authenticator } = require('otplib') as any;
import * as crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { RedisService } from '../redis/redis.service';
import { StewardshipService } from '../stewardship/stewardship.service';
import interacoesJson from './interacoes.json';

export interface Interacao { med1: string; med2: string; severidade: string; descricao: string; }
const INTERACOES: Interacao[] = interacoesJson as Interacao[];

function parsearFrequenciaHoras(frequencia: string): number | null {
  const m = frequencia.match(/(\d+)\s*\/\s*(\d+)\s*h/i);
  if (m) return parseInt(m[2], 10);
  if (/^(sos|em\s+sos|se\s+necessário|s\.o\.s\.?)/i.test(frequencia)) return null;
  if (/^(contínuo|perfus)/i.test(frequencia)) return null;
  return null;
}

function verificarInteracao(nomeMed: string, medicacoesAtivas: string[]): Interacao[] {
  const medNorm = nomeMed.toLowerCase();
  const encontradas: Interacao[] = [];
  for (const med of medicacoesAtivas) {
    const ativaNorm = med.toLowerCase();
    for (const interacao of INTERACOES) {
      const m1 = interacao.med1.toLowerCase();
      const m2 = interacao.med2.toLowerCase();
      const matchNovo = medNorm.includes(m1) || m1.includes(medNorm.split(' ')[0]);
      const matchAtivo = ativaNorm.includes(m2) || m2.includes(ativaNorm.split(' ')[0]);
      const matchNovo2 = medNorm.includes(m2) || m2.includes(medNorm.split(' ')[0]);
      const matchAtivo2 = ativaNorm.includes(m1) || m1.includes(ativaNorm.split(' ')[0]);
      if ((matchNovo && matchAtivo) || (matchNovo2 && matchAtivo2)) {
        if (!encontradas.find((e) => e.med1 === interacao.med1 && e.med2 === interacao.med2)) {
          encontradas.push(interacao);
        }
      }
    }
  }
  return encontradas;
}

@Injectable()
export class MedicacaoService {
  private readonly logger = new Logger(MedicacaoService.name);
  private readonly anthropic = new Anthropic();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly redis: RedisService,
    private readonly stewardship: StewardshipService,
  ) {}

  private async verificarInteracaoIA(novoNome: string, ativas: string[]): Promise<{ bloqueante: boolean; aviso: string | null }> {
    if (ativas.length === 0) return { bloqueante: false, aviso: null };
    try {
      const msg = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        temperature: 0.05 as any,
        system: [{ type: 'text' as const, text: 'És um sistema de verificação de interações medicamentosas clínicas. Responde APENAS com JSON válido: { "interacao": boolean, "severidade": "nenhuma|minor|moderada|grave|contraindicada", "descricao": "string curta ou null" }. Sê conservador — só assinala interações clinicamente documentadas.', cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Novo fármaco: ${novoNome}\nAtivos: ${ativas.join(', ')}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
      const r = JSON.parse(texto);
      if (!r.interacao || r.severidade === 'nenhuma') return { bloqueante: false, aviso: null };
      const aviso = `${(r.severidade as string).toUpperCase()}: ${r.descricao ?? 'Interação detectada'}`;
      return { bloqueante: r.severidade === 'contraindicada', aviso };
    } catch (err) {
      this.logger.warn('IA interação falhou (fallback para JSON)', (err as any)?.message);
      const jsonInteracoes = verificarInteracao(novoNome, ativas);
      if (jsonInteracoes.length === 0) return { bloqueante: false, aviso: null };
      const pior = jsonInteracoes.find((i) => i.severidade === 'contraindicada')
        ?? jsonInteracoes.find((i) => i.severidade === 'grave')
        ?? jsonInteracoes[0];
      return {
        bloqueante: pior.severidade === 'contraindicada',
        aviso: `${pior.severidade.toUpperCase()}: ${pior.descricao}`,
      };
    }
  }

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
    forcarApesarDeAlergia?: boolean;
    justificativaOverride?: string;
  }) {
    // Verificação IA de interações antes da transação (não-bloqueante em caso de falha)
    const ativasPreCheck = await this.prisma.medicacao.findMany({
      where: { doenteId: data.doenteId, ativo: true, deletedAt: null },
      select: { nome: true },
    });
    const iaCheck = await this.verificarInteracaoIA(data.nome, ativasPreCheck.map(m => m.nome));
    if (iaCheck.bloqueante) {
      throw new ConflictException(`INTERAÇÃO CONTRAINDICADA: ${iaCheck.aviso}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const doente = await tx.doente.findUnique({ where: { id: data.doenteId } });
      if (!doente) throw new NotFoundException(`Doente (ID ${data.doenteId}) não encontrado`);

      if (!data.forcarApesarDeAlergia) {
        const alergias = await tx.alergia.findMany({ where: { doenteId: data.doenteId } });
        const nomeNorm = data.nome.toLowerCase();
        const alergiaMatch = alergias.find((a) => {
          const alg = a.alergenio.toLowerCase();
          const palavrasMed = nomeNorm.split(/\s+/).filter((w) => w.length > 3);
          const palavrasAlg = alg.split(/\s+/).filter((w) => w.length > 3);
          return (
            palavrasAlg.some((w) => nomeNorm.includes(w)) ||
            palavrasMed.some((w) => alg.includes(w))
          );
        });
        if (alergiaMatch) {
          throw new ConflictException(
            `ALERGIA: ${doente.nome} tem alergia registada a "${alergiaMatch.alergenio}" (severidade: ${alergiaMatch.severidade}). Para prescrever mesmo assim, envie forcarApesarDeAlergia=true com justificativaOverride.`,
          );
        }
      }

      const medicacoesAtivas = await tx.medicacao.findMany({
        where: { doenteId: data.doenteId, ativo: true },
        select: { nome: true },
      });
      const interacoesDetectadas = verificarInteracao(data.nome, medicacoesAtivas.map((m) => m.nome));

      const { forcarApesarDeAlergia: _, justificativaOverride: __, ...dadosMedicacao } = data;
      const medicacao = await tx.medicacao.create({
        data: dadosMedicacao,
        include: { prescritoPor: { select: { id: true, nome: true } } },
      });

      // Registar em stewardship se for antibiótico (assíncrono, não bloqueia a transação)
      this.stewardship.registarSeAntibiotico(data.doenteId, medicacao.id, data.nome)
        .catch((err) => this.logger.warn(`Stewardship registo falhou: ${err?.message}`));

      return { ...medicacao, avisoInteracoes: interacoesDetectadas, avisoIA: iaCheck.aviso };
    }, { isolationLevel: 'Serializable' });
  }

  async verificarInteracoes(doenteId: string, nomeMed: string): Promise<Interacao[]> {
    const medicacoesAtivas = await this.prisma.medicacao.findMany({
      where: { doenteId, ativo: true },
      select: { nome: true },
    });
    return verificarInteracao(nomeMed, medicacoesAtivas.map((m) => m.nome));
  }

  async registarAdministracao(data: {
    medicacaoId: string;
    doenteId?: string;
    administradoPorId: string;
    observacoes?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const medicacao = await tx.medicacao.findUnique({
        where: { id: data.medicacaoId },
        include: {
          registos: {
            where: { naoAdministrada: false },
            orderBy: { administradoEm: 'desc' },
            take: 1,
            select: { administradoEm: true },
          },
        },
      });
      if (!medicacao) throw new NotFoundException(`Medicação (ID ${data.medicacaoId}) não encontrada`);
      if (!medicacao.ativo) throw new NotFoundException(`Medicação (ID ${data.medicacaoId}) já foi descontinuada`);

      // 1. Doente certo — validar se doenteId foi enviado
      if (data.doenteId && data.doenteId !== medicacao.doenteId) {
        throw new BadRequestException(
          '5 certas: doente incorrecto — esta medicação não pertence ao doente indicado',
        );
      }

      // 4. Hora certa — verificar janela de frequência
      const intervaloHoras = parsearFrequenciaHoras(medicacao.frequencia);
      if (intervaloHoras !== null && medicacao.registos.length > 0) {
        const ultimaAdm = medicacao.registos[0].administradoEm;
        const horasDesdeUltima = (Date.now() - ultimaAdm.getTime()) / 3_600_000;
        const TOLERANCIA_H = 1;
        if (horasDesdeUltima < intervaloHoras - TOLERANCIA_H) {
          throw new BadRequestException(
            `5 certas: administração prematura — frequência ${medicacao.frequencia}, ` +
            `última administração há ${horasDesdeUltima.toFixed(1)}h (mínimo ${(intervaloHoras - TOLERANCIA_H).toFixed(1)}h)`,
          );
        }
      }

      return tx.registoMedicacao.create({
        data: {
          medicacaoId: data.medicacaoId,
          doenteId: medicacao.doenteId,
          administradoPorId: data.administradoPorId,
          observacoes: data.observacoes,
          verificacao5Certas: true,
        },
        include: {
          administradoPor: { select: { id: true, nome: true } },
          medicacao: { select: { nome: true, dose: true, via: true } },
        },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async naoAdministrar(data: {
    medicacaoId: string;
    registadoPorId: string;
    motivo: string;
  }) {
    const medicacao = await this.prisma.medicacao.findUnique({ where: { id: data.medicacaoId } });
    if (!medicacao) throw new NotFoundException(`Medicação (ID ${data.medicacaoId}) não encontrada`);

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
    if (!medicacao) throw new NotFoundException(`Medicação (ID ${id}) não encontrada`);

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
    if (!med) throw new NotFoundException(`Medicação (ID ${id}) não encontrada`);
    return this.prisma.medicacao.update({
      where: { id },
      data: { estadoValidacao: 'aprovada', validadoPorId, validadaEm: new Date() },
      select: { id: true, nome: true, estadoValidacao: true, validadaEm: true },
    });
  }

  async rejeitarPrescricao(id: string, validadoPorId: string, motivoRejeicao: string) {
    const med = await this.prisma.medicacao.findUnique({ where: { id } });
    if (!med) throw new NotFoundException(`Medicação (ID ${id}) não encontrada`);
    return this.prisma.medicacao.update({
      where: { id },
      data: { estadoValidacao: 'rejeitada', validadoPorId, validadaEm: new Date(), motivoRejeicao },
      select: { id: true, nome: true, estadoValidacao: true, motivoRejeicao: true },
    });
  }

  // ── Propostas de prescrição por enfermeiro ───────────────────────────────────

  async proporPrescricao(data: {
    doenteId: string;
    nome: string;
    dose: string;
    via: string;
    frequencia: string;
    prescritoPorId: string;
    observacoes?: string;
  }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: data.doenteId } });
    if (!doente) throw new NotFoundException(`Doente (ID ${data.doenteId}) não encontrado`);

    const medicacao = await this.prisma.medicacao.create({
      data: {
        doenteId: data.doenteId,
        nome: data.nome,
        dose: data.dose,
        via: data.via,
        frequencia: data.frequencia,
        prescritoPorId: data.prescritoPorId,
        ativo: false,
        estadoValidacao: 'pendente_medico',
      },
      include: {
        prescritoPor: { select: { id: true, nome: true, role: true } },
        doente: { select: { id: true, nome: true } },
      },
    });

    // Notificar os médicos do serviço do doente
    const medicos = await this.prisma.utilizador.findMany({
      where: { role: 'medico' },
      select: { id: true },
    });
    for (const medico of medicos) {
      this.notificacoes.enviarParaUtilizador(
        medico.id,
        'Proposta de prescrição aguarda aprovação',
        `Enfermeiro propôs ${data.nome} (${data.dose}) para ${doente.nome}. Aguarda a tua aprovação.`,
        { medicacaoId: medicacao.id, doenteId: data.doenteId },
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }

    return medicacao;
  }

  async pendentesAprovacaoMedico(servico?: string) {
    return this.prisma.medicacao.findMany({
      where: {
        estadoValidacao: 'pendente_medico',
        ativo: false,
      },
      include: {
        doente: { select: { id: true, nome: true, cama: { select: { numero: true, quarto: true } } } },
        prescritoPor: { select: { id: true, nome: true, role: true } },
      },
      orderBy: { iniciadoEm: 'asc' },
    });
  }

  async aprovarPrescricaoMedico(id: string, aprovadoPorId: string) {
    const med = await this.prisma.medicacao.findUnique({
      where: { id },
      include: { prescritoPor: { select: { id: true, nome: true } }, doente: { select: { nome: true } } },
    });
    if (!med) throw new NotFoundException(`Medicação (ID ${id}) não encontrada`);
    if (med.estadoValidacao !== 'pendente_medico') {
      throw new BadRequestException(`Prescrição não está pendente de aprovação médica (estado: ${med.estadoValidacao})`);
    }

    const resultado = await this.prisma.medicacao.update({
      where: { id },
      data: { ativo: true, estadoValidacao: 'aprovada', validadoPorId: aprovadoPorId, validadaEm: new Date() },
      include: { prescritoPor: { select: { id: true, nome: true } } },
    });

    this.notificacoes.enviarParaUtilizador(
      med.prescritoPorId,
      'Proposta de prescrição aprovada',
      `A tua proposta de ${med.nome} (${med.dose}) para ${med.doente.nome} foi aprovada pelo médico.`,
      { medicacaoId: id, doenteId: med.doenteId },
    ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    return resultado;
  }

  async rejeitarPrescricaoMedico(id: string, aprovadoPorId: string, motivoRejeicao: string) {
    const med = await this.prisma.medicacao.findUnique({
      where: { id },
      include: { prescritoPor: { select: { id: true } }, doente: { select: { nome: true } } },
    });
    if (!med) throw new NotFoundException(`Medicação (ID ${id}) não encontrada`);
    if (med.estadoValidacao !== 'pendente_medico') {
      throw new BadRequestException(`Prescrição não está pendente de aprovação médica (estado: ${med.estadoValidacao})`);
    }

    const resultado = await this.prisma.medicacao.update({
      where: { id },
      data: { estadoValidacao: 'rejeitada', validadoPorId: aprovadoPorId, validadaEm: new Date(), motivoRejeicao },
      select: { id: true, nome: true, estadoValidacao: true, motivoRejeicao: true },
    });

    this.notificacoes.enviarParaUtilizador(
      med.prescritoPorId,
      'Proposta de prescrição rejeitada',
      `A tua proposta de ${med.nome} para ${med.doente.nome} foi rejeitada: ${motivoRejeicao}`,
      { medicacaoId: id, doenteId: med.doenteId },
    ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));

    return resultado;
  }

  async assinar(medicacaoId: string, utilizadorId: string, totpCode: string) {
    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: utilizadorId } });
    if (!utilizador) throw new NotFoundException('Utilizador não encontrado');
    if (!utilizador.mfaAtivo || !utilizador.mfaSecret) {
      throw new ForbiddenException('MFA não configurado. Configure o autenticador antes de assinar.');
    }

    const valido = authenticator.verify({ token: totpCode, secret: utilizador.mfaSecret });
    if (!valido) throw new ForbiddenException('Código TOTP inválido');

    // Anti-replay: cada código TOTP só pode ser usado uma vez por utilizador
    const hash = crypto.createHash('sha256').update(`${utilizador.mfaSecret}:${totpCode}`).digest('hex');
    const setOk = await this.redis.setIfNotExists(`totp:used:sign:${utilizadorId}:${hash}`, '1', 90);
    if (setOk === null) {
      this.logger.warn(`Redis indisponível — assinatura clínica fail-closed (utilizador ${utilizadorId})`);
      throw new ForbiddenException('Serviço de validação temporariamente indisponível. Tente novamente.');
    }
    if (!setOk) {
      this.logger.warn(`Replay de TOTP na assinatura — utilizador ${utilizadorId}, medicacao ${medicacaoId}`);
      throw new ForbiddenException('Código TOTP já utilizado. Aguarde o próximo código.');
    }

    const med = await this.prisma.medicacao.findUnique({ where: { id: medicacaoId } });
    if (!med) throw new NotFoundException(`Medicação (ID ${medicacaoId}) não encontrada`);
    if (med.assinadoEm) throw new BadRequestException('Medicação já assinada');

    return this.prisma.medicacao.update({
      where: { id: medicacaoId },
      data: { assinadoEm: new Date(), assinadoPorId: utilizadorId },
      select: { id: true, nome: true, assinadoEm: true, assinadoPor: { select: { id: true, nome: true } } },
    });
  }

  // ── Timeline de Medicação por Turno ─────────────────────────────────────────

  async timeline(servico: string, turno: 'manha' | 'tarde' | 'noite', dataStr?: string) {
    const TURNOS = { manha: { inicio: 8, fim: 16 }, tarde: { inicio: 16, fim: 24 }, noite: { inicio: 0, fim: 8 } };
    const { inicio, fim } = TURNOS[turno];

    const dataRef = dataStr ? new Date(dataStr) : new Date();
    const dia = dataRef.toISOString().split('T')[0];

    const horaInicioDate = new Date(`${dia}T${String(inicio).padStart(2, '0')}:00:00.000Z`);
    const horaFimDate   = new Date(`${dia}T${String(fim === 24 ? 0 : fim).padStart(2, '0')}:00:00.000Z`);
    if (fim === 24) horaFimDate.setDate(horaFimDate.getDate() + 1);

    const doentes = await this.prisma.doente.findMany({
      where: { ativo: true, dataAlta: null },
      select: {
        id: true, nome: true,
        cama: { select: { numero: true } },
        medicacoes: {
          where: { ativo: true, deletedAt: null },
          select: {
            id: true, nome: true, dose: true, frequencia: true, iniciadoEm: true,
            registos: {
              orderBy: { administradoEm: 'desc' },
              take: 1,
              select: { administradoEm: true },
            },
          },
        },
      },
    });

    type SlotEntry = { doenteId: string; doenteName: string; cama: string | null; medicacaoId: string; nome: string; dose: string; administrada: boolean; hora: string };
    const slotsMap = new Map<string, SlotEntry[]>();

    for (let h = inicio; h < (fim === 24 ? 24 : fim); h++) {
      const key = `${String(h).padStart(2, '0')}:00`;
      slotsMap.set(key, []);
    }

    for (const doente of doentes as any[]) {
      for (const med of doente.medicacoes) {
        const intervaloH = parsearFrequenciaHoras(med.frequencia);
        if (!intervaloH) continue;

        const ultimaAdm = med.registos[0]?.administradoEm ?? med.iniciadoEm;
        let proxAdm = new Date(ultimaAdm.getTime() + intervaloH * 3_600_000);

        // Avançar até ao slot dentro do turno
        while (proxAdm < horaInicioDate) proxAdm = new Date(proxAdm.getTime() + intervaloH * 3_600_000);

        if (proxAdm >= horaFimDate) continue;

        const horaKey = `${String(proxAdm.getUTCHours()).padStart(2, '0')}:00`;
        const slotKey = slotsMap.has(horaKey) ? horaKey : [...slotsMap.keys()].find((k) => +k.split(':')[0] === proxAdm.getUTCHours());
        if (!slotKey) continue;

        const administrada = med.registos.length > 0 && med.registos[0].administradoEm >= proxAdm;
        slotsMap.get(slotKey)!.push({
          doenteId: doente.id,
          doenteName: doente.nome,
          cama: doente.cama?.numero ?? null,
          medicacaoId: med.id,
          nome: med.nome,
          dose: med.dose,
          administrada,
          hora: proxAdm.toISOString(),
        });
      }
    }

    const slots = [...slotsMap.entries()].map(([hora, medicacoes]) => ({
      hora,
      total: medicacoes.length,
      medicacoes,
    }));

    return {
      turno: { inicio: `${String(inicio).padStart(2, '0')}:00`, fim: `${String(fim === 24 ? 0 : fim).padStart(2, '0')}:00` },
      slots,
    };
  }

  // ── Vista farmacêutico: prescrições activas ──────────────────────────────────

  async listarPrescricoesAtivas(servico?: string) {
    return this.prisma.doente.findMany({
      where: { ativo: true, dataAlta: null },
      select: {
        id: true, nome: true,
        cama: { select: { numero: true, quarto: true } },
        medicacoes: {
          where: { ativo: true, deletedAt: null },
          select: {
            id: true, nome: true, dose: true, via: true, frequencia: true, iniciadoEm: true,
            registos: {
              orderBy: { administradoEm: 'desc' },
              take: 1,
              select: { administradoEm: true },
            },
          },
          orderBy: { iniciadoEm: 'asc' },
        },
      },
      orderBy: [{ nome: 'asc' }],
    });
  }

  async listarInteracoesPorDoente(doenteId: string) {
    const meds = await this.prisma.medicacao.findMany({
      where: { doenteId, ativo: true, deletedAt: null },
      select: { id: true, nome: true },
    });
    const nomes = meds.map((m) => m.nome);
    const encontradas: { med1Id: string; med1: string; med2: string; severidade: string; descricao: string }[] = [];

    for (let i = 0; i < nomes.length; i++) {
      const interacoes = verificarInteracao(nomes[i], nomes.filter((_, j) => j !== i));
      for (const int of interacoes) {
        if (!encontradas.find((e) => (e.med1 === int.med1 && e.med2 === int.med2) || (e.med1 === int.med2 && e.med2 === int.med1))) {
          encontradas.push({ med1Id: meds[i].id, med1: nomes[i], med2: int.med2, severidade: int.severidade, descricao: int.descricao });
        }
      }
    }
    return encontradas;
  }

  // ── Verificação QR 5 Certos ─────────────────────────────────────────────────

  async verificar5Certos(qrPayload: string, doenteIdEsperado: string) {
    let payload: { medicacaoId?: string; doenteId?: string; nome?: string; dose?: string; via?: string };
    try {
      payload = JSON.parse(qrPayload);
    } catch {
      return { valido: false, falhas: [{ certo: 'QR', motivo: 'Código QR inválido ou corrompido' }], medicacao: null };
    }

    const { medicacaoId, doenteId: doenteIdQR } = payload;
    if (!medicacaoId) return { valido: false, falhas: [{ certo: 'QR', motivo: 'QR sem ID de medicação' }], medicacao: null };

    const medicacao = await this.prisma.medicacao.findUnique({
      where: { id: medicacaoId },
      include: { registos: { orderBy: { administradoEm: 'desc' }, take: 1 } },
    });

    const falhas: { certo: string; motivo: string }[] = [];

    // Certo 1 — Doente certo
    if (!doenteIdQR || doenteIdQR !== doenteIdEsperado) {
      falhas.push({ certo: 'Doente', motivo: 'QR pertence a outro doente' });
    }

    // Certo 2 — Medicamento certo
    if (!medicacao) {
      return { valido: false, falhas: [{ certo: 'Medicamento', motivo: 'Medicação não encontrada' }], medicacao: null };
    }
    if (!medicacao.ativo) {
      falhas.push({ certo: 'Medicamento', motivo: 'Medicação foi descontinuada' });
    }

    // Certo 5 — Hora certa (verificação de janela)
    const intervaloHoras = parsearFrequenciaHoras(medicacao.frequencia);
    if (intervaloHoras && medicacao.registos.length > 0) {
      const ultimaAdm = medicacao.registos[0].administradoEm;
      const horasDesde = (Date.now() - ultimaAdm.getTime()) / 3_600_000;
      const TOLERANCIA_H = 1;
      if (horasDesde < intervaloHoras - TOLERANCIA_H) {
        falhas.push({ certo: 'Hora', motivo: `Administração prematura — última há ${horasDesde.toFixed(1)}h (mínimo ${(intervaloHoras - TOLERANCIA_H).toFixed(1)}h)` });
      }
    }

    return {
      valido: falhas.length === 0,
      falhas,
      medicacao: {
        id: medicacao.id,
        nome: medicacao.nome,
        dose: medicacao.dose,
        via: medicacao.via,
        frequencia: medicacao.frequencia,
      },
    };
  }

  async calcularAjusteRenal(doenteId: string, nomeMedicamento: string) {
    const [creatinina, doente] = await Promise.all([
      (this.prisma as any).resultadoAnalise?.findFirst({
        where: { doenteId, parametro: { contains: 'Creatinina', mode: 'insensitive' } },
        orderBy: { registadoEm: 'desc' },
        select: { valor: true, unidade: true },
      }).catch(() => null) ?? null,
      this.prisma.doente.findUnique({
        where: { id: doenteId },
        select: { dataNascimento: true },
      }),
    ]);

    if (!creatinina) {
      return { gfr: null, aviso: 'Sem creatinina registada — ajuste manual necessário.' };
    }

    const cr = Number(creatinina.valor);
    const idade = doente?.dataNascimento
      ? Math.floor((Date.now() - new Date(doente.dataNascimento).getTime()) / (365.25 * 86_400_000))
      : 65;

    // CKD-EPI simplificado (sem sexo — equação masculina conservadora)
    const gfr = Math.round(
      141 * Math.pow(Math.min(cr / 0.9, 1), -0.411) * Math.pow(Math.max(cr / 0.9, 1), -1.209) * Math.pow(0.993, idade),
    );

    const msg = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'És um farmacêutico clínico especialista em insuficiência renal. Responde apenas com JSON no formato: {"doseRecomendada":"...","intervalo":"...","classificacao":"normal|ligeira|moderada|grave|terminal","observacoes":"..."}',
      messages: [{ role: 'user', content: `Medicamento: ${nomeMedicamento}\nGFR estimado (CKD-EPI): ${gfr} mL/min/1.73m²\nCreatinina sérica: ${cr} ${creatinina.unidade ?? 'mg/dL'}` }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const ajuste = (() => { try { return JSON.parse(texto); } catch { return {}; } })();
    return { gfr, creatinina: cr, unidadeCreatinina: creatinina.unidade ?? 'mg/dL', ...ajuste };
  }
}

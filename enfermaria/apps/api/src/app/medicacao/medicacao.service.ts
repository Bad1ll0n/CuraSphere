import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import * as interacoesJson from './interacoes.json';

interface Interacao { med1: string; med2: string; severidade: string; descricao: string; }
const INTERACOES: Interacao[] = interacoesJson as Interacao[];

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

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

      return { ...medicacao, avisoInteracoes: interacoesDetectadas };
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
    administradoPorId: string;
    observacoes?: string;
    verificacao5Certas?: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const medicacao = await tx.medicacao.findUnique({ where: { id: data.medicacaoId } });
      if (!medicacao) throw new NotFoundException(`Medicação (ID ${data.medicacaoId}) não encontrada`);
      if (!medicacao.ativo) throw new NotFoundException(`Medicação (ID ${data.medicacaoId}) já foi descontinuada`);

      return tx.registoMedicacao.create({
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
      where: { role: 'medico', servico: doente.servico ?? undefined },
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
        ...(servico ? { doente: { servico } } : {}),
      },
      include: {
        doente: { select: { id: true, nome: true, servico: true, cama: { select: { numero: true, quarto: true } } } },
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

    const med = await this.prisma.medicacao.findUnique({ where: { id: medicacaoId } });
    if (!med) throw new NotFoundException(`Medicação (ID ${medicacaoId}) não encontrada`);
    if (med.assinadoEm) throw new BadRequestException('Medicação já assinada');

    return this.prisma.medicacao.update({
      where: { id: medicacaoId },
      data: { assinadoEm: new Date(), assinadoPorId: utilizadorId },
      select: { id: true, nome: true, assinadoEm: true, assinadoPor: { select: { id: true, nome: true } } },
    });
  }
}

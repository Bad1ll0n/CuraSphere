import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { AI_MODELS } from '../common/ai-models';
import { TenantContextService } from '../prisma/tenant-context.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { StewardshipService } from '../stewardship/stewardship.service';
import interacoesJson from './interacoes.json';
import { sanitizeForPrompt } from '../ai-clinico/prompt-sanitizer';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AlertasService } from '../alertas/alertas.service';
import { detetarConflitoAlergia, nomeReconhecido } from './alergias.helper';
import { parsearFrequenciaHoras, tomasPlaneadas, classificarTomas, horaLocal, JANELA_ANTES_MS, JANELA_DEPOIS_MS } from './posologia';
import { eAltoRisco } from './alto-risco';
import { eSOS, frequenciaValida, parsearDose, tomasPorDia, verificarDoseMaxima } from './limites-dose';
import { inicioDoDiaClinico } from '../common/dia-clinico.helper';
import { verificarTotpAssinatura } from '../common/totp-assinatura';


import { chaveDiaClinico } from '../common/dia-clinico.helper';
import { ultimasAdministracoes } from '../common/ultimos-registos';
/** Estado de verificação de um dos cinco certos. */
export type EstadoCerto = 'ok' | 'falha' | 'nao_verificado';

/**
 * Um certo avaliado. O estado é explícito de propósito: a versão anterior devolvia
 * apenas a lista de falhas, e o ecrã do enfermeiro pintava a verde tudo o que não
 * estivesse nessa lista — incluindo dose e via, que nunca eram sequer olhadas.
 */
export interface CertoVerificado {
  certo: string;
  estado: EstadoCerto;
  motivo?: string;
}

const CERTO_DOENTE = 'Doente certo';
const CERTO_MEDICAMENTO = 'Medicamento certo';
const CERTO_DOSE = 'Dose certa';
const CERTO_VIA = 'Via certa';
const CERTO_HORA = 'Hora certa';

/** Ordem canónica, tal como o enfermeiro a executa à cabeceira. */
const NOMES_5_CERTOS = [CERTO_DOENTE, CERTO_MEDICAMENTO, CERTO_DOSE, CERTO_VIA, CERTO_HORA];

export interface Interacao { med1: string; med2: string; severidade: string; descricao: string; }
const INTERACOES: Interacao[] = interacoesJson as Interacao[];

/** Justificação mínima para prescrever apesar de uma alergia documentada. */
const MIN_JUSTIFICACAO_OVERRIDE = 20;


/**
 * Compara um campo declarado à cabeceira (dose, via) com o prescrito.
 * `null` = não declarado, logo o "certo" fica por confirmar; `true`/`false` = confere ou não.
 */
function compararCampoPrescrito(declarado: string | undefined, prescrito: string): boolean | null {
  if (declarado == null || declarado.trim() === '') return null;
  const normalizar = (v: string) =>
    v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').trim();
  return normalizar(declarado) === normalizar(prescrito);
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
    private readonly tenantContext: TenantContextService,
    private readonly notificacoes: NotificacoesService,
    private readonly stewardship: StewardshipService,
    private readonly webhooks: WebhooksService,
    private readonly alertas: AlertasService,
  ) {}

  private async verificarInteracaoIA(novoNome: string, ativas: string[]): Promise<{ bloqueante: boolean; aviso: string | null }> {
    if (ativas.length === 0) return { bloqueante: false, aviso: null };
    try {
      const msg = await this.anthropic.messages.create({
        model: AI_MODELS.FAST,
        max_tokens: 200,
        temperature: 0.05 as any,
        system: [{ type: 'text' as const, text: 'És um sistema de verificação de interações medicamentosas clínicas. Responde APENAS com JSON válido: { "interacao": boolean, "severidade": "nenhuma|minor|moderada|grave|contraindicada", "descricao": "string curta ou null" }. Sê conservador — só assinala interações clinicamente documentadas.', cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Novo fármaco: ${sanitizeForPrompt(novoNome, 100)}\nAtivos: ${ativas.map(a => sanitizeForPrompt(a, 80)).join(', ')}` }],
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
    forcarDoseAcimaMaximo?: boolean;
    justificativaDose?: string;
    intervaloMinimoH?: number;
    maxDosesDia?: number;
  }) {
    // QA-07/QA-08: plausibilidade antes de tudo (dose legível, frequência reconhecida, SOS
    // com intervalo mínimo, dose dentro dos máximos de adulto ou override justificado).
    const doseVerificada = this.verificarPlausibilidade(data);
    const justificacaoDose = (data.justificativaDose ?? '').trim();
    if (doseVerificada && !data.forcarDoseAcimaMaximo) {
      throw new ConflictException(
        `DOSE: ${doseVerificada.motivo}. Para prescrever mesmo assim, envie forcarDoseAcimaMaximo=true ` +
        `com justificativaDose (mínimo ${MIN_JUSTIFICACAO_OVERRIDE} caracteres).`,
      );
    }
    if (doseVerificada && justificacaoDose.length < MIN_JUSTIFICACAO_OVERRIDE) {
      throw new BadRequestException(
        `Prescrição acima da dose máxima exige justificação clínica com pelo menos ${MIN_JUSTIFICACAO_OVERRIDE} caracteres.`,
      );
    }

    // Verificação IA de interações antes da transação (não-bloqueante em caso de falha)
    const ativasPreCheck = await this.prisma.medicacao.findMany({
      where: { doenteId: data.doenteId, ativo: true, deletedAt: null },
      select: { nome: true },
    });
    const iaCheck = await this.verificarInteracaoIA(data.nome, ativasPreCheck.map(m => m.nome));
    if (iaCheck.bloqueante) {
      throw new ConflictException(`INTERAÇÃO CONTRAINDICADA: ${iaCheck.aviso}`);
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const doente = await tx.doente.findUnique({ where: { id: data.doenteId } });
      if (!doente) throw new NotFoundException(`Doente (ID ${data.doenteId}) não encontrado`);

      // As alergias são SEMPRE consultadas, mesmo com override: sem saber o que se está a
      // ultrapassar não há registo possível do override (era este o defeito BA-03).
      const alergias = await tx.alergia.findMany({ where: { doenteId: data.doenteId, deletedAt: null } });
      const conflito = detetarConflitoAlergia(data.nome, alergias);

      if (conflito && !data.forcarApesarDeAlergia) {
        throw new ConflictException(
          `ALERGIA: ${doente.nome} tem alergia registada a "${conflito.alergia.alergenio}" ` +
          `(severidade: ${conflito.alergia.severidade}) — ${conflito.correspondencia.motivo}. ` +
          `Para prescrever mesmo assim, envie forcarApesarDeAlergia=true com justificativaOverride ` +
          `(mínimo ${MIN_JUSTIFICACAO_OVERRIDE} caracteres).`,
        );
      }

      const justificacao = (data.justificativaOverride ?? '').trim();
      if (conflito && data.forcarApesarDeAlergia && justificacao.length < MIN_JUSTIFICACAO_OVERRIDE) {
        throw new BadRequestException(
          `Override de alergia exige justificação clínica com pelo menos ` +
          `${MIN_JUSTIFICACAO_OVERRIDE} caracteres.`,
        );
      }

      const medicacoesAtivas = await tx.medicacao.findMany({
        where: { doenteId: data.doenteId, ativo: true, deletedAt: null },
        select: { nome: true },
      });
      const interacoesDetectadas = verificarInteracao(data.nome, medicacoesAtivas.map((m) => m.nome));

      const {
        forcarApesarDeAlergia: _, justificativaOverride: __, forcarDoseAcimaMaximo: ___, justificativaDose: ____,
        ...dadosMedicacao
      } = data;
      // Só é override se havia mesmo alergia a ultrapassar — `forcar` sozinho não marca nada.
      const houveOverride = !!conflito && !!data.forcarApesarDeAlergia;
      const medicacao = await tx.medicacao.create({
        data: {
          ...dadosMedicacao,
          overrideAlergia: houveOverride,
          overrideDose: !!doseVerificada,
          ...(doseVerificada && { overrideDoseMotivo: `${justificacaoDose} [${doseVerificada.motivo}]`.slice(0, 1000) }),
          ...(houveOverride && {
            overrideMotivo: `${justificacao} [${conflito.correspondencia.motivo}]`.slice(0, 1000),
            overrideAlergenioId: conflito.alergia.id,
          }),
        },
        include: { prescritoPor: { select: { id: true, nome: true } } },
      });

      // Registar em stewardship se for antibiótico (assíncrono, não bloqueia a transação)
      this.stewardship.registarSeAntibiotico(data.doenteId, medicacao.id, data.nome)
        .catch((err) => this.logger.warn(`Stewardship registo falhou: ${err?.message}`));

      return {
        medicacao,
        interacoesDetectadas,
        override: houveOverride
          ? { doenteNome: doente.nome, alergenio: conflito.alergia.alergenio, severidade: conflito.alergia.severidade, motivo: conflito.correspondencia.motivo }
          : null,
      };
    }, { isolationLevel: 'Serializable' });

    // Um override de alergia tem de ser visível: alerta clínico no doente + aviso à farmácia.
    if (resultado.override) {
      const o = resultado.override;
      const msg =
        `Prescrição de "${data.nome}" APESAR de alergia documentada a "${o.alergenio}" ` +
        `(severidade: ${o.severidade}; ${o.motivo}). Justificação: ${(data.justificativaOverride ?? '').trim()}`;
      await this.alertas.criarAlerta(data.doenteId, 'override_alergia', msg, 3)
        .catch((err) => this.logger.warn('Alerta de override falhou', err?.message ?? String(err)));
      await this.notificacoes.enviarParaRole(
        'farmaceutico',
        `⚠ Override de alergia — ${o.doenteNome}`,
        msg,
        { doenteId: data.doenteId, medicacaoId: resultado.medicacao.id, tipo: 'override_alergia' },
      ).catch((err) => this.logger.warn('Notificação ao farmacêutico falhou', err?.message ?? String(err)));
    }

    return {
      ...resultado.medicacao,
      avisoInteracoes: resultado.interacoesDetectadas,
      avisoIA: iaCheck.aviso,
      overrideAlergia: resultado.override,
      // QA-06: nome que o verificador de alergias não reconhece (nem marca nem substância).
      avisoNomeNaoReconhecido: nomeReconhecido(data.nome)
        ? null
        : `"${data.nome}" não foi reconhecido como substância ou marca conhecida — a verificação automática de alergias pode não o ter apanhado. Confirme as alergias do doente.`,
      // PROD-04: frequência sem horário fixo nem SOS/contínua não entra na grelha do turno.
      avisoFrequencia: parsearFrequenciaHoras(data.frequencia) === null && !/^(sos|cont)/i.test(data.frequencia.trim())
        ? `Frequência "${data.frequencia}" não tem horário reconhecido — não vai aparecer na grelha de medicação do turno.`
        : null,
    };
  }

  /**
   * QA-07/QA-08 — dose interpretável, frequência reconhecida, SOS com intervalo mínimo.
   * Lança 400 no que é inválido; devolve o problema de dose máxima (ou `null`) para quem
   * chama decidir entre recusar e aceitar com override justificado.
   */
  private verificarPlausibilidade(d: { nome: string; dose: string; frequencia: string; intervaloMinimoH?: number; maxDosesDia?: number }) {
    const dose = parsearDose(d.dose);
    if (!dose) {
      throw new BadRequestException(`Dose "${d.dose}" não é legível — indique valor e unidade (ex.: "500 mg", "1 g", "1 comp", "10 UI").`);
    }
    if (!frequenciaValida(d.frequencia)) {
      throw new BadRequestException(
        `Frequência "${d.frequencia}" não reconhecida — use, por ex., "3x/dia", "8/8h", "SOS" ou "contínua".`,
      );
    }
    if (eSOS(d.frequencia) && !d.intervaloMinimoH) {
      throw new BadRequestException('Em SOS indique o intervalo mínimo entre tomas (intervaloMinimoH, em horas).');
    }
    return verificarDoseMaxima(d.nome, dose, eSOS(d.frequencia) ? (d.maxDosesDia ?? null) : tomasPorDia(d.frequencia));
  }

  async verificarInteracoes(doenteId: string, nomeMed: string): Promise<Interacao[]> {
    const medicacoesAtivas = await this.prisma.medicacao.findMany({
      where: { doenteId, ativo: true, deletedAt: null },
      select: { nome: true },
    });
    return verificarInteracao(nomeMed, medicacoesAtivas.map((m) => m.nome));
  }

  /**
   * Registo de administração com os "5 certos" realmente verificados.
   *
   * Antes: `doenteId` era opcional e a verificação do doente condicional (`if (data.doenteId …)`),
   * a dose e a via nunca eram comparadas com o prescrito, não havia verificação de alergia no
   * momento da administração — e ainda assim gravava-se `verificacao5Certas: true` de forma
   * incondicional. Passa a gravar-se o **resultado real**, com o detalhe do que foi confirmado.
   *
   * `doenteId` é obrigatório em runtime (o tipo mantém-se opcional só porque o DTO pertence a
   * outro agente — ver relatório).
   */
  async registarAdministracao(data: {
    medicacaoId: string;
    doenteId?: string;
    administradoPorId: string;
    observacoes?: string;
    dose?: string;
    via?: string;
    atestadoPeloEnfermeiro?: boolean;
    qrPayload?: string;
    justificacaoSOS?: string;
  }) {
    let sosForaDoLimite = false;
    if (!data.doenteId) {
      throw new BadRequestException(
        '5 certos: doenteId é obrigatório — confirme a identidade do doente antes de administrar',
      );
    }

    const registo = await this.prisma.$transaction(async (tx) => {
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

      // 1. Doente certo — agora incondicional.
      if (data.doenteId !== medicacao.doenteId) {
        throw new BadRequestException(
          '5 certos: doente incorrecto — esta medicação não pertence ao doente indicado',
        );
      }

      // 2. Medicamento certo — a medicação existe, está activa e é deste doente.
      //    Alergia reavaliada no acto: a alergia pode ter sido documentada DEPOIS da prescrição.
      const alergias = await tx.alergia.findMany({ where: { doenteId: medicacao.doenteId, deletedAt: null } });
      const conflito = detetarConflitoAlergia(medicacao.nome, alergias);
      if (conflito && !medicacao.overrideAlergia) {
        throw new BadRequestException(
          `5 certos: ALERGIA — "${medicacao.nome}" colide com a alergia documentada a ` +
          `"${conflito.alergia.alergenio}" (${conflito.correspondencia.motivo}). ` +
          `Não administrar sem revisão da prescrição.`,
        );
      }

      // A etiqueta assinada é a fonte independente: o que lá está impresso foi gerado no
      // momento da emissão e não pode ser forjado pelo cliente. É dela que saem os valores
      // a comparar — não do que o cliente diz ter lido.
      const daEtiqueta = data.qrPayload ? this.lerPayloadQR(data.qrPayload) : null;
      const doseDeclarada = daEtiqueta?.dose ?? data.dose;
      const viaDeclarada = daEtiqueta?.via ?? data.via;

      // 3. Dose certa e 4. Via certa — comparadas com o prescrito quando declaradas.
      const doseConfirmada = compararCampoPrescrito(doseDeclarada, medicacao.dose);
      if (doseConfirmada === false) {
        throw new BadRequestException(
          `5 certos: dose incorrecta — prescrito "${medicacao.dose}", na etiqueta "${doseDeclarada}"`,
        );
      }
      const viaConfirmada = compararCampoPrescrito(viaDeclarada, medicacao.via);
      if (viaConfirmada === false) {
        throw new BadRequestException(
          `5 certos: via incorrecta — prescrito "${medicacao.via}", na etiqueta "${viaDeclarada}"`,
        );
      }

      // 5. Hora certa — janela de frequência. Em SOS/perfusão contínua não há janela a
      //    conferir, e a hora dá-se por certa por definição.
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

      // QA-08: SOS sem intervalo mínimo nem máximo diário deixava registar 3 tomas em 9 s.
      // Prescrições SOS antigas, sem intervalo definido, usam 1 h — o suficiente para
      // apanhar o registo em duplicado ou dois enfermeiros no mesmo doente.
      if (eSOS(medicacao.frequencia)) {
        const intervaloMin = medicacao.intervaloMinimoH ?? 1;
        const ultima = medicacao.registos[0]?.administradoEm;
        const minutosDesde = ultima ? (Date.now() - ultima.getTime()) / 60_000 : null;
        const problemas: string[] = [];
        if (minutosDesde !== null && minutosDesde < intervaloMin * 60) {
          problemas.push(`última toma há ${Math.round(minutosDesde)} min (intervalo mínimo ${intervaloMin} h)`);
        }
        if (medicacao.maxDosesDia) {
          const em24h = await tx.registoMedicacao.count({
            where: { medicacaoId: medicacao.id, naoAdministrada: false, administradoEm: { gte: new Date(Date.now() - 86_400_000) } },
          });
          if (em24h >= medicacao.maxDosesDia) problemas.push(`${em24h} tomas nas últimas 24 h (máximo ${medicacao.maxDosesDia})`);
        }
        if (problemas.length && (data.justificacaoSOS ?? '').trim().length < 10) {
          throw new ConflictException(
            `SOS: ${problemas.join('; ')}. Para administrar mesmo assim, indique justificacaoSOS (mínimo 10 caracteres).`,
          );
        }
        sosForaDoLimite = problemas.length > 0;
      }

      // Três estados, não dois. 'verificado' = o sistema comparou dois valores de origens
      // independentes (etiqueta lida vs. prescrição). 'atestado' = o enfermeiro percorreu
      // a lista e confirmou, sem o sistema ter comparado nada. 'nao_confirmado' = nem uma
      // coisa nem outra. Colapsar 'atestado' em 'verificado' é o que fazia este registo
      // afirmar uma verificação que nunca aconteceu.
      const atestado = data.atestadoPeloEnfermeiro === true;
      const estado = (verificado: boolean | null) =>
        verificado === true ? 'verificado' : atestado ? 'atestado' : 'nao_confirmado';

      const certos = {
        doente: 'verificado' as const, // conferido contra a BD, não contra o pedido
        medicamento: 'verificado' as const,
        dose: estado(doseConfirmada),
        via: estado(viaConfirmada),
        hora: 'verificado' as const, // qualquer violação da janela já teria lançado acima
      };

      // `verificacao5Certas` continua a significar o que o nome diz: os CINCO conferidos
      // pelo sistema. Uma atestação fica registada em `certosVerificados`, e é isso que
      // uma auditoria clínica precisa de conseguir distinguir.
      const todosConfirmados = Object.values(certos).every((e) => e === 'verificado');

      return tx.registoMedicacao.create({
        data: {
          medicacaoId: data.medicacaoId,
          doenteId: medicacao.doenteId,
          administradoPorId: data.administradoPorId,
          observacoes: data.observacoes,
          ...(sosForaDoLimite && { justificacaoSOS: data.justificacaoSOS!.trim().slice(0, 500) }),
          // Resultado REAL, não um literal: só é `true` se os 5 foram mesmo confirmados.
          verificacao5Certas: todosConfirmados,
          certosVerificados: certos,
        },
        include: {
          administradoPor: { select: { id: true, nome: true } },
          medicacao: { select: { nome: true, dose: true, via: true } },
        },
      });
    }, { isolationLevel: 'Serializable' });

    this.webhooks.dispatcharEvento('medicacao.administrada', { medicacaoId: data.medicacaoId, doenteId: data.doenteId }).catch(() => null);
    return registo;
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

    const diaStr = chaveDiaClinico(dataRef);
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
      where: { doenteId: { in: doenteIds }, ativo: true, deletedAt: null },
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
      where: { ativo: true, estadoValidacao: null, deletedAt: null },
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
    intervaloMinimoH?: number;
    maxDosesDia?: number;
  }) {
    // QA-07: uma proposta acima da dose máxima não segue — só o médico pode justificar o override.
    const problemaDose = this.verificarPlausibilidade(data);
    if (problemaDose) {
      throw new ConflictException(`DOSE: ${problemaDose.motivo}. A proposta não pode exceder a dose máxima — fale com o médico.`);
    }
    const doente = await this.prisma.doente.findUnique({ where: { id: data.doenteId } });
    if (!doente) throw new NotFoundException(`Doente (ID ${data.doenteId}) não encontrado`);

    const medicacao = await this.prisma.medicacao.create({
      data: {
        tenantId: this.tenantContext.tenantId,
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
    await verificarTotpAssinatura(this.prisma, utilizadorId, totpCode, 'medicacao');

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

  /**
   * Grelha de medicação do turno (PROD-04).
   *
   * Cada prescrição activa gera as tomas planeadas nos horários-padrão (ver `posologia.ts`)
   * dentro do turno, na hora local do hospital, e cada toma é confrontada com as
   * administrações registadas: administrada, em atraso ou devida. Filtra pelo serviço da
   * cama — antes devolvia os fármacos do hospital inteiro.
   */
  async timeline(servico: string, turno: 'manha' | 'tarde' | 'noite', dataStr?: string) {
    const TURNOS = { manha: { inicio: 8, fim: 16 }, tarde: { inicio: 16, fim: 24 }, noite: { inicio: 0, fim: 8 } };
    const { inicio, fim } = TURNOS[turno];

    // `data` vem como YYYY-MM-DD: meio-dia UTC desse dia cai sempre no mesmo dia clínico.
    const dataRef = dataStr && /^\d{4}-\d{2}-\d{2}$/.test(dataStr) ? new Date(`${dataStr}T12:00:00Z`) : new Date();
    const inicioDia = inicioDoDiaClinico(dataRef);
    const horaInicioDate = new Date(inicioDia.getTime() + inicio * 3_600_000);
    const horaFimDate = new Date(inicioDia.getTime() + fim * 3_600_000);

    const doentes = await this.prisma.doente.findMany({
      where: {
        tenantId: this.tenantContext.tenantId,
        ativo: true,
        dataAlta: null,
        ...(servico ? { cama: { servico } } : {}),
      },
      select: {
        id: true, nome: true, numeroProcesso: true, dataNascimento: true,
        cama: { select: { numero: true } },
        alergias: { where: { deletedAt: null }, select: { alergenio: true, severidade: true } },
        medicacoes: {
          where: { ativo: true, deletedAt: null },
          select: {
            id: true, nome: true, dose: true, via: true, frequencia: true, iniciadoEm: true,
            registos: {
              where: {
                naoAdministrada: false,
                administradoEm: {
                  gte: new Date(horaInicioDate.getTime() - JANELA_DEPOIS_MS),
                  lt: new Date(horaFimDate.getTime() + JANELA_ANTES_MS),
                },
              },
              select: { administradoEm: true },
            },
          },
        },
      },
      orderBy: { nome: 'asc' },
    });

    type SlotEntry = {
      doenteId: string; doenteName: string; cama: string | null; medicacaoId: string;
      nome: string; dose: string; via: string; frequencia: string;
      administrada: boolean; estado: string; hora: string; altoRisco: boolean;
    };
    const slotsMap = new Map<string, SlotEntry[]>();
    for (let h = inicio; h < fim; h++) slotsMap.set(`${String(h).padStart(2, '0')}:00`, []);

    const agora = new Date();
    const doentesMap = new Map<string, {
      id: string; nome: string; numeroProcesso: string; dataNascimento: Date | null;
      cama: string | null; alergias: Array<{ alergenio: string; severidade: string | null }>; medicacoesPendentes: number;
    }>();

    for (const doente of doentes as any[]) {
      for (const med of doente.medicacoes) {
        const tomas = tomasPlaneadas(med.frequencia, horaInicioDate, horaFimDate, med.iniciadoEm);
        if (tomas.length === 0) continue;
        const classificadas = classificarTomas(tomas, med.registos.map((r: { administradoEm: Date }) => r.administradoEm), agora);
        for (const toma of classificadas) {
          const slot = slotsMap.get(horaLocal(toma.hora));
          if (!slot) continue;
          slot.push({
            doenteId: doente.id,
            doenteName: doente.nome,
            cama: doente.cama?.numero ?? null,
            medicacaoId: med.id,
            nome: med.nome,
            dose: med.dose,
            via: med.via,
            frequencia: med.frequencia,
            administrada: toma.estado === 'administrada',
            estado: toma.estado,
            hora: toma.hora.toISOString(),
            altoRisco: eAltoRisco(med.nome),
          });
          const atual = doentesMap.get(doente.id) ?? {
            id: doente.id, nome: doente.nome, numeroProcesso: doente.numeroProcesso,
            dataNascimento: doente.dataNascimento, cama: doente.cama?.numero ?? null,
            alergias: doente.alergias, medicacoesPendentes: 0,
          };
          if (toma.estado !== 'administrada') atual.medicacoesPendentes++;
          doentesMap.set(doente.id, atual);
        }
      }
    }

    const slots = [...slotsMap.entries()].map(([hora, medicacoes]) => ({ hora, total: medicacoes.length, medicacoes }));

    return {
      turno: { inicio: `${String(inicio).padStart(2, '0')}:00`, fim: `${String(fim === 24 ? 0 : fim).padStart(2, '0')}:00` },
      slots,
      doentes: [...doentesMap.values()],
    };
  }

  // ── Vista farmacêutico: prescrições activas ──────────────────────────────────

  /**
   * Vista do farmacêutico (PERF-04). Antes: ignorava o `servico`, incluía o ambulatório, lia o
   * histórico de administrações inteiro para mostrar uma (PERF-03) e ordenava pelo nome CIFRADO
   * (ordem aleatória) — 1 MB por abertura. Agora: só internados, filtrados pelo serviço da cama,
   * última administração por `LATERAL … LIMIT 1`, e ordenação por cama e nome (decifrado).
   */
  async listarPrescricoesAtivas(servico?: string) {
    const doentes = await this.prisma.doente.findMany({
      where: {
        tenantId: this.tenantContext.tenantId,
        ativo: true,
        dataAlta: null,
        estadoRegisto: 'internado',
        ...(servico ? { cama: { servico } } : {}),
      },
      select: {
        id: true, nome: true,
        cama: { select: { numero: true, quarto: true } },
        medicacoes: {
          where: { ativo: true, deletedAt: null },
          select: { id: true, nome: true, dose: true, via: true, frequencia: true, iniciadoEm: true },
          orderBy: { iniciadoEm: 'asc' },
        },
      },
    });
    const ultimas = await ultimasAdministracoes(this.prisma, doentes.flatMap((d) => d.medicacoes.map((m) => m.id)));
    return doentes
      .map((d) => ({
        ...d,
        medicacoes: d.medicacoes.map((m) => {
          const ult = ultimas.get(m.id);
          return { ...m, registos: ult ? [{ administradoEm: ult }] : [] };
        }),
      }))
      .sort((a, b) =>
        (a.cama?.numero ?? '\uffff').localeCompare(b.cama?.numero ?? '\uffff', 'pt', { numeric: true }) ||
        a.nome.localeCompare(b.nome, 'pt'));
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

  /** Segredo de assinatura das etiquetas QR. Cai no JWT_SECRET (obrigatório no boot). */
  private get qrSecret(): string {
    const secret = process.env.MEDICACAO_QR_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('MEDICACAO_QR_SECRET/JWT_SECRET não configurado');
    return secret;
  }

  private assinarQR(corpo: string): string {
    return crypto.createHmac('sha256', this.qrSecret).update(corpo).digest('base64url');
  }

  /**
   * Gera a etiqueta QR **assinada** de uma medicação. Sem isto o payload do QR era JSON
   * simples produzido pelo cliente — qualquer pessoa podia fabricar um.
   * Formato: `<base64url(json)>.<hmac>`.
   */
  async gerarPayloadQR(medicacaoId: string): Promise<{ qrPayload: string }> {
    const medicacao = await this.prisma.medicacao.findUnique({
      where: { id: medicacaoId },
      select: { id: true, doenteId: true, nome: true, dose: true, via: true },
    });
    if (!medicacao) throw new NotFoundException(`Medicação (ID ${medicacaoId}) não encontrada`);

    const corpo = Buffer.from(JSON.stringify({
      medicacaoId: medicacao.id,
      doenteId: medicacao.doenteId,
      // Dose e via vão na etiqueta para poderem ser confrontadas com a prescrição no
      // momento da leitura. É isso que permite apanhar uma etiqueta impressa ANTES de
      // uma alteração de dose — sem elas, os certos 3 e 4 não são verificáveis à
      // cabeceira e não podem ser dados como verificados.
      dose: medicacao.dose,
      via: medicacao.via,
      emitidoEm: new Date().toISOString(),
    })).toString('base64url');
    return { qrPayload: `${corpo}.${this.assinarQR(corpo)}` };
  }

  /** Valida a assinatura e devolve o conteúdo do QR, ou `null` se não for de confiança. */
  private lerPayloadQR(qrPayload: string): {
    medicacaoId?: string; doenteId?: string; dose?: string; via?: string;
  } | null {
    const partes = (qrPayload ?? '').split('.');
    if (partes.length !== 2) return null;
    const [corpo, assinatura] = partes;

    const esperada = this.assinarQR(corpo);
    const a = Buffer.from(assinatura);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    try {
      return JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Verificação dos 5 certos a partir da etiqueta QR.
   *
   * Antes: o payload era JSON não assinado vindo do cliente e o "doente certo" comparava
   * `payload.doenteId` com `doenteIdEsperado` — **dois valores vindos do mesmo cliente**.
   * Agora o QR é verificado por HMAC e o doente é confrontado com o que está na BD.
   */
  async verificar5Certos(qrPayload: string, doenteIdEsperado: string) {
    const payload = this.lerPayloadQR(qrPayload);
    if (!payload) {
      return this.resultado5Certos(null, [], 'Etiqueta QR inválida, corrompida ou sem assinatura válida');
    }

    const { medicacaoId } = payload;
    if (!medicacaoId) {
      return this.resultado5Certos(null, [], 'QR sem identificação de medicação');
    }

    const medicacao = await this.prisma.medicacao.findUnique({
      where: { id: medicacaoId },
      include: { registos: { orderBy: { administradoEm: 'desc' }, take: 1 } },
    });

    if (!medicacao) {
      return this.resultado5Certos(null, [
        { certo: CERTO_MEDICAMENTO, estado: 'falha', motivo: 'Medicação não encontrada' },
      ]);
    }

    const certos: CertoVerificado[] = [];

    // Certo 1 — Doente certo. O lado autoritativo é a BD, não o QR.
    certos.push(
      !doenteIdEsperado || medicacao.doenteId !== doenteIdEsperado
        ? { certo: CERTO_DOENTE, estado: 'falha', motivo: 'A medicação não pertence ao doente à cabeceira' }
        : { certo: CERTO_DOENTE, estado: 'ok' },
    );

    // Certo 2 — Medicamento certo: activo e sem alergia por resolver.
    const alergias = await this.prisma.alergia.findMany({ where: { doenteId: medicacao.doenteId, deletedAt: null } });
    const conflito = detetarConflitoAlergia(medicacao.nome, alergias);
    if (!medicacao.ativo) {
      certos.push({ certo: CERTO_MEDICAMENTO, estado: 'falha', motivo: 'Medicação foi descontinuada' });
    } else if (conflito && !medicacao.overrideAlergia) {
      certos.push({
        certo: CERTO_MEDICAMENTO,
        estado: 'falha',
        motivo: `Alergia documentada a "${conflito.alergia.alergenio}" — ${conflito.correspondencia.motivo}`,
      });
    } else {
      certos.push({ certo: CERTO_MEDICAMENTO, estado: 'ok' });
    }

    // Certos 3 e 4 — Dose e via. Compara-se o que está IMPRESSO na etiqueta com o que
    // está prescrito agora: é assim que se apanha uma etiqueta emitida antes de uma
    // alteração de dose. Uma etiqueta antiga, sem estes campos, não permite verificar —
    // e nesse caso o resultado é 'não verificado', nunca 'ok'.
    certos.push(this.compararComEtiqueta(CERTO_DOSE, payload.dose, medicacao.dose, 'dose'));
    certos.push(this.compararComEtiqueta(CERTO_VIA, payload.via, medicacao.via, 'via'));

    // Certo 5 — Hora certa.
    certos.push(this.verificarHora(medicacao));

    return this.resultado5Certos(medicacao, certos);
  }

  /** Confronta um campo impresso na etiqueta com o valor prescrito. */
  private compararComEtiqueta(
    certo: string,
    naEtiqueta: string | undefined,
    prescrito: string,
    nomeCampo: string,
  ): CertoVerificado {
    if (!naEtiqueta) {
      return {
        certo,
        estado: 'nao_verificado',
        motivo: `Etiqueta antiga, sem ${nomeCampo} impressa. Confirme contra a prescrição (${prescrito}) e reimprima a etiqueta.`,
      };
    }
    const normalizar = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalizar(naEtiqueta) !== normalizar(prescrito)) {
      return {
        certo,
        estado: 'falha',
        motivo: `A etiqueta diz "${naEtiqueta}" e a prescrição actual diz "${prescrito}".`,
      };
    }
    return { certo, estado: 'ok' };
  }

  /** Janela horária: só é verificável havendo frequência interpretável e administração anterior. */
  private verificarHora(medicacao: {
    frequencia: string;
    registos: { administradoEm: Date }[];
  }): CertoVerificado {
    const intervaloHoras = parsearFrequenciaHoras(medicacao.frequencia);
    if (!intervaloHoras) {
      return {
        certo: CERTO_HORA,
        estado: 'nao_verificado',
        motivo: `Frequência "${medicacao.frequencia}" não permite calcular a janela. Confirme o horário prescrito.`,
      };
    }
    if (medicacao.registos.length === 0) {
      return {
        certo: CERTO_HORA,
        estado: 'nao_verificado',
        motivo: 'Primeira administração — não há anterior com que comparar. Confirme o horário prescrito.',
      };
    }
    const horasDesde = (Date.now() - medicacao.registos[0].administradoEm.getTime()) / 3_600_000;
    const TOLERANCIA_H = 1;
    if (horasDesde < intervaloHoras - TOLERANCIA_H) {
      return {
        certo: CERTO_HORA,
        estado: 'falha',
        motivo: `Administração prematura — última há ${horasDesde.toFixed(1)}h (mínimo ${(intervaloHoras - TOLERANCIA_H).toFixed(1)}h)`,
      };
    }
    return { certo: CERTO_HORA, estado: 'ok' };
  }

  /**
   * Monta a resposta. Os cinco certos aparecem SEMPRE, cada um com o seu estado — é
   * esta garantia que impede o cliente de inferir "verde" a partir da ausência de uma
   * falha, que era como dose e via apareciam confirmadas sem nunca terem sido olhadas.
   */
  private resultado5Certos(
    medicacao: { id: string; nome: string; dose: string; via: string; frequencia: string } | null,
    avaliados: CertoVerificado[],
    erroEtiqueta?: string,
  ) {
    // Uma etiqueta que não se consegue ler com confiança não torna o medicamento errado:
    // torna TUDO por verificar. Marcá-la como falha de um certo específico daria a ideia
    // de que os outros quatro tinham sido conferidos.
    const porNome = new Map(avaliados.map((c) => [c.certo, c]));
    const certos: CertoVerificado[] = NOMES_5_CERTOS.map(
      (nome) =>
        porNome.get(nome) ?? {
          certo: nome,
          estado: 'nao_verificado' as const,
          motivo: erroEtiqueta ?? 'Não foi possível verificar este certo.',
        },
    );

    return {
      certos,
      // `valido` só é verdade quando os CINCO estão confirmados. Um 'não verificado'
      // não é uma aprovação silenciosa.
      valido: certos.every((c) => c.estado === 'ok'),
      erroEtiqueta,
      falhas: [
        ...(erroEtiqueta ? [{ certo: 'QR', motivo: erroEtiqueta }] : []),
        ...certos
          .filter((c) => c.estado === 'falha')
          .map((c) => ({ certo: c.certo, motivo: c.motivo ?? '' })),
      ],
      porVerificar: certos.filter((c) => c.estado === 'nao_verificado').map((c) => c.certo),
      medicacao: medicacao
        ? {
            id: medicacao.id,
            nome: medicacao.nome,
            dose: medicacao.dose,
            via: medicacao.via,
            frequencia: medicacao.frequencia,
          }
        : null,
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
      model: AI_MODELS.FAST,
      max_tokens: 400,
      system: 'És um farmacêutico clínico especialista em insuficiência renal. Responde apenas com JSON no formato: {"doseRecomendada":"...","intervalo":"...","classificacao":"normal|ligeira|moderada|grave|terminal","observacoes":"..."}',
      messages: [{ role: 'user', content: `Medicamento: ${nomeMedicamento}\nGFR estimado (CKD-EPI): ${gfr} mL/min/1.73m²\nCreatinina sérica: ${cr} ${creatinina.unidade ?? 'mg/dL'}` }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const ajuste = (() => { try { return JSON.parse(texto); } catch { return {}; } })();
    return { gfr, creatinina: cr, unidadeCreatinina: creatinina.unidade ?? 'mg/dL', ...ajuste };
  }
}

import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { assertUrlDestinoPublico } from '../common/ssrf-guard';

import { chaveDiaClinico } from '../common/dia-clinico.helper';
import { SinaisVitaisService } from '../sinais-vitais/sinais-vitais.service';
import { createHash, randomBytes } from 'crypto';
// LOINC code → SinalVital field mapping
const LOINC_MAP: Record<string, string> = {
  '8867-4':  'pulso',
  '8310-5':  'temperatura',
  '59408-5': 'saturacaoO2',
  '9279-1':  'frequenciaRespiratoria',
  '55284-4': 'pressaoSistolica',   // Blood pressure panel (systolic used)
  '8480-6':  'pressaoSistolica',
  '8462-4':  'pressaoDiastolica',
};

export class CriarDispositivoDto {
  @IsString() @MaxLength(100) nome: string;
  @IsEnum(['monitor_vitais', 'ventilador', 'bomba_infusao']) tipo: string;
  @IsOptional() @IsString() doenteId?: string;
}

/** SHA-256 da chave. Determinista, para servir de chave de procura, e irreversível. */
function hashDeChave(chave: string): string {
  return createHash('sha256').update(chave).digest('hex');
}

@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);
  // In-memory fallback cache when Redis unavailable
  private readonly spmsMemCache = new Map<string, { value: any; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sinaisVitais: SinaisVitaisService,
  ) {}

  async receberObservation(body: any, apiKey: string) {
    // A chave nunca é comparada em claro contra a base: compara-se o hash.
    const dispositivo = await this.prisma.dispositivoFhir.findUnique({
      where: { apiKeyHash: hashDeChave(apiKey) },
    });
    if (!dispositivo || !dispositivo.ativo) throw new ForbiddenException('Dispositivo não autorizado');

    await this.prisma.dispositivoFhir.update({
      where: { id: dispositivo.id },
      data: { ultimoPing: new Date() },
    });

    if (!body || body.resourceType !== 'Observation') {
      throw new BadRequestException('Recurso FHIR inválido — esperado resourceType: Observation');
    }

    // S-04: o doente vem SEMPRE do dispositivo, nunca do corpo do pedido.
    //
    // Antes era `dispositivo.doenteId ?? body.subject`, o que deixava um dispositivo sem
    // doente associado escrever sinais vitais em QUALQUER doente — bastava nomeá-lo no
    // payload. E esses vitais alimentam o NEWS2 e os alertas de deterioração.
    const doenteId = dispositivo.doenteId;
    if (!doenteId) {
      throw new BadRequestException(
        'Dispositivo sem doente associado — associe-o antes de enviar observações',
      );
    }

    // Se o payload nomear um doente diferente, é erro de configuração à cabeceira: o
    // monitor está ligado a uma pessoa e a dizer o nome de outra. Recusar é o único
    // comportamento seguro.
    const doenteNoPayload = body.subject?.reference?.split('/').pop();
    if (doenteNoPayload && doenteNoPayload !== doenteId) {
      throw new BadRequestException(
        'A observação refere um doente diferente daquele a que o dispositivo está associado',
      );
    }

    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);

    // Usar utilizador do sistema (sistema de dispositivos)
    const sistemUserId = await this.obterUtilizadorSistema();

    const sinalData: Record<string, number> = {};

    const code = body.code?.coding?.[0]?.code;
    const campo = code ? LOINC_MAP[code] : null;

    if (campo) {
      const valor = body.valueQuantity?.value ?? body.component?.[0]?.valueQuantity?.value;
      if (valor != null) {
        sinalData[campo] = Number(valor);
        // Blood pressure panel — também capturar diastólica
        if (code === '55284-4' && body.component) {
          for (const comp of body.component) {
            const compCode = comp.code?.coding?.[0]?.code;
            const compCampo = compCode ? LOINC_MAP[compCode] : null;
            if (compCampo && comp.valueQuantity?.value != null) {
              sinalData[compCampo] = Number(comp.valueQuantity.value);
            }
          }
        }
      }
    }

    if (Object.keys(sinalData).length === 0) {
      return { status: 'ignorado', motivo: 'Código LOINC não mapeado: ' + (code ?? 'N/A') };
    }

    // BA-08: os vitais de dispositivos passam pelo MESMO caminho dos manuais.
    //
    // Antes iam directos ao `prisma.sinalVital.create`, saltando o NEWS2, o PEWS, os
    // alertas de valor crítico isolado e a avaliação de sépsis. A monitorização contínua
    // — a única fonte que observa o doente 24 horas por dia — era exactamente a que
    // escapava por completo à detecção de deterioração.
    const sinal = await this.sinaisVitais.ingerirDeMonitor(doenteId, sistemUserId, {
      ...sinalData,
      medidoEm: body.effectiveDateTime ?? undefined,
    });

    return { status: 'criado', sinalVitalId: sinal.id, campos: Object.keys(sinalData) };
  }

  private async obterUtilizadorSistema(): Promise<string> {
    // `it_admin` é um SUB-papel; o papel chama-se `ti`. E `admin` não existe de todo no
    // catálogo. Com os nomes errados esta procura devolvia sempre nada e a ingestão de
    // dispositivos rebentava aqui — antes sequer de chegar ao registo do vital.
    const ti = await this.prisma.utilizador.findFirst({
      where: { role: 'ti', ativo: true },
      orderBy: { criadoEm: 'asc' },
      select: { id: true },
    });
    if (ti) return ti.id;

    const direcao = await this.prisma.utilizador.findFirst({
      where: { role: 'direcao', ativo: true },
      orderBy: { criadoEm: 'asc' },
      select: { id: true },
    });
    if (direcao) return direcao.id;

    throw new Error(
      'Nenhum utilizador com papel `ti` ou `direcao` activo para associar registos de dispositivos',
    );
  }

  listarDispositivos() {
    // Nunca devolver o hash: não serve para nada a quem lista e é material sensível.
    return this.prisma.dispositivoFhir.findMany({
      orderBy: { criadoEm: 'desc' },
      select: { id: true, nome: true, tipo: true, doenteId: true, ativo: true, ultimoPing: true, criadoEm: true },
    });
  }

  async criarDispositivo(dto: CriarDispositivoDto) {
    if (dto.doenteId) {
      const doente = await this.prisma.doente.findUnique({ where: { id: dto.doenteId }, select: { id: true } });
      if (!doente) throw new NotFoundException(`Doente (ID ${dto.doenteId}) não encontrado`);
    }
    // A chave é mostrada UMA vez, aqui. Não há forma de a recuperar depois — é esse o
    // ponto: deixa de existir em lado nenhum que uma leitura da base possa alcançar.
    const chave = randomBytes(32).toString('base64url');

    const dispositivo = await this.prisma.dispositivoFhir.create({
      data: {
        nome: dto.nome,
        tipo: dto.tipo,
        doenteId: dto.doenteId ?? null,
        apiKeyHash: hashDeChave(chave),
      },
      select: { id: true, nome: true, tipo: true, doenteId: true, ativo: true, criadoEm: true },
    });

    return { ...dispositivo, apiKey: chave, aviso: 'Guarde esta chave: não voltará a ser mostrada.' };
  }

  async removerDispositivo(id: string) {
    const d = await this.prisma.dispositivoFhir.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado');
    return this.prisma.dispositivoFhir.update({ where: { id }, data: { ativo: false } });
  }

  // ── FHIR R4 Export ──────────────────────────────────────────────────────────

  async exportarBundleDoente(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      include: {
        medicacoes: { where: { ativo: true }, select: { id: true, nome: true, dose: true, via: true, frequencia: true, iniciadoEm: true } },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 10, select: { id: true, data: true, pulso: true, pressaoSistolica: true, pressaoDiastolica: true, temperatura: true, saturacaoO2: true, frequenciaRespiratoria: true } },
        alergias: { select: { id: true, alergenio: true, notas: true, severidade: true } },
        problemas: { where: { estado: 'ativo' }, select: { id: true, descricao: true, tipo: true } },
      },
    });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const doenteAny = doente as any;

    const base = `urn:curasp:${doenteId}`;
    const agora = new Date().toISOString();

    const patient = {
      resourceType: 'Patient',
      id: doente.id,
      identifier: [{ system: 'urn:curasp:process', value: doente.numeroProcesso }],
      name: [{ text: doente.nome }],
      birthDate: doente.dataNascimento ? chaveDiaClinico(new Date(doente.dataNascimento)) : undefined,
    };

    const conditions = ((doenteAny.problemas ?? []) as any[]).map((p: any) => ({
      resourceType: 'Condition',
      id: p.id,
      subject: { reference: `Patient/${doente.id}` },
      code: { text: p.descricao },
      category: [{ text: p.tipo }],
    }));

    const medications = ((doenteAny.medicacoes ?? []) as any[]).map((m: any) => ({
      resourceType: 'MedicationStatement',
      id: m.id,
      subject: { reference: `Patient/${doente.id}` },
      medication: { concept: { text: `${m.nome} ${m.dose}` } },
      dosage: [{ route: { text: m.via }, timing: { code: { text: m.frequencia } } }],
      effectivePeriod: { start: new Date(m.iniciadoEm).toISOString() },
      status: 'active',
    }));

    const observations = ((doenteAny.sinaisVitais ?? []) as any[]).flatMap((sv: any) => {
      const obs: any[] = [];
      const addObs = (code: string, display: string, value: number | null, unit: string) => {
        if (value == null) return;
        obs.push({
          resourceType: 'Observation',
          id: `${sv.id}-${code}`,
          subject: { reference: `Patient/${doente.id}` },
          effectiveDateTime: new Date(sv.data).toISOString(),
          code: { coding: [{ system: 'http://loinc.org', code, display }] },
          valueQuantity: { value, unit, system: 'http://unitsofmeasure.org' },
        });
      };
      addObs('8867-4', 'Heart rate', sv.pulso, '/min');
      addObs('8310-5', 'Body temperature', sv.temperatura, 'Cel');
      addObs('59408-5', 'Oxygen saturation', sv.saturacaoO2, '%');
      addObs('9279-1', 'Respiratory rate', sv.frequenciaRespiratoria, '/min');
      addObs('8480-6', 'Systolic blood pressure', sv.pressaoSistolica, 'mm[Hg]');
      addObs('8462-4', 'Diastolic blood pressure', sv.pressaoDiastolica, 'mm[Hg]');
      return obs;
    });

    const allergies = ((doenteAny.alergias ?? []) as any[]).map((a: any) => ({
      resourceType: 'AllergyIntolerance',
      id: a.id,
      patient: { reference: `Patient/${doente.id}` },
      code: { text: a.alergenio },
      reaction: [{ description: a.notas, severity: a.severidade }],
    }));

    const entries = [patient, ...conditions, ...medications, ...observations, ...allergies];

    return {
      resourceType: 'Bundle',
      id: `${base}-export`,
      type: 'document',
      timestamp: agora,
      total: entries.length,
      entry: entries.map(r => ({
        fullUrl: `${base}-${(r as any).id}`,
        resource: r,
      })),
    };
  }

  // ── FHIR DocumentReference pull (usado por DocumentosSaudeService) ──────────

  async pullDocumentosDoente(
    sistema: { id: string; nome: string; endpoint: string; authConfig?: string | null },
    patientId: string,
  ): Promise<Array<{
    tipo: string; titulo: string; dataDocumento: Date; formato: string;
    urlExterna?: string; mimeType: string; fhirResourceId?: string; origem?: string;
  }>> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { default: fetch } = await import('node-fetch');
    const url = `${sistema.endpoint}/DocumentReference?patient=${patientId}&_sort=-date&_count=50`;

    // SEC-05: `sistema.endpoint` tem origem no utilizador (registado via
    // `POST /v1/sistemas-externos` por um `ti`/`direcao`). Validar o IP resolvido em cada
    // disparo, não só na criação — o DNS pode mudar entre o registo e o pedido. Repare-se
    // que este `fetch` leva um `Authorization` construído a partir do `authConfig` do
    // sistema: sem esta validação, um endpoint apontado para um serviço interno recebia
    // esse cabeçalho.
    await assertUrlDestinoPublico(url);

    const headers: Record<string, string> = { Accept: 'application/fhir+json' };
    if (sistema.authConfig) {
      try {
        const auth = JSON.parse(sistema.authConfig);
        if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
        else if (auth.apiKey) headers['Authorization'] = `ApiKey ${auth.apiKey}`;
      } catch { /* ignore malformed authConfig */ }
    }

    const res = await (fetch as any)(url, {
      headers,
      signal: AbortSignal.timeout(15000),
      // Um redirect levaria o cabeçalho Authorization para um destino não validado.
      redirect: 'manual',
    });
    if (!res.ok) throw new Error(`FHIR ${res.status}: ${res.statusText}`);

    const bundle: any = await res.json();
    const entries: any[] = bundle.entry ?? [];

    const FHIR_TIPO_MAP: Record<string, string> = {
      'diagnostic-report': 'lab',
      'imaging-study': 'rx',
      'discharge-summary': 'alta',
      'prescription': 'prescricao',
      'immunization-record': 'vacinacao',
      'pathology-report': 'patologia',
    };

    return entries.map((entry: any) => {
      const dr = entry.resource;
      const content = dr?.content?.[0];
      const cat = dr?.category?.[0]?.coding?.[0]?.code ?? 'outro';
      const mime = content?.attachment?.contentType ?? 'application/octet-stream';
      return {
        tipo: FHIR_TIPO_MAP[cat] ?? 'outro',
        titulo: dr?.description ?? dr?.type?.text ?? 'Documento',
        dataDocumento: new Date(dr?.date ?? Date.now()),
        origem: dr?.custodian?.display ?? sistema.nome,
        formato: this.mimeToFormato(mime),
        urlExterna: content?.attachment?.url,
        mimeType: mime,
        fhirResourceId: dr?.id,
      };
    });
  }

  private mimeToFormato(mime: string): string {
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'application/dicom') return 'dicom';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'application/fhir+json') return 'fhir_json';
    if (mime?.includes('hl7')) return 'hl7';
    return 'outro';
  }

  // ── SPMS Integration ────────────────────────────────────────────────────────

  async buscarDadosSPMS(nsns: string): Promise<any> {
    const apiKey = process.env['SPMS_API_KEY'];
    if (!apiKey) return null;

    const cacheKey = `spms:${nsns}`;
    const TTL_SECONDS = 600; // 10 minutes

    // 1. Try Redis cache
    const cached = await this.redis.get<any>(cacheKey);
    if (cached !== null) return cached;

    // 2. Try in-memory fallback cache
    const memEntry = this.spmsMemCache.get(cacheKey);
    if (memEntry && memEntry.expiresAt > Date.now()) return memEntry.value;

    // 3. Fetch from SPMS API
    const baseUrl = process.env['SPMS_API_URL'] ?? 'https://api-staging.spms.min-saude.pt';
    const url = `${baseUrl}/v1/utente?nsns=${encodeURIComponent(nsns)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`SPMS API error ${response.status} for nsns=${nsns}`);
        return null;
      }

      const data = await response.json();

      // Cache result
      await this.redis.set(cacheKey, data, TTL_SECONDS);
      this.spmsMemCache.set(cacheKey, { value: data, expiresAt: Date.now() + TTL_SECONDS * 1000 });

      return data;
    } catch (err: any) {
      this.logger.warn(`SPMS fetch failed for nsns=${nsns}: ${err?.message ?? err}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Mock lookup SNS — estrutura real, dados fictícios demonstrativos
  async lookupSns(numeroSNS: string) {
    return {
      encontrado: true,
      fonte: 'RNU (demonstração — integração real requer contrato SPMS)',
      dadosPreenchidos: {
        nome: 'Dados pré-preenchidos via RNU',
        numeroSNS,
        dataNascimento: null,
        morada: null,
        codigoPostal: null,
        localidade: null,
        telefone: null,
      },
    };
  }
}

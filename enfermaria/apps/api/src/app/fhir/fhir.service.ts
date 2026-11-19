import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { IsString, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { assertUrlDestinoPublico } from '../common/ssrf-guard';

import { LeiturasMonitorService } from '../monitorizacao/leituras-monitor.service';
import { construirBundleR4 } from './fhir-bundle';
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
  /** PROD-15: a cama a que o dispositivo está ligado — o doente é quem a ocupa. */
  @IsOptional() @IsString() camaId?: string;
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
    private readonly leituras: LeiturasMonitorService,
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

    // S-04/PROD-15: o doente vem SEMPRE do dispositivo (cama a que está ligado, ou doente
    // associado), nunca do corpo do pedido. Se o payload nomear outro doente, é erro de
    // configuração à cabeceira — o monitor ligado a uma pessoa a dizer o nome de outra — e recusa-se.
    const doenteNoPayload = body.subject?.reference?.split('/').pop();
    const doenteId = await this.leituras.doenteDoDispositivo(dispositivo, doenteNoPayload);

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

    // PROD-15: a mesma via da ingestão de monitores — a leitura fica pendente de validação de
    // enfermagem (um valor crítico alerta logo). Só depois de validada entra no NEWS2 (BA-08).
    const leitura = await this.leituras.receber({
      dispositivoId: dispositivo.id, canal: 'fhir', doenteId, valores: sinalData, medidoEm: body.effectiveDateTime ?? undefined,
    });

    return { status: 'pendente_validacao', leituraId: leitura.id, campos: Object.keys(sinalData) };
  }

  listarDispositivos() {
    // Nunca devolver o hash: não serve para nada a quem lista e é material sensível.
    return this.prisma.dispositivoFhir.findMany({
      orderBy: { criadoEm: 'desc' },
      select: { id: true, nome: true, tipo: true, doenteId: true, camaId: true, ativo: true, ultimoPing: true, criadoEm: true },
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
        camaId: dto.camaId ?? null,
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
      select: {
        id: true, nome: true, numeroProcesso: true, identificadorHis: true, dataNascimento: true, sexo: true,
        ficheiroPessoal: { select: { numeroSNS: true } },
        medicacoes: { where: { ativo: true, deletedAt: null }, select: { id: true, nome: true, dose: true, via: true, frequencia: true, iniciadoEm: true } },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 10, select: { id: true, data: true, pulso: true, pressaoSistolica: true, pressaoDiastolica: true, temperatura: true, saturacaoO2: true, frequenciaRespiratoria: true } },
        alergias: { where: { deletedAt: null }, select: { id: true, alergenio: true, tipo: true, severidade: true, reacao: true, certeza: true, notas: true } },
        problemas: { where: { estado: 'ativo' }, select: { id: true, descricao: true, tipo: true } },
      },
    });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const { ficheiroPessoal, medicacoes, sinaisVitais, alergias, problemas, ...d } = doente;
    // PROD-14: Bundle `document` R4 com Composition — ver fhir-bundle.ts.
    return construirBundleR4({ doente: { ...d, numeroSNS: ficheiroPessoal?.numeroSNS ?? null }, medicacoes, sinaisVitais, alergias, problemas });
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

  /**
   * PROD-14 — consulta ao RNU (Registo Nacional de Utentes).
   *
   * Devolvia SEMPRE `encontrado: true` com dados fictícios, em qualquer ambiente: um utente
   * inexistente aparecia como validado. A integração real exige o contrato e os certificados da
   * SPMS; até lá, responde-se a verdade — `nao_configurado` — e o simulador só existe fora de
   * produção, com `RNU_MODO=simulado`, e diz que é simulado.
   */
  async lookupSns(numeroSNS: string) {
    if (!/^\d{9}$/.test(numeroSNS ?? '')) throw new BadRequestException('Número de utente SNS inválido (9 dígitos).');
    const modo = process.env['RNU_MODO'] ?? 'desligado';
    if (modo === 'simulado' && process.env['NODE_ENV'] !== 'production') {
      return { encontrado: false, simulado: true, fonte: 'RNU simulado (ambiente de desenvolvimento) — nenhum dado real foi consultado', dadosPreenchidos: null };
    }
    return {
      encontrado: false,
      simulado: false,
      fonte: 'nao_configurado',
      mensagem: 'A consulta ao RNU não está configurada neste hospital (requer contrato e certificados SPMS). Confirme a identificação com o documento do utente.',
      dadosPreenchidos: null,
    };
  }
}

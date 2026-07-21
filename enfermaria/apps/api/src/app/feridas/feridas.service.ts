import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_MODELS } from '../common/ai-models';
import { StorageService } from '../common/storage.service';
import { CriarAvaliacaoFerida } from './dto/criar-avaliacao-ferida.dto';
import { randomUUID as uuid } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

const PROMPT_VISAO_FERIDA = `Analisa esta imagem de ferida clínica.
Responde APENAS com JSON válido (sem markdown, sem texto extra):
{"estadio":"I|II|III|IV|não_classificável","sinaisInfecao":["eritema","exsudado_purulento","edema","calor_local","deiscência"],"tecidoLeito":"granulação|fibrina|necrose_seca|necrose_húmida|epitelização|misto","recomendacao":"string máx 200 chars","confianca":"alta|media|baixa"}
Inclui apenas os sinaisInfecao que estão visivelmente presentes. Se não houver sinais de infecção, usa array vazio.
IMPORTANTE: Análise de apoio à decisão clínica. Não substitui avaliação presencial.`;

const ROLES_PODEM_REGISTAR = ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros'];

const fotoInclude = { fotos: { orderBy: { ordem: 'asc' as const } } };

@Injectable()
export class FeridasService {
  private readonly claude = new Anthropic();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async criar(doenteId: string, dto: CriarAvaliacaoFerida, userId: string, role: string) {
    if (!ROLES_PODEM_REGISTAR.includes(role)) {
      throw new ForbiddenException('Sem permissão para registar avaliação de ferida');
    }
    await this.assertDoente(doenteId);

    return this.prisma.avaliacaoFerida.create({
      data: {
        doenteId,
        registadoPorId: userId,
        tipo: dto.tipo,
        localizacao: dto.localizacao,
        estadoCicatrizacao: dto.estadoCicatrizacao,
        comprimento: dto.comprimento,
        largura: dto.largura,
        profundidade: dto.profundidade,
        leito: dto.leito,
        exsudadoVolume: dto.exsudadoVolume,
        exsudadoTipo: dto.exsudadoTipo,
        periferia: dto.periferia,
        dor: dto.dor,
        odor: dto.odor ?? false,
        pensoAplicado: dto.pensoAplicado,
        proximaTroca: dto.proximaTroca ? new Date(dto.proximaTroca) : undefined,
        notas: dto.notas,
      },
      include: { registadoPor: { select: { id: true, nome: true } }, ...fotoInclude },
    });
  }

  async listar(doenteId: string) {
    await this.assertDoente(doenteId);
    const avaliacoes = await this.prisma.avaliacaoFerida.findMany({
      where: { doenteId, deletedAt: null },
      orderBy: { criadaEm: 'desc' },
      include: { registadoPor: { select: { id: true, nome: true } }, ...fotoInclude },
    });
    return Promise.all(avaliacoes.map(a => this.resolverUrlsFotos(a)));
  }

  async buscarUltima(doenteId: string) {
    await this.assertDoente(doenteId);
    const avaliacao = await this.prisma.avaliacaoFerida.findFirst({
      where: { doenteId, deletedAt: null },
      orderBy: { criadaEm: 'desc' },
      include: { registadoPor: { select: { id: true, nome: true } }, ...fotoInclude },
    });
    if (!avaliacao) return null;
    return this.resolverUrlsFotos(avaliacao);
  }

  async apagar(id: string, userId: string, role: string) {
    const avaliacao = await this.prisma.avaliacaoFerida.findUnique({ where: { id } });
    if (!avaliacao || avaliacao.deletedAt) throw new NotFoundException('Avaliação não encontrada');
    if (avaliacao.registadoPorId !== userId && !['medico', 'chefe_enfermeiros'].includes(role)) {
      throw new ForbiddenException('Sem permissão para apagar esta avaliação');
    }
    return this.prisma.avaliacaoFerida.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async adicionarFoto(avaliacaoId: string, buffer: Buffer, mimeType: string, userId: string) {
    const avaliacao = await this.prisma.avaliacaoFerida.findUnique({ where: { id: avaliacaoId } });
    if (!avaliacao || avaliacao.deletedAt) throw new NotFoundException('Avaliação não encontrada');

    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const key = `feridas/${avaliacaoId}/${uuid()}.${ext}`;
    await this.storage.upload(buffer, key, mimeType);

    const count = await this.prisma.fotoFerida.count({ where: { avaliacaoId } });
    const foto = await this.prisma.fotoFerida.create({
      data: { avaliacaoId, storageKey: key, mimeType, ordem: count, criadaPorId: userId },
    });

    const url = await this.storage.getSignedUrl(key);
    return { ...foto, url };
  }

  async listarFotos(avaliacaoId: string) {
    const fotos = await this.prisma.fotoFerida.findMany({
      where: { avaliacaoId },
      orderBy: { ordem: 'asc' },
    });
    return Promise.all(fotos.map(async f => ({ ...f, url: await this.storage.getSignedUrl(f.storageKey) })));
  }

  async removerFoto(fotoId: string, userId: string, role: string) {
    const foto = await this.prisma.fotoFerida.findUnique({ where: { id: fotoId } });
    if (!foto) throw new NotFoundException('Fotografia não encontrada');
    if (foto.criadaPorId !== userId && !['medico', 'chefe_enfermeiros'].includes(role)) {
      throw new ForbiddenException('Sem permissão para remover esta fotografia');
    }
    await this.storage.delete(foto.storageKey);
    await this.prisma.fotoFerida.delete({ where: { id: fotoId } });
    return { mensagem: 'Fotografia removida' };
  }

  async analisarFoto(fotoId: string, avaliacaoId: string, userId: string) {
    const foto = await this.prisma.fotoFerida.findUnique({ where: { id: fotoId } });
    if (!foto || foto.avaliacaoId !== avaliacaoId) throw new NotFoundException('Fotografia não encontrada');

    const buffer = await this.storage.getBuffer(foto.storageKey);
    if (!buffer) throw new NotFoundException('Imagem não encontrada no storage');

    const base64 = buffer.toString('base64');
    const response = await this.claude.messages.create({
      model: AI_MODELS.CLINICAL,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: foto.mimeType as any, data: base64 } },
          { type: 'text', text: PROMPT_VISAO_FERIDA },
        ],
      }],
    });

    const texto = (response.content[0] as any).text ?? '{}';
    let analise: any;
    try { analise = JSON.parse(texto); } catch { analise = { recomendacao: texto, confianca: 'baixa' }; }
    analise.analisadaEm = new Date().toISOString();

    return this.prisma.fotoFerida.update({
      where: { id: fotoId },
      data: { analiseIA: analise },
    });
  }

  private async resolverUrlsFotos(avaliacao: any) {
    const fotosComUrl = await Promise.all(
      (avaliacao.fotos ?? []).map(async (f: any) => ({
        ...f,
        url: await this.storage.getSignedUrl(f.storageKey),
      })),
    );
    return { ...avaliacao, fotos: fotosComUrl };
  }

  private async assertDoente(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException('Doente não encontrado');
  }
}

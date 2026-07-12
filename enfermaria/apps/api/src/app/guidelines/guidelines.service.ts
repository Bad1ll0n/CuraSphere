import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

interface CriarGuidelineDto {
  titulo: string;
  categoria: string;
  conteudo: string;
  fonte: string;
  versao?: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

@Injectable()
export class GuidelinesService implements OnModuleInit {
  private readonly logger = new Logger(GuidelinesService.name);
  private readonly anthropic = new Anthropic();
  private readonly openai = process.env['OPENAI_API_KEY']
    ? new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })
    : null;

  // Set to true when pgvector extension + embedding column are confirmed present
  private pgvectorDisponivel = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$queryRaw`SELECT embedding FROM guidelines_clinicas LIMIT 0`;
      this.pgvectorDisponivel = true;
      this.logger.log('pgvector: coluna embedding detectada — vector search activo');
    } catch {
      this.logger.log('pgvector: coluna embedding não encontrada — usando cosine JS fallback');
    }
  }

  private async gerarEmbedding(texto: string): Promise<number[] | null> {
    if (!this.openai) return null;
    try {
      const res = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texto.slice(0, 8191),
      });
      return res.data[0].embedding;
    } catch (err) {
      this.logger.warn('Embedding geração falhou', (err as any)?.message);
      return null;
    }
  }

  // Fallback: keyword extraction via Claude
  private async extrairTermosClinicos(texto: string): Promise<string[]> {
    const msg = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: 'Extrai os termos clínicos e médicos mais relevantes do texto. Responde APENAS com JSON: ["termo1","termo2",...] (máx 20 termos, em português, em minúsculas).',
      messages: [{ role: 'user', content: texto.slice(0, 1500) }],
    });
    const txt = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    try { return JSON.parse(txt); } catch { return []; }
  }

  private keywordCosineSimilarity(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a.map(t => t.toLowerCase()));
    const setB = new Set(b.map(t => t.toLowerCase()));
    const intersecao = [...setA].filter(t => setB.has(t)).length;
    return intersecao / Math.sqrt(setA.size * setB.size);
  }

  private vectorToString(v: number[]): string {
    return `[${v.join(',')}]`;
  }

  async indexarGuideline(id: string): Promise<void> {
    const g = await this.prisma.guidelineClinica.findUnique({ where: { id } });
    if (!g) return;
    const texto = `${g.titulo} ${g.conteudo}`;

    const embedding = await this.gerarEmbedding(texto);

    if (embedding) {
      if (this.pgvectorDisponivel) {
        const vecStr = this.vectorToString(embedding);
        await this.prisma.$executeRaw`
          UPDATE guidelines_clinicas
          SET "embeddingJson" = ${JSON.stringify(embedding)},
              embedding = ${vecStr}::vector
          WHERE id = ${id}
        `;
      } else {
        await this.prisma.guidelineClinica.update({
          where: { id },
          data: { embeddingJson: JSON.stringify(embedding) },
        });
      }
    } else {
      const termos = await this.extrairTermosClinicos(texto);
      await this.prisma.guidelineClinica.update({
        where: { id },
        data: { embeddingJson: JSON.stringify(termos) },
      });
    }
  }

  async reindexarTodos(): Promise<{ indexados: number }> {
    const guidelines = await this.prisma.guidelineClinica.findMany({
      where: { ativo: true },
      select: { id: true },
      take: 50,
    });
    for (const g of guidelines) {
      await this.indexarGuideline(g.id).catch(err =>
        this.logger.warn(`Indexação falhou para ${g.id}`, (err as any)?.message)
      );
    }
    return { indexados: guidelines.length };
  }

  async buscarPorSimilaridade(query: string, limite = 5): Promise<any[]> {
    // Fast path: pgvector HNSW index
    if (this.pgvectorDisponivel && this.openai) {
      const queryVec = await this.gerarEmbedding(query);
      if (queryVec) {
        const vecStr = this.vectorToString(queryVec);
        const rows = await this.prisma.$queryRaw<any[]>`
          SELECT id, titulo, categoria, conteudo, fonte, versao, "criadoEm",
                 1 - (embedding <=> ${vecStr}::vector) AS score
          FROM guidelines_clinicas
          WHERE ativo = true
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${vecStr}::vector
          LIMIT ${limite}
        `;
        return rows.filter(r => r.score > 0.3);
      }
    }

    // Slow path: load all embeddings into memory and compute cosine in JS
    const guidelines = await this.prisma.guidelineClinica.findMany({
      where: { ativo: true, NOT: { embeddingJson: null } },
      select: { id: true, titulo: true, categoria: true, conteudo: true, fonte: true, versao: true, criadoEm: true, embeddingJson: true },
    });
    if (!guidelines.length) return [];

    let firstParsed: any[] = [];
    try { firstParsed = JSON.parse(guidelines[0].embeddingJson!); } catch { return []; }
    const isRealEmbedding = firstParsed.length > 100 && typeof firstParsed[0] === 'number';

    if (isRealEmbedding && this.openai) {
      const queryVec = await this.gerarEmbedding(query);
      if (!queryVec) return [];
      return guidelines
        .map(g => {
          let vec: number[] = [];
          try { vec = JSON.parse(g.embeddingJson!); } catch { return null; }
          return { ...g, score: cosineSimilarity(queryVec, vec) };
        })
        .filter((g): g is NonNullable<typeof g> => g !== null && g.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, limite)
        .map(({ embeddingJson: _, score: __, ...g }) => g);
    }

    // Fallback: keyword cosine
    const queryTermos = await this.extrairTermosClinicos(query).catch(() => [] as string[]);
    if (!queryTermos.length) return [];
    return guidelines
      .map(g => {
        const termos: string[] = (() => { try { return JSON.parse(g.embeddingJson!); } catch { return []; } })();
        return { ...g, score: this.keywordCosineSimilarity(queryTermos, termos) };
      })
      .filter(g => g.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limite)
      .map(({ embeddingJson: _, score: __, ...g }) => g);
  }

  criar(dto: CriarGuidelineDto) {
    return this.prisma.guidelineClinica.create({ data: dto });
  }

  listar(categoria?: string) {
    return this.prisma.guidelineClinica.findMany({
      where: { ativo: true, ...(categoria ? { categoria } : {}) },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async buscar(query: string, categoria?: string) {
    if (!query?.trim()) return [];

    try {
      const semanticos = await this.buscarPorSimilaridade(query, 5);
      const filtrados = categoria ? semanticos.filter(g => g.categoria === categoria) : semanticos;
      if (filtrados.length >= 2) return filtrados;
    } catch { /* fallback para FTS */ }

    // Fallback: PostgreSQL FTS
    let rows: any[];
    if (categoria) {
      rows = await this.prisma.$queryRaw<any[]>`
        SELECT id, titulo, categoria, conteudo, fonte, versao, "criadoEm"
        FROM guidelines_clinicas
        WHERE ativo = true
          AND categoria = ${categoria}
          AND to_tsvector('portuguese', titulo || ' ' || conteudo) @@ plainto_tsquery('portuguese', ${query})
        ORDER BY ts_rank(to_tsvector('portuguese', titulo || ' ' || conteudo), plainto_tsquery('portuguese', ${query})) DESC
        LIMIT 5
      `;
    } else {
      rows = await this.prisma.$queryRaw<any[]>`
        SELECT id, titulo, categoria, conteudo, fonte, versao, "criadoEm"
        FROM guidelines_clinicas
        WHERE ativo = true
          AND to_tsvector('portuguese', titulo || ' ' || conteudo) @@ plainto_tsquery('portuguese', ${query})
        ORDER BY ts_rank(to_tsvector('portuguese', titulo || ' ' || conteudo), plainto_tsquery('portuguese', ${query})) DESC
        LIMIT 5
      `;
    }
    return rows;
  }

  async uploadPdf(buffer: Buffer, titulo: string, categoria: string, fonte: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const { text } = await pdfParse(buffer);

    const CHUNK_SIZE = 1500;
    const OVERLAP = 200;
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + CHUNK_SIZE).trim());
      i += CHUNK_SIZE - OVERLAP;
    }

    const validos = chunks.filter(c => c.length > 100);
    if (validos.length === 0) return { chunks: 0 };

    await this.prisma.guidelineClinica.createMany({
      data: validos.map((conteudo, idx) => ({
        titulo: validos.length > 1 ? `${titulo} (${idx + 1}/${validos.length})` : titulo,
        categoria,
        conteudo,
        fonte,
      })),
    });
    return { chunks: validos.length };
  }

  remover(id: string) {
    return this.prisma.guidelineClinica.update({ where: { id }, data: { ativo: false } });
  }
}

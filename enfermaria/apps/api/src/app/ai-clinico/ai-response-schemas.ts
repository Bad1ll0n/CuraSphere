import { z } from 'zod';

export const EvidenciaSchema = z.object({
  tipo: z.enum(['sinal_vital', 'medicacao', 'nota', 'exame', 'alerta']),
  campo: z.string(),
  valor: z.string(),
  relevancia: z.enum(['alta', 'media']),
});

export const AnaliseClinicoSchema = z.object({
  observacoes: z.array(z.string()),
  padroesDetectados: z.array(z.string()).optional(),
  investigacoesAConsiderar: z.array(z.string()).optional(),
  evidencias: z.array(EvidenciaSchema).optional(),
  disclaimer: z.string().optional(),
});

export const TriagemSchema = z.object({
  alertasVermelhos: z.array(z.string()),
  nivelSugerido: z.enum(['vermelho', 'laranja', 'amarelo', 'verde', 'azul']),
  observacoes: z.array(z.string()),
  discriminadoresAvaliar: z.array(z.string()).optional(),
  disclaimer: z.string().optional(),
});

export const ProtocoloAiSchema = z.object({
  observacoes: z.array(z.string()),
});

export const TurnoSchema = z.object({
  narrativa: z.string(),
  destaques: z.array(z.string()),
  disclaimer: z.string().optional(),
});

export const LOSSchema = z.object({
  losEstimadoDias: z.number().min(0),
  confianca: z.enum(['alta', 'media', 'baixa']),
  factores: z.array(z.string()),
  alertaAtraso: z.boolean(),
  disclaimer: z.string().optional(),
});

export const WatchdogDeterioracaoSchema = z.object({
  deterioracao: z.boolean(),
  razao: z.string().max(120),
});

export const ReadmissaoSchema = z.object({
  risco: z.enum(['baixo', 'medio', 'alto']),
  factores: z.array(z.string()),
  recomendacoes: z.array(z.string()),
});

export const NLQSchema = z.object({
  where: z.record(z.unknown()).optional(),
  include: z.record(z.unknown()).optional(),
  take: z.number().min(1).max(20).optional(),
  explicacao: z.string().optional(),
});

export function parseWithSchema<T>(
  texto: string,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  try {
    const match = texto.match(/[\[{][\s\S]*/);
    if (!match) return fallback;
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const raw = JSON.parse(jsonMatch[0]);
    const result = schema.safeParse(raw);
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

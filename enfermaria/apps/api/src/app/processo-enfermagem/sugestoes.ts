/**
 * PROD-07 — ligação das escalas ao plano de cuidados: uma avaliação de risco sugere o
 * diagnóstico e o conjunto de intervenções associado. É sempre uma SUGESTÃO — o diagnóstico
 * de enfermagem é um juízo do enfermeiro, nunca criado automaticamente.
 */
import { parsearFrequenciaHoras } from '../medicacao/posologia';

export interface DadosParaSugestao {
  braden?: { risco: string; pontuacao: number; id: string } | null;
  morse?: { risco: string; pontuacao: number; id: string } | null;
  barthel?: { pontuacao: number | null; id: string } | null;
  nrs2002?: { pontuacao: number | null; id: string } | null;
  dor?: { valor: number; id: string } | null;
  /** Termos dos diagnósticos já ativos (não se volta a sugerir). */
  ativos: string[];
}

export interface Sugestao {
  diagnostico: string;
  juizo: string;
  /** Conjunto do catálogo base com as intervenções associadas. */
  conjunto: string | null;
  motivo: string;
  origemRef: string;
}

export function sugerirDiagnosticos(d: DadosParaSugestao): Sugestao[] {
  const s: Sugestao[] = [];
  if (d.braden && d.braden.risco !== 'baixo') {
    s.push({ diagnostico: 'Úlcera por pressão', juizo: 'risco', conjunto: 'Risco de úlcera por pressão', motivo: `Braden ${d.braden.pontuacao} (risco ${d.braden.risco})`, origemRef: d.braden.id });
  }
  if (d.morse && d.morse.risco !== 'baixo') {
    s.push({ diagnostico: 'Queda', juizo: 'risco', conjunto: 'Risco de queda', motivo: `Morse ${d.morse.pontuacao} (risco ${d.morse.risco})`, origemRef: d.morse.id });
  }
  if (d.barthel?.pontuacao != null && d.barthel.pontuacao <= 60) {
    s.push({ diagnostico: 'Autocuidado: higiene comprometido', juizo: 'dependente', conjunto: 'Doente dependente no autocuidado', motivo: `Barthel ${d.barthel.pontuacao}`, origemRef: d.barthel.id });
  }
  if (d.nrs2002?.pontuacao != null && d.nrs2002.pontuacao >= 3) {
    s.push({ diagnostico: 'Ingestão nutricional comprometida', juizo: 'risco', conjunto: null, motivo: `NRS 2002 ${d.nrs2002.pontuacao}`, origemRef: d.nrs2002.id });
  }
  if (d.dor && d.dor.valor >= 4) {
    s.push({ diagnostico: 'Dor', juizo: 'presente', conjunto: null, motivo: `Dor ${d.dor.valor}/10 no último registo`, origemRef: d.dor.id });
  }
  const ativos = new Set(d.ativos.map((t) => t.toLowerCase()));
  return s.filter((x) => !ativos.has(x.diagnostico.toLowerCase()));
}

/** Frequência aceite: horária (como na prescrição) ou SOS (sem horário). */
export function frequenciaValida(f: string): boolean {
  const t = (f ?? '').trim();
  if (!t || t.length > 40) return false;
  return /^sos$/i.test(t) || parsearFrequenciaHoras(t) != null;
}

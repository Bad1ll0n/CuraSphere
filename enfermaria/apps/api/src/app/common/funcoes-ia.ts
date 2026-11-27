import { ForbiddenException } from '@nestjs/common';

/**
 * PROD-19 — registo das funções de IA e o seu enquadramento.
 *
 * Software que influencia diagnóstico ou terapêutica é dispositivo médico (Reg. (UE) 2017/745,
 * Regra 11) e, com IA, sistema de alto risco no AI Act. Sem marcação CE nem avaliação clínica,
 * as funções em que um LLM DECIDE ou CLASSIFICA algo clínico ficam DESLIGADAS por omissão. As de
 * produtividade (rascunhos e resumos sempre revistos por um profissional) continuam ligadas.
 *
 * Ligar uma função de decisão exige uma decisão explícita e documentada da instituição:
 *   IA_DECISAO_CLINICA=diagnostico_diferencial,triagem_portal   (ou `todas`)
 * Ver docs/REGISTO-IA.md (finalidade, dados enviados, revisão humana, monitorização).
 */
export type TipoFuncaoIA = 'produtividade' | 'decisao_clinica';

export const FUNCOES_IA: Record<string, { tipo: TipoFuncaoIA; finalidade: string }> = {
  // Produtividade — o resultado é um texto que um profissional revê antes de usar.
  turno: { tipo: 'produtividade', finalidade: 'Narrativa de passagem de turno a partir dos dados estruturados' },
  carta_alta: { tipo: 'produtividade', finalidade: 'Rascunho de carta de alta (revisão e assinatura do médico obrigatórias)' },
  nlq: { tipo: 'produtividade', finalidade: 'Pesquisa em linguagem natural convertida em filtros' },
  icd10_sugestao: { tipo: 'produtividade', finalidade: 'Sugestão de códigos ICD-10 para codificação administrativa' },
  feedback_analysis: { tipo: 'produtividade', finalidade: 'Análise agregada do feedback às respostas da IA' },
  guidelines_resumo: { tipo: 'produtividade', finalidade: 'Resumo e pesquisa de normas/guidelines internas' },
  // Decisão clínica por LLM — desligadas até haver estratégia regulamentar.
  analisar: { tipo: 'decisao_clinica', finalidade: 'Análise clínica do doente (riscos, sugestões)' },
  triagem: { tipo: 'decisao_clinica', finalidade: 'Triagem/priorização clínica' },
  protocolo: { tipo: 'decisao_clinica', finalidade: 'Recomendação sobre protocolos clínicos' },
  los: { tipo: 'decisao_clinica', finalidade: 'Previsão de duração de internamento' },
  watchdog: { tipo: 'decisao_clinica', finalidade: 'Detecção de deterioração por LLM' },
  readmissao: { tipo: 'decisao_clinica', finalidade: 'Risco de readmissão' },
  diagnostico_diferencial: { tipo: 'decisao_clinica', finalidade: 'Diagnóstico diferencial' },
  staffing: { tipo: 'decisao_clinica', finalidade: 'Previsão de necessidades de pessoal' },
  interacoes_medicacao: { tipo: 'decisao_clinica', finalidade: 'Interacções medicamentosas avaliadas por LLM (podia BLOQUEAR prescrições)' },
  ajuste_renal: { tipo: 'decisao_clinica', finalidade: 'Ajuste de dose à função renal' },
  analise_ferida: { tipo: 'decisao_clinica', finalidade: 'Análise de fotografias de feridas' },
  triagem_portal: { tipo: 'decisao_clinica', finalidade: 'Triagem de sintomas para o doente (auto-cuidado / urgência)' },
  stewardship: { tipo: 'decisao_clinica', finalidade: 'Sugestão de de-escalação antibiótica' },
};

function decisaoActivas(): Set<string> {
  return new Set((process.env['IA_DECISAO_CLINICA'] ?? '').split(',').map((s) => s.trim()).filter(Boolean));
}

/** A função de IA pode correr? Funções desconhecidas são tratadas como decisão clínica (fecha). */
export function iaPermitida(funcao: string): boolean {
  const f = FUNCOES_IA[funcao];
  if (f?.tipo === 'produtividade') return true;
  const activas = decisaoActivas();
  return activas.has('todas') || activas.has(funcao);
}

export function exigirIaPermitida(funcao: string): void {
  if (!iaPermitida(funcao)) {
    throw new ForbiddenException(
      `Função de IA "${funcao}" desactivada: decisão clínica por IA sem enquadramento regulamentar ` +
      '(MDR / AI Act). Ver docs/REGISTO-IA.md.',
    );
  }
}

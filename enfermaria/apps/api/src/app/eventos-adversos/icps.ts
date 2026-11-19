/**
 * PROD-18 — taxonomia da OMS para a segurança do doente (ICPS, International Classification for
 * Patient Safety, 2009): os 13 tipos de incidente e o grau de dano. É a base do NOTIFICA (DGS),
 * para onde os incidentes são exportados.
 */
export const CLASSES_ICPS = {
  administracao_clinica: 'Administração clínica (admissão, alta, transferência, identificação)',
  processo_clinico: 'Processo/procedimento clínico (avaliação, diagnóstico, tratamento, cuidados)',
  documentacao: 'Documentação (registos, pedidos, rótulos)',
  infecao_associada: 'Infeção associada aos cuidados de saúde',
  medicacao_fluidos: 'Medicação / fluidos IV',
  sangue_derivados: 'Sangue / derivados',
  nutricao: 'Nutrição',
  oxigenio_gases: 'Oxigénio / gases',
  dispositivos_equipamentos: 'Dispositivos / equipamentos médicos',
  comportamento: 'Comportamento (doente ou profissional)',
  acidente_doente: 'Acidente do doente (inclui quedas)',
  infraestruturas: 'Infraestruturas / edifício',
  recursos_gestao: 'Recursos / gestão organizacional',
} as const;
export type ClasseIcps = keyof typeof CLASSES_ICPS;

/** Classe por omissão a partir do tipo interno (usada quando quem notifica não escolhe). */
export const ICPS_DO_TIPO: Record<string, ClasseIcps | undefined> = {
  queda: 'acidente_doente',
  erro_medicacao: 'medicacao_fluidos',
  infecao: 'infecao_associada',
  lesao_pressao: 'processo_clinico',
};

/** Grau de dano ICPS a partir da gravidade interna. */
export const DANO_ICPS: Record<string, 'nenhum' | 'ligeiro' | 'moderado' | 'grave' | 'morte'> = {
  sem_dano: 'nenhum', dano_leve: 'ligeiro', dano_moderado: 'moderado', dano_grave: 'grave', obito: 'morte',
};

export function classeIcps(tipo: string, escolhida?: string | null): ClasseIcps | null {
  if (escolhida) return escolhida in CLASSES_ICPS ? (escolhida as ClasseIcps) : null;
  return ICPS_DO_TIPO[tipo] ?? null;
}

/**
 * Registo no formato de exportação para o NOTIFICA: sem identificação do doente nem do
 * notificador (o NOTIFICA é anónimo e não punitivo). O carregamento é feito pela gestão de risco
 * na plataforma da DGS; a integração direta exige credenciais da instituição.
 */
export function registoNotifica(e: {
  id: string; tipo: string; gravidade: string; descricao: string; servicoId: string | null; acaoCorretiva: string | null;
  ocorridoEm: Date; classeIcps: string | null;
}) {
  const classe = classeIcps(e.tipo, e.classeIcps);
  return {
    referenciaInterna: e.id,
    dataOcorrencia: e.ocorridoEm.toISOString().slice(0, 10),
    horaOcorrencia: e.ocorridoEm.toISOString().slice(11, 16),
    tipoIncidenteIcps: classe,
    tipoIncidenteIcpsDescricao: classe ? CLASSES_ICPS[classe] : null,
    quaseIncidente: e.tipo === 'near_miss',
    grauDano: e.tipo === 'near_miss' ? 'nenhum' : (DANO_ICPS[e.gravidade] ?? null),
    servico: e.servicoId,
    descricao: e.descricao,
    acoesTomadas: e.acaoCorretiva,
  };
}

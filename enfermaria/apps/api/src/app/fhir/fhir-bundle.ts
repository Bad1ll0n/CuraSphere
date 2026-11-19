/**
 * PROD-14 — exportação do registo do doente como Bundle FHIR R4 do tipo `document`.
 *
 * O que estava errado na versão anterior (e o validador oficial recusaria):
 *  - Bundle `document` sem `Composition` na primeira entrada e sem `identifier`;
 *  - `MedicationStatement.medication.concept` é R5 — em R4 é `medicationCodeableConcept`;
 *  - `Observation` sem `status` (obrigatório) e `valueQuantity` com `system` mas sem `code`;
 *  - `AllergyIntolerance.reaction.severity` com valores em português ('grave', 'leve') e sem
 *    `manifestation` (obrigatória em cada reação); sem `clinicalStatus`/`criticality`;
 *  - `Patient` sem `gender` nem o número de utente SNS;
 *  - `fullUrl` que não era um URL absoluto nem `urn:uuid`.
 *
 * Os sistemas de identificadores (SNS, processo do HIS) vêm de configuração: têm de ser os dos
 * perfis nacionais publicados pela SPMS, e a conformidade final confirma-se com o validador
 * oficial (ver docs/INTEROPERABILIDADE.md).
 */

export interface DadosExportacao {
  doente: {
    id: string; nome: string; numeroProcesso: string; identificadorHis: string | null; numeroSNS: string | null;
    dataNascimento: Date | null; sexo: string | null;
  };
  medicacoes: { id: string; nome: string; dose: string; via: string; frequencia: string; iniciadoEm: Date }[];
  sinaisVitais: { id: string; data: Date; pulso: number | null; pressaoSistolica: number | null; pressaoDiastolica: number | null; temperatura: number | null; saturacaoO2: number | null; frequenciaRespiratoria: number | null }[];
  alergias: { id: string; alergenio: string; tipo: string; severidade: string; reacao: string | null; certeza: string | null; notas: string | null }[];
  problemas: { id: string; descricao: string; tipo: string }[];
}

export interface ConfigFhir { base: string; sistemaSns: string; sistemaProcesso: string; sistemaHis: string; organizacao: string }

export function configFhir(): ConfigFhir {
  const base = (process.env['FHIR_BASE_URL'] || 'https://curasphere.local/fhir').replace(/\/+$/, '');
  return {
    base,
    sistemaSns: process.env['FHIR_SISTEMA_SNS'] || 'urn:pt:sns:numero-utente',
    sistemaProcesso: process.env['FHIR_SISTEMA_PROCESSO'] || `${base}/sid/processo`,
    sistemaHis: process.env['FHIR_SISTEMA_HIS'] || `${base}/sid/processo-his`,
    organizacao: process.env['FHIR_ORGANIZACAO'] || 'Hospital (CuraSphere)',
  };
}

const GENERO: Record<string, string> = { masculino: 'male', feminino: 'female', indeterminado: 'unknown' };
const CATEGORIA_ALERGIA: Record<string, string> = { medicamento: 'medication', contraste: 'medication', alimento: 'food', ambiental: 'environment', latex: 'environment' };
const SEVERIDADE_REACAO: Record<string, 'mild' | 'moderate' | 'severe'> = { leve: 'mild', moderada: 'moderate', grave: 'severe', anafilaxia: 'severe' };
const dia = (d: Date) => d.toISOString().slice(0, 10);
const cc = (system: string, code: string, display?: string) => ({ coding: [{ system, code, ...(display ? { display } : {}) }] });

export function construirBundleR4(dados: DadosExportacao, cfg: ConfigFhir = configFhir(), agora = new Date()) {
  const { doente } = dados;
  const url = (tipo: string, id: string) => `${cfg.base}/${tipo}/${id}`;
  const ref = (tipo: string, id: string) => ({ reference: `${tipo}/${id}` });
  const paciente = ref('Patient', doente.id);
  const orgId = 'curasphere';

  const patient = {
    resourceType: 'Patient', id: doente.id,
    identifier: [
      ...(doente.numeroSNS ? [{ use: 'official', system: cfg.sistemaSns, value: doente.numeroSNS }] : []),
      ...(doente.identificadorHis ? [{ use: 'usual', system: cfg.sistemaHis, value: doente.identificadorHis }] : []),
      { use: 'secondary', system: cfg.sistemaProcesso, value: doente.numeroProcesso },
    ],
    name: [{ text: doente.nome }],
    gender: GENERO[doente.sexo ?? ''] ?? 'unknown',
    ...(doente.dataNascimento ? { birthDate: dia(doente.dataNascimento) } : {}),
  };
  const organization = { resourceType: 'Organization', id: orgId, name: cfg.organizacao };

  const condicoes = dados.problemas.map((p) => ({
    resourceType: 'Condition', id: p.id,
    clinicalStatus: cc('http://terminology.hl7.org/CodeSystem/condition-clinical', 'active'),
    category: [cc('http://terminology.hl7.org/CodeSystem/condition-category', 'problem-list-item')],
    code: { text: p.descricao },
    subject: paciente,
  }));

  const medicacoes = dados.medicacoes.map((m) => ({
    resourceType: 'MedicationStatement', id: m.id,
    status: 'active',
    medicationCodeableConcept: { text: m.nome },
    subject: paciente,
    effectivePeriod: { start: m.iniciadoEm.toISOString() },
    dosage: [{ text: `${m.dose} · ${m.via} · ${m.frequencia}`, route: { text: m.via } }],
  }));

  const VITAIS: [keyof DadosExportacao['sinaisVitais'][number], string, string, string][] = [
    ['pulso', '8867-4', 'Heart rate', '/min'], ['temperatura', '8310-5', 'Body temperature', 'Cel'],
    ['saturacaoO2', '59408-5', 'Oxygen saturation in Arterial blood by Pulse oximetry', '%'], ['frequenciaRespiratoria', '9279-1', 'Respiratory rate', '/min'],
    ['pressaoSistolica', '8480-6', 'Systolic blood pressure', 'mm[Hg]'], ['pressaoDiastolica', '8462-4', 'Diastolic blood pressure', 'mm[Hg]'],
  ];
  const observacoes = dados.sinaisVitais.flatMap((sv) => VITAIS.filter(([k]) => sv[k] != null).map(([k, code, display, unidade]) => ({
    resourceType: 'Observation', id: `${sv.id}-${code}`,
    status: 'final',
    category: [cc('http://terminology.hl7.org/CodeSystem/observation-category', 'vital-signs', 'Vital Signs')],
    code: cc('http://loinc.org', code, display),
    subject: paciente,
    effectiveDateTime: sv.data.toISOString(),
    valueQuantity: { value: sv[k] as number, unit: unidade, system: 'http://unitsofmeasure.org', code: unidade },
  })));

  const alergias = dados.alergias.map((a) => ({
    resourceType: 'AllergyIntolerance', id: a.id,
    clinicalStatus: cc('http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', 'active'),
    verificationStatus: cc('http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', a.certeza === 'confirmada' ? 'confirmed' : 'unconfirmed'),
    type: 'allergy',
    ...(CATEGORIA_ALERGIA[a.tipo] ? { category: [CATEGORIA_ALERGIA[a.tipo]] } : {}),
    criticality: a.severidade === 'grave' || a.severidade === 'anafilaxia' ? 'high' : 'low',
    code: { text: a.alergenio },
    patient: paciente,
    ...(a.reacao || a.notas ? { reaction: [{ manifestation: [{ text: a.reacao || a.notas }], ...(SEVERIDADE_REACAO[a.severidade] ? { severity: SEVERIDADE_REACAO[a.severidade] } : {}) }] } : {}),
  }));

  const seccao = (titulo: string, loinc: string, recursos: { resourceType: string; id: string }[]) => recursos.length ? [{
    title: titulo, code: cc('http://loinc.org', loinc), entry: recursos.map((r) => ref(r.resourceType, r.id)),
  }] : [];
  const composition = {
    resourceType: 'Composition', id: `${doente.id}-resumo`,
    status: 'final',
    type: cc('http://loinc.org', '60591-5', 'Patient summary Document'),
    subject: paciente,
    date: agora.toISOString(),
    author: [ref('Organization', orgId)],
    title: `Resumo do doente — ${doente.nome}`,
    section: [
      ...seccao('Alergias e intolerâncias', '48765-2', alergias),
      ...seccao('Medicação', '10160-0', medicacoes),
      ...seccao('Problemas', '11450-4', condicoes),
      ...seccao('Sinais vitais', '8716-3', observacoes),
    ],
  };

  const recursos = [composition, patient, organization, ...alergias, ...medicacoes, ...condicoes, ...observacoes];
  return {
    resourceType: 'Bundle',
    identifier: { system: `${cfg.base}/sid/bundle`, value: `${doente.id}-${agora.getTime()}` },
    type: 'document',
    timestamp: agora.toISOString(),
    entry: recursos.map((r) => ({ fullUrl: url(r.resourceType, r.id), resource: r })),
  };
}

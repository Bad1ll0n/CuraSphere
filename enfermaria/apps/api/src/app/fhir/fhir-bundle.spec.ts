import { construirBundleR4, type DadosExportacao } from './fhir-bundle';

/**
 * PROD-14 — invariantes de um Bundle `document` FHIR R4. Não substitui o validador oficial
 * (docs/INTEROPERABILIDADE.md), mas impede o regresso dos erros estruturais que havia.
 */
describe('exportação FHIR R4 (Bundle document)', () => {
  const cfg = { base: 'https://h.example/fhir', sistemaSns: 'urn:sns', sistemaProcesso: 'urn:proc', sistemaHis: 'urn:his', organizacao: 'Hospital X' };
  const dados: DadosExportacao = {
    doente: { id: 'd1', nome: 'Maria Silva', numeroProcesso: '2026-1', identificadorHis: '123456', numeroSNS: '987654321', dataNascimento: new Date('1950-05-05T00:00:00Z'), sexo: 'feminino' },
    medicacoes: [{ id: 'm1', nome: 'Amoxicilina 500 mg', dose: '500 mg', via: 'oral', frequencia: '8/8h', iniciadoEm: new Date('2026-11-18T10:00:00Z') }],
    sinaisVitais: [{ id: 'sv1', data: new Date('2026-11-19T08:00:00Z'), pulso: 88, pressaoSistolica: 120, pressaoDiastolica: null, temperatura: null, saturacaoO2: 95, frequenciaRespiratoria: null }],
    alergias: [
      { id: 'a1', alergenio: 'Penicilina', tipo: 'medicamento', severidade: 'anafilaxia', reacao: 'Edema da glote', certeza: 'confirmada', notas: null },
      { id: 'a2', alergenio: 'Pó', tipo: 'ambiental', severidade: 'leve', reacao: null, certeza: null, notas: null },
    ],
    problemas: [{ id: 'p1', descricao: 'Pneumonia', tipo: 'principal' }],
  };
  const b = construirBundleR4(dados, cfg, new Date('2026-11-19T09:00:00Z'));
  const recursos = b.entry.map((e) => e.resource as any);
  const de = (tipo: string) => recursos.filter((r) => r.resourceType === tipo);

  it('document com identifier, timestamp e Composition na primeira entrada', () => {
    expect(b).toMatchObject({ resourceType: 'Bundle', type: 'document', timestamp: '2026-11-19T09:00:00.000Z', identifier: { value: expect.any(String) } });
    expect(recursos[0]).toMatchObject({ resourceType: 'Composition', status: 'final', subject: { reference: 'Patient/d1' }, author: [{ reference: 'Organization/curasphere' }] });
  });

  it('fullUrl absoluto e todas as referências resolvem dentro do Bundle', () => {
    const urls = new Set(b.entry.map((e) => e.fullUrl));
    for (const u of urls) expect(u).toMatch(/^https:\/\/h\.example\/fhir\/[A-Za-z]+\/[\w-]+$/);
    const refs: string[] = JSON.stringify(b).match(/"reference":"[^"]+"/g)!.map((m) => m.slice(13, -1));
    for (const r of refs) expect(urls.has(`${cfg.base}/${r}`)).toBe(true);
  });

  it('Patient com SNS, identificador do HIS, gender e birthDate', () => {
    const [p] = de('Patient');
    expect(p.identifier).toEqual(expect.arrayContaining([{ use: 'official', system: 'urn:sns', value: '987654321' }, { use: 'usual', system: 'urn:his', value: '123456' }]));
    expect(p).toMatchObject({ gender: 'female', birthDate: '1950-05-05' });
  });

  it('MedicationStatement R4 (medicationCodeableConcept, não o "medication.concept" do R5)', () => {
    const [m] = de('MedicationStatement');
    expect(m.medicationCodeableConcept).toEqual({ text: 'Amoxicilina 500 mg' });
    expect(m.medication).toBeUndefined();
    expect(m.status).toBe('active');
  });

  it('Observation com status, categoria vital-signs e UCUM com code', () => {
    const obs = de('Observation');
    expect(obs).toHaveLength(3);
    for (const o of obs) {
      expect(o.status).toBe('final');
      expect(o.category[0].coding[0].code).toBe('vital-signs');
      expect(o.valueQuantity.code).toBe(o.valueQuantity.unit);
    }
  });

  it('AllergyIntolerance com códigos FHIR (criticality, severity em inglês, manifestation obrigatória)', () => {
    const [penicilina, po] = de('AllergyIntolerance');
    expect(penicilina).toMatchObject({ criticality: 'high', category: ['medication'], reaction: [{ severity: 'severe', manifestation: [{ text: 'Edema da glote' }] }] });
    expect(penicilina.verificationStatus.coding[0].code).toBe('confirmed');
    expect(po).toMatchObject({ criticality: 'low', category: ['environment'] });
    expect(po.reaction).toBeUndefined(); // sem manifestação, sem reação (seria inválida)
    expect(JSON.stringify(b)).not.toMatch(/"severity":"(grave|leve|moderada|anafilaxia)"/);
  });

  it('secções da Composition só com o que existe', () => {
    expect(recursos[0].section.map((s: any) => s.title)).toEqual(['Alergias e intolerâncias', 'Medicação', 'Problemas', 'Sinais vitais']);
    const semNada = construirBundleR4({ ...dados, alergias: [], medicacoes: [], sinaisVitais: [], problemas: [] }, cfg);
    expect((semNada.entry[0].resource as any).section).toEqual([]);
  });
});

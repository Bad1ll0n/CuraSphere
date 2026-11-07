import { Icd10Service } from './icd10.service';
import { ICD10_CODES } from './icd10-data';

// QA-21 — módulo sem spec: pesquisa e resolução de códigos ICD-10.
describe('Icd10Service', () => {
  const svc = new Icd10Service();

  it('consulta curta (< 2 caracteres) não devolve nada', () => {
    expect(svc.buscar('')).toEqual([]);
    expect(svc.buscar(' a ')).toEqual([]);
  });

  it('encontra por prefixo de código e por descrição, sem distinguir maiúsculas', () => {
    expect(svc.buscar('a40').every((r) => r.code.startsWith('A40'))).toBe(true);
    expect(svc.buscar('SEPTICEMIA').length).toBeGreaterThan(0);
  });

  it('respeita o limite', () => {
    expect(svc.buscar('a', 3)).toEqual([]);
    expect(svc.buscar('de', 3).length).toBeLessThanOrEqual(3);
  });

  it('resolver: código conhecido (em minúsculas também) e desconhecido', () => {
    expect(svc.resolver('a40.0')).toEqual({ code: 'A40.0', descricao: ICD10_CODES['A40.0'] });
    expect(svc.resolver('ZZZ.9')).toBeNull();
  });
});

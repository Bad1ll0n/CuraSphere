import { Injectable } from '@nestjs/common';
import { ICD10_CODES } from './icd10-data';

export interface Icd10Result {
  code: string;
  descricao: string;
}

@Injectable()
export class Icd10Service {
  buscar(query: string, limit = 10): Icd10Result[] {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const results: Icd10Result[] = [];

    for (const [code, descricao] of Object.entries(ICD10_CODES)) {
      if (
        code.toLowerCase().startsWith(q) ||
        descricao.toLowerCase().includes(q)
      ) {
        results.push({ code, descricao });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  resolver(code: string): Icd10Result | null {
    const descricao = ICD10_CODES[code.toUpperCase()];
    return descricao ? { code: code.toUpperCase(), descricao } : null;
  }
}

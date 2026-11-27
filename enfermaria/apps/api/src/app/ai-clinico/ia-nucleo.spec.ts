import { readFileSync } from 'fs';
import { join } from 'path';
import { extrairArrayJson, textoDaResposta } from './ia-nucleo.service';
import { declivNews2 } from './ai-vigilancia.service';
import { filtroPeriodo } from './ai-relatorios.service';

// ARQ-06: o antigo serviço único foi dividido; estas funções eram repetidas em vários métodos.
describe('ARQ-06 — núcleo de IA e funções partilhadas', () => {
  it('textoDaResposta devolve o texto ou o valor por omissão', () => {
    expect(textoDaResposta({ content: [{ type: 'text', text: 'olá' }] } as any, '{}')).toBe('olá');
    expect(textoDaResposta({ content: [{ type: 'tool_use' }] } as any, '[]')).toBe('[]');
    expect(textoDaResposta({ content: [] } as any, '{}')).toBe('{}');
  });

  it('extrairArrayJson tira o array do meio do texto e nunca lança', () => {
    expect(extrairArrayJson('Aqui está: [{"code":"J18.9"}] fim')).toEqual([{ code: 'J18.9' }]);
    expect(extrairArrayJson('sem json')).toEqual([]);
    expect(extrairArrayJson('[mal formado')).toEqual([]);
    expect(extrairArrayJson('{"a":1}')).toEqual([]);
  });

  it('declivNews2: 0 com menos de 3 medições, positivo quando sobe', () => {
    expect(declivNews2([{ news2: 1 }, { news2: 5 }])).toBe(0);
    expect(declivNews2([{ news2: 1 }, { news2: null }, { news2: 3 }, { news2: 5 }])).toBeCloseTo(2);
    expect(declivNews2([{ news2: 4 }, { news2: 4 }, { news2: 4 }])).toBe(0);
  });

  it('filtroPeriodo só inclui os limites dados', () => {
    expect(filtroPeriodo()).toEqual({});
    expect(filtroPeriodo('2026-01-01')).toEqual({ criadoEm: { gte: new Date('2026-01-01') } });
    expect(filtroPeriodo(undefined, '2026-02-01')).toEqual({ criadoEm: { lte: new Date('2026-02-01') } });
  });

  it('a escalação de alertas (sem IA) não vive no módulo de IA nem depende do portão da IA', () => {
    const app = join(__dirname, '..');
    const esc = readFileSync(join(app, 'alertas', 'escalacao-alertas.service.ts'), 'utf8');
    expect(esc).toContain('async escalarAlertasNaoRespondidos(');
    expect(esc).not.toMatch(/iaPermitida|callAI/);
    for (const f of ['ai-clinico.service.ts', 'ai-vigilancia.service.ts', 'ai-relatorios.service.ts', 'ia-nucleo.service.ts']) {
      expect(readFileSync(join(__dirname, f), 'utf8')).not.toContain('escalarAlertasNaoRespondidos');
    }
  });

  it('só o núcleo cria o cliente do modelo', () => {
    for (const f of ['ai-clinico.service.ts', 'ai-vigilancia.service.ts', 'ai-relatorios.service.ts']) {
      expect(readFileSync(join(__dirname, f), 'utf8')).not.toMatch(/new Anthropic\(/);
    }
  });
});

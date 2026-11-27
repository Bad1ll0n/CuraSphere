import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classeDeATC, dciDoNome, gravarItensCatalogo, lerCsvCatalogo, unidadeDaForma } from './catalogo-nacional';
import amostra from './catalogo-amostra.json';
import { contemTermo, fonteInteracoes, recarregarInteracoes, verificarInteracao } from '../medicacao/interacoes';
import { ajusteRenal, estadioKdigo } from '../medicacao/ajuste-renal';

describe('PROD-05 — catálogo nacional: leitura do ficheiro INFARMED', () => {
  it('reconhece colunas por sinónimos, separador ";" e aspas; deriva classe ATC e unidade', () => {
    const csv = [
      '\uFEFFNome do Medicamento;Substância Ativa/DCI;Forma Farmacêutica;Dosagem;Código ATC;Via de Administração;CHNM',
      'Ben-u-ron;Paracetamol;Comprimido;1000 mg;N02BE01;Oral;10001234',
      '"Clavamox; genérico";Amoxicilina + Ácido clavulânico;Pó para solução injetável;1000 mg + 200 mg;J01CR02;Intravenosa;10005678',
      ';;Comprimido;5 mg;;;',
    ].join('\r\n');
    expect(() => lerCsvCatalogo('Nome;Dosagem\nX;1 mg')).toThrow(/colunas obrigatórias/);
    const r = lerCsvCatalogo(csv);
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0]).toMatchObject({
      dci: 'Paracetamol', nomeMarca: 'Ben-u-ron', concentracao: '1000 mg', codigoATC: 'N02BE01', codigoCHNM: '10001234',
      classeTerap: 'Sistema nervoso', unidade: 'comprimido',
    });
    expect(r.itens[1].nomeMarca).toBe('Clavamox; genérico');
    expect(r.rejeitadas).toEqual([{ linha: 4, motivo: 'sem DCI ou forma farmacêutica' }]);
  });

  it('tabulação e vírgula também servem', () => {
    expect(lerCsvCatalogo('DCI\tForma farmacêutica\nOmeprazol\tCápsula').itens[0]).toMatchObject({ dci: 'Omeprazol', unidade: 'cápsula' });
    expect(lerCsvCatalogo('dci,forma\nHeparina sódica,Solução injetável').itens[0]).toMatchObject({ unidade: 'ampola', classeTerap: 'Não classificado' });
  });

  it('classe pelo grupo ATC e unidade pela forma', () => {
    expect(classeDeATC('J01CA04')).toBe('Anti-infecciosos de uso sistémico');
    expect(unidadeDaForma('Solução injetável em seringa pré-cheia')).toBe('seringa');
  });

  it('a amostra tem DCI, forma, via e ATC em todas as linhas', () => {
    for (const i of amostra.itens) {
      expect([i.dci, i.formaFarmaceutica, i.via, i.classeTerap, i.unidade].every(Boolean)).toBe(true);
      expect(i.codigoATC).toMatch(/^[A-Z]\d\d[A-Z]{2}\d\d$/);
    }
  });

  it('gravação idempotente: actualiza por CHNM, cria o que não existe', async () => {
    const prisma = {
      catalogoMedicamento: {
        findUnique: jest.fn().mockResolvedValueOnce({ id: 'c1' }),
        findFirst: jest.fn().mockResolvedValueOnce(null),
        update: jest.fn(), create: jest.fn(),
      },
    };
    const r = await gravarItensCatalogo(prisma, [
      { dci: 'Paracetamol', formaFarmaceutica: 'Comprimido', codigoCHNM: '1', classeTerap: 'x', unidade: 'comprimido' },
      { dci: 'Omeprazol', formaFarmaceutica: 'Cápsula', classeTerap: 'x', unidade: 'cápsula' },
    ], 'infarmed', '2026-11');
    expect(r).toEqual({ criados: 1, atualizados: 1, total: 2 });
    expect(prisma.catalogoMedicamento.update.mock.calls[0][0].data).toMatchObject({ fonte: 'infarmed', versaoFonte: '2026-11' });
  });
});

describe('PROD-05 — DCI de um nome prescrito', () => {
  const dcis = amostra.itens.map((i) => i.dci);
  it('marca → DCI, sal omitido, combinação preferida à substância isolada', () => {
    expect(dciDoNome('Ben-u-ron 1 g', dcis)).toBe('Paracetamol');
    expect(dciDoNome('Enoxaparina 40 mg', dcis)).toBe('Enoxaparina sódica');
    expect(dciDoNome('Amoxicilina + ácido clavulânico 875/125', dcis)).toBe('Amoxicilina + Ácido clavulânico');
    expect(dciDoNome('Amoxicilina 500 mg', dcis)).toBe('Amoxicilina');
    expect(dciDoNome('Cloreto de sódio 0,9%', dcis)).toBe('Cloreto de sódio');
    expect(dciDoNome('Xarope da avó', dcis)).toBeNull();
  });
});

describe('PROD-05 — interacções determinísticas', () => {
  afterEach(() => { delete process.env['INTERACOES_FICHEIRO']; recarregarInteracoes(); });

  it('compara por substância e por classe, não por pedaços de texto', () => {
    expect(contemTermo('Aspirina 100 mg', 'aspirina')).toBe(true);
    expect(contemTermo('Ácido acetilsalicílico 100 mg', 'aspirina')).toBe(true);
    expect(contemTermo('Midazolam 5 mg', 'benzodiazepinas')).toBe(true);
    expect(contemTermo('Fentanilo 0,05 mg', 'fentanil')).toBe(true);
    // Antes: a primeira palavra "a" de um nome contido em qualquer termo dava interacção.
    expect(verificarInteracao('A', ['Warfarina 5 mg'])).toEqual([]);
    expect(verificarInteracao('Ácido acetilsalicílico 100 mg', ['Varfarina 5 mg'])[0]).toMatchObject({ severidade: 'grave' });
  });

  it('base licenciada por INTERACOES_FICHEIRO, com fonte e versão; ficheiro inválido cai na interna', () => {
    const dir = mkdtempSync(join(tmpdir(), 'int-'));
    const f = join(dir, 'base.json');
    writeFileSync(f, JSON.stringify({ fonte: 'Base X', versao: '7.1', data: '2026-10-01', interacoes: [{ med1: 'omeprazol', med2: 'clopidogrel', severidade: 'contraindicada', descricao: 'teste' }] }));
    process.env['INTERACOES_FICHEIRO'] = f; recarregarInteracoes();
    expect(fonteInteracoes()).toEqual({ fonte: 'Base X', versao: '7.1', data: '2026-10-01', pares: 1 });
    expect(verificarInteracao('Clopidogrel 75 mg', ['Omeprazol 20 mg'])[0].severidade).toBe('contraindicada');
    writeFileSync(f, '{"sem": "campos"}'); recarregarInteracoes();
    expect(fonteInteracoes().fonte).toMatch(/Base interna/);
  });
});

describe('PROD-05 — ajuste renal determinístico', () => {
  it('estádio KDIGO', () => {
    expect([95, 70, 50, 35, 20, 10].map(estadioKdigo)).toEqual(['G1', 'G2', 'G3a', 'G3b', 'G4', 'G5']);
  });
  it('a regra da faixa certa, com fonte; nada quando não se aplica', () => {
    expect(ajusteRenal('Metformina 850 mg', 25)?.texto).toMatch(/Contraindicada/);
    expect(ajusteRenal('Metformina 850 mg', 40)?.texto).toMatch(/1000 mg\/dia/);
    expect(ajusteRenal('Metformina 850 mg', 80)).toBeNull();
    expect(ajusteRenal('Enoxaparina 40 mg', 20)).toMatchObject({ texto: expect.stringMatching(/2000 UI/), fonte: expect.stringMatching(/RCM/) });
    expect(ajusteRenal('Paracetamol 1 g', 10)).toBeNull();
  });
});

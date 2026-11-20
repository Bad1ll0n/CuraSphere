import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { celulaCsv, linhaCsv } from './csv';

describe('CSV seguro (SEC-15)', () => {
  it.each([
    ['=HYPERLINK("http://mau.pt","x")', `"'=HYPERLINK(""http://mau.pt"",""x"")"`],
    ['+351 912', "'+351 912"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['-2+3', "'-2+3"],
    ['\t=1', "'\t=1"],
  ])('neutraliza o início de fórmula: %s', (entrada, saida) => {
    expect(celulaCsv(entrada)).toBe(saida);
  });

  it('números (incluindo negativos e com vírgula) ficam como estão', () => {
    expect(celulaCsv(-3)).toBe('-3');
    expect(celulaCsv('-12,5', ';')).toBe('-12,5');
    expect(celulaCsv(42)).toBe('42');
  });

  it('aspas, separador e quebras de linha', () => {
    expect(celulaCsv('a,b')).toBe('"a,b"');
    expect(celulaCsv('a;b', ';')).toBe('"a;b"');
    expect(celulaCsv('a,b', ';')).toBe('a,b');
    expect(celulaCsv('diz "olá"')).toBe('"diz ""olá"""');
    expect(celulaCsv('linha\nnova')).toBe('"linha\nnova"');
  });

  it('nulos, datas e objetos', () => {
    expect(celulaCsv(null)).toBe('');
    expect(celulaCsv(undefined)).toBe('');
    expect(celulaCsv(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
    expect(celulaCsv({ a: 1 })).toBe('"{""a"":1}"');
  });

  it('linhaCsv junta com o separador', () => {
    expect(linhaCsv(['=1', 'x', 2], ';')).toBe("'=1;x;2");
  });
});

describe('a cópia da web (apps/web/src/lib/csv.ts) é igual', () => {
  it('mesmo código, só os comentários diferem', () => {
    const codigo = (f: string) => readFileSync(f, 'utf8').split(/\r?\n/).filter((l: string) => !/^\s*(\/\*\*|\*|\/\/)/.test(l) && l.trim()).join('\n');
    expect(codigo(join(__dirname, '../../../../web/src/lib/csv.ts'))).toBe(codigo(join(__dirname, 'csv.ts')));
  });
});

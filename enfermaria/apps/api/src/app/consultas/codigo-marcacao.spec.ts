import { gerarCodigoMarcacao, normalizarCodigoMarcacao } from './codigo-marcacao';

describe('código de marcação (S-13)', () => {
  it('tem o formato CON-XXXX-XXXX, sem caracteres confundíveis', () => {
    for (let i = 0; i < 200; i++) {
      expect(gerarCodigoMarcacao()).toMatch(/^CON-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it('não repete códigos numa amostra grande', () => {
    // Com 32^8 combinações, a probabilidade de colisão em 5000 é da ordem de 1 em 100 000.
    const amostra = new Set(Array.from({ length: 5000 }, gerarCodigoMarcacao));

    expect(amostra.size).toBe(5000);
  });

  it('não usa Math.random', () => {
    const espiao = jest.spyOn(Math, 'random');

    gerarCodigoMarcacao();

    expect(espiao).not.toHaveBeenCalled();
    espiao.mockRestore();
  });

  describe('o que se escreve no quiosque', () => {
    it.each([
      ['CON-ABCD-EF23', 'CON-ABCD-EF23'],
      ['con abcd ef23', 'CON-ABCD-EF23'],
      ['CONABCDEF23', 'CON-ABCD-EF23'],
      ['ABCD-EF23', 'CON-ABCD-EF23'],
      ['CON-AB2C', 'CON-AB2C'], // formato antigo: marcações já emitidas
    ])('%s → %s', (entrada, esperado) => {
      expect(normalizarCodigoMarcacao(entrada)).toBe(esperado);
    });

    it.each([[''], ['CON-'], ['CON-ABC'], ['CON-ABCDEFGHJ'], ['A'.repeat(100)]])(
      'recusa "%s" sem ir à base de dados',
      (entrada) => {
        expect(normalizarCodigoMarcacao(entrada)).toBeNull();
      },
    );
  });
});

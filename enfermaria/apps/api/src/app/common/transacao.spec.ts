import { comRetentativas, eConflitoDeSerializacao } from './transacao';

describe('transacções Serializable (F4)', () => {
  it('reconhece o conflito pelo código do Prisma e pela mensagem do Postgres', () => {
    expect(eConflitoDeSerializacao({ code: 'P2034' })).toBe(true);
    expect(
      eConflitoDeSerializacao(new Error('could not serialize access due to read/write dependencies')),
    ).toBe(true);
    expect(eConflitoDeSerializacao({ code: 'P2025', message: 'Registo não encontrado' })).toBe(false);
  });

  it('repete e devolve o resultado da tentativa que passa', async () => {
    let chamadas = 0;

    const resultado = await comRetentativas(async () => {
      chamadas++;
      if (chamadas < 3) throw Object.assign(new Error('conflito'), { code: 'P2034' });
      return 'dispensado';
    });

    expect(resultado).toBe('dispensado');
    expect(chamadas).toBe(3);
  });

  it('desiste ao fim das tentativas e propaga o erro original', async () => {
    let chamadas = 0;
    const conflito = Object.assign(new Error('conflito'), { code: 'P2034' });

    await expect(
      comRetentativas(async () => { chamadas++; throw conflito; }, { tentativas: 3 }),
    ).rejects.toBe(conflito);
    expect(chamadas).toBe(3);
  });

  it('não repete o que não é concorrência — um pedido inválido não melhora por insistir', async () => {
    let chamadas = 0;
    const erro = Object.assign(new Error('Stock insuficiente'), { code: 'P2025' });

    await expect(comRetentativas(async () => { chamadas++; throw erro; })).rejects.toBe(erro);
    expect(chamadas).toBe(1);
  });
});

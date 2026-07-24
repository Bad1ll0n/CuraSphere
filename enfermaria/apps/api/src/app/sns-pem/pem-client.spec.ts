import { MockPemClient, SpmsPemClient, criarPemClient } from './pem-client';

describe('PemClient', () => {
  describe('MockPemClient', () => {
    const client = new MockPemClient();

    it('ambiente é sandbox', () => expect(client.ambiente).toBe('sandbox'));

    it('emite receita com número PEM (19 dígitos) + código de dispensa', async () => {
      const r = await client.emitir({ medicamentos: [{ nome: 'Paracetamol' }] } as any);
      expect(r.estado).toBe('emitida');
      expect(r.numeroReceita.replace(/\s/g, '')).toHaveLength(19);
      expect(r.codigoDispensa).toHaveLength(6);
    });

    it('rejeita receita sem medicamentos', async () => {
      await expect(client.emitir({ medicamentos: [] } as any)).rejects.toThrow(/sem medicamentos/i);
    });
  });

  describe('SpmsPemClient', () => {
    it('sem endpoint configurado → erro claro (não falha em silêncio)', async () => {
      await expect(new SpmsPemClient().emitir({ medicamentos: [{ nome: 'X' }] } as any)).rejects.toThrow(/não configurada/i);
    });
  });

  describe('criarPemClient()', () => {
    it('por omissão devolve o cliente sandbox (mock)', () => {
      const anterior = process.env['SNS_PEM_MODE'];
      delete process.env['SNS_PEM_MODE'];
      expect(criarPemClient().ambiente).toBe('sandbox');
      if (anterior !== undefined) process.env['SNS_PEM_MODE'] = anterior;
    });
  });
});

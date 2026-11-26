// QA-25: a guarda de rede dos testes unitários (test/sem-rede.ts) está activa.
describe('testes unitários sem rede', () => {
  it('fetch para fora de localhost falha logo', async () => {
    await expect(fetch('https://api.anthropic.com/v1/messages')).rejects.toThrow(/QA-25: rede bloqueada/);
  });

  it('https.request para fora de localhost falha logo', async () => {
    const https = await import('https');
    expect(() => https.request('https://exemplo.pt/x')).toThrow(/QA-25: rede bloqueada/);
  });
});

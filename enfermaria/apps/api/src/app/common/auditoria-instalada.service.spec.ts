import { AuditoriaInstaladaService, TABELAS_AUDITORIA_OBRIGATORIA } from './auditoria-instalada.service';

// QA-13: sem triggers de auditoria, a API não pode escrever em silêncio.
describe('AuditoriaInstaladaService', () => {
  const ambiente = process.env['NODE_ENV'];
  afterEach(() => { process.env['NODE_ENV'] = ambiente; });

  const servico = (funcao: number, tabelas: string[]) => {
    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ n: funcao }])
        .mockResolvedValueOnce(tabelas.map((tabela) => ({ tabela }))),
    };
    return new AuditoriaInstaladaService(prisma as never);
  };

  it('com função e triggers, arranca', async () => {
    process.env['NODE_ENV'] = 'production';
    await expect(servico(1, TABELAS_AUDITORIA_OBRIGATORIA).onModuleInit()).resolves.toBeUndefined();
  });

  it('em produção, sem triggers, RECUSA arrancar', async () => {
    process.env['NODE_ENV'] = 'production';
    await expect(servico(0, []).onModuleInit()).rejects.toThrow(/AUDITORIA DE ESCRITAS INCOMPLETA/);
  });

  it('em produção, com uma tabela clínica sem trigger, recusa e diz qual', async () => {
    process.env['NODE_ENV'] = 'production';
    const s = servico(1, TABELAS_AUDITORIA_OBRIGATORIA.filter((t) => t !== 'medicacoes'));
    await expect(s.onModuleInit()).rejects.toThrow(/medicacoes/);
  });

  it('fora de produção, só avisa', async () => {
    process.env['NODE_ENV'] = 'development';
    const s = servico(0, []);
    await expect(s.onModuleInit()).resolves.toBeUndefined();
    expect(s.estado).toEqual({ funcao: false, tabelasSemTrigger: TABELAS_AUDITORIA_OBRIGATORIA });
  });
});

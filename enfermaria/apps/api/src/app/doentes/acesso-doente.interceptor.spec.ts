import { ForbiddenException } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { AcessoDoenteInterceptor } from './acesso-doente.interceptor';

/**
 * S-01: o `assertAcessoDoente` estava aplicado à mão em 26 de 44 controladores. Estes testes
 * fixam as regras do interceptor que o passou a aplicar a todas as rotas.
 */
function contexto(req: Record<string, unknown>) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

const enfermeira = { sub: 'enf-1', role: 'enfermeiro', tipoToken: 'pessoal' };

describe('AcessoDoenteInterceptor', () => {
  let doentes: { assertAcessoDoente: jest.Mock };
  let interceptor: AcessoDoenteInterceptor;
  let handler: { handle: jest.Mock };

  beforeEach(() => {
    doentes = { assertAcessoDoente: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AcessoDoenteInterceptor(doentes as any);
    handler = { handle: jest.fn(() => of('resposta')) };
  });

  const correr = async (req: Record<string, unknown>) =>
    firstValueFrom(await interceptor.intercept(contexto(req), handler as any));

  it('não interfere em rotas sem doente', async () => {
    await expect(correr({ params: {}, query: {}, user: enfermeira })).resolves.toBe('resposta');
    expect(doentes.assertAcessoDoente).not.toHaveBeenCalled();
  });

  it('verifica o acesso quando o doente vem no caminho', async () => {
    await correr({ params: { doenteId: 'd1' }, query: {}, user: enfermeira });

    expect(doentes.assertAcessoDoente).toHaveBeenCalledWith('enf-1', 'enfermeiro', 'd1');
    expect(handler.handle).toHaveBeenCalled();
  });

  it('verifica o acesso quando o doente vem na query', async () => {
    // `GET /iacs/culturas?doenteId=` era uma leitura sem verificação nenhuma.
    await correr({ params: {}, query: { doenteId: 'd2' }, user: enfermeira });

    expect(doentes.assertAcessoDoente).toHaveBeenCalledWith('enf-1', 'enfermeiro', 'd2');
  });

  it('com a query repetida, verifica todos os doentes e não só o primeiro', async () => {
    await correr({ params: {}, query: { doenteId: ['d1', 'd2'] }, user: enfermeira });

    expect(doentes.assertAcessoDoente).toHaveBeenCalledTimes(2);
  });

  it('não chega ao handler quando o acesso é recusado', async () => {
    // O caso real: um auxiliar a ler os contactos de emergência de um doente que não é seu.
    doentes.assertAcessoDoente.mockRejectedValue(new ForbiddenException('Sem permissão'));

    await expect(
      correr({ params: { doenteId: 'd9' }, query: {}, user: enfermeira }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('um token intermédio de MFA nunca lê um doente', async () => {
    await expect(
      correr({
        params: { doenteId: 'd1' },
        query: {},
        user: { sub: 'u1', tipoToken: 'mfa_setup' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(doentes.assertAcessoDoente).not.toHaveBeenCalled();
  });

  it('o doente no portal só acede aos seus próprios dados', async () => {
    const doenteNoPortal = { sub: 'p1', doenteId: 'd1', tipo: 'portal' };

    await expect(
      correr({ params: { doenteId: 'd1' }, query: {}, user: doenteNoPortal }),
    ).resolves.toBe('resposta');

    await expect(
      correr({ params: { doenteId: 'd2' }, query: {}, user: doenteNoPortal }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sem identidade, deixa a decisão ao guard da própria rota (quiosque)', async () => {
    await expect(
      correr({ params: { doenteId: 'd1' }, query: {}, quiosque: { servicoId: 's1' } }),
    ).resolves.toBe('resposta');
    expect(doentes.assertAcessoDoente).not.toHaveBeenCalled();
  });
});

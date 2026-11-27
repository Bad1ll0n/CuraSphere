import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACESSO_DOENTE_ISENTO, ACESSO_DOENTE_POR } from './acesso-doente.decorator';
import { firstValueFrom, of } from 'rxjs';
import { AcessoDoenteInterceptor } from './acesso-doente.interceptor';

/**
 * S-01: o `assertAcessoDoente` estava aplicado à mão em 26 de 44 controladores. Estes testes
 * fixam as regras do interceptor que o passou a aplicar a todas as rotas.
 */
/** `meta`: metadados de decorators (`@AcessoDoentePor`, `@AcessoDoenteIsento`) no handler. */
function contexto(req: Record<string, unknown>, meta: Record<string, unknown> = {}) {
  const handler = () => undefined;
  for (const [chave, valor] of Object.entries(meta)) Reflect.defineMetadata(chave, valor, handler);
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => class {},
  } as any;
}

const enfermeira = { sub: 'enf-1', role: 'enfermeiro', tipoToken: 'pessoal' };

describe('AcessoDoenteInterceptor', () => {
  let doentes: { assertAcessoDoente: jest.Mock };
  let prisma: Record<string, { findUnique: jest.Mock }>;
  let interceptor: AcessoDoenteInterceptor;
  let handler: { handle: jest.Mock };
  let leituras: { registar: jest.Mock };
  let anomalia: { rastrearAcessoDoente: jest.Mock };

  beforeEach(() => {
    doentes = { assertAcessoDoente: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      medicacao: { findUnique: jest.fn() },
      fotoFerida: { findUnique: jest.fn() },
    };
    leituras = { registar: jest.fn() };
    anomalia = { rastrearAcessoDoente: jest.fn() };
    interceptor = new AcessoDoenteInterceptor(doentes as any, new Reflector(), prisma as any, leituras as any, anomalia as any);
    handler = { handle: jest.fn(() => of('resposta')) };
  });

  const correr = async (req: Record<string, unknown>, meta: Record<string, unknown> = {}) =>
    firstValueFrom(await interceptor.intercept(contexto(req, meta), handler as any));

  describe('SEC-09 — trilho de leituras', () => {
    it('regista a leitura concedida de qualquer rota com doente (não só /doentes/:id)', async () => {
      await correr({ method: 'GET', originalUrl: '/v1/sinais-vitais/d1?x=1', params: { doenteId: 'd1' }, query: {}, user: { ...enfermeira, nome: 'Ana' }, headers: {} });
      expect(leituras.registar).toHaveBeenCalledWith(expect.objectContaining({
        utilizadorId: 'enf-1', entidadeTipo: 'doentes', entidadeId: 'd1', rota: 'GET /v1/sinais-vitais/d1', resultado: 'concedido',
      }));
      expect(anomalia.rastrearAcessoDoente).toHaveBeenCalledWith('enf-1', 'd1');
    });

    it('regista a tentativa recusada como negado', async () => {
      doentes.assertAcessoDoente.mockRejectedValue(new ForbiddenException('não'));
      await expect(correr({ method: 'GET', originalUrl: '/v1/alergias/d9', params: { doenteId: 'd9' }, query: {}, user: enfermeira, headers: {} })).rejects.toThrow(ForbiddenException);
      expect(leituras.registar).toHaveBeenCalledWith(expect.objectContaining({ entidadeId: 'd9', resultado: 'negado' }));
    });

    it('regista as leituras do portal, que identificam o doente pela sessão', async () => {
      await correr({ method: 'GET', originalUrl: '/v1/portal/exportar/json', params: {}, query: {}, user: { tipo: 'portal', sub: 'p1', doenteId: 'd5' }, headers: {} });
      expect(leituras.registar).toHaveBeenCalledWith(expect.objectContaining({ entidadeId: 'd5', utilizadorRole: 'portal', resultado: 'concedido' }));
    });

    it('não regista escritas (essas estão nos triggers de auditoria)', async () => {
      await correr({ method: 'POST', originalUrl: '/v1/sinais-vitais/d1', params: { doenteId: 'd1' }, query: {}, body: {}, user: enfermeira, headers: {} });
      expect(leituras.registar).not.toHaveBeenCalled();
    });
  });

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

  describe('doente no corpo do pedido (QA-01, QA-10, SEC-01)', () => {
    it('verifica o doenteId do corpo — prescrever ou criar acesso ao portal sem acesso ao doente', async () => {
      doentes.assertAcessoDoente.mockRejectedValue(new ForbiddenException('Sem permissão'));

      await expect(
        correr({ params: {}, query: {}, body: { doenteId: 'd7', email: 'x@y.pt' }, user: enfermeira }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(doentes.assertAcessoDoente).toHaveBeenCalledWith('enf-1', 'enfermeiro', 'd7');
      expect(handler.handle).not.toHaveBeenCalled();
    });

    it('verifica todos os doentes de uma lista doenteIds', async () => {
      await correr({ params: {}, query: {}, body: { doenteIds: ['d1', 'd2'] }, user: enfermeira });

      expect(doentes.assertAcessoDoente).toHaveBeenCalledTimes(2);
    });

    it('não repete a verificação quando o mesmo doente vem no caminho e no corpo', async () => {
      await correr({ params: { doenteId: 'd1' }, query: {}, body: { doenteId: 'd1' }, user: enfermeira });

      expect(doentes.assertAcessoDoente).toHaveBeenCalledTimes(1);
    });

    it('uma rota isenta (ex.: break-glass) não verifica o corpo — mas continua a verificar o caminho', async () => {
      const isenta = { [ACESSO_DOENTE_ISENTO]: 'break-glass' };

      await correr({ params: {}, query: {}, body: { doenteId: 'd7' }, user: enfermeira }, isenta);
      expect(doentes.assertAcessoDoente).not.toHaveBeenCalled();

      await correr({ params: { doenteId: 'd8' }, query: {}, body: { doenteId: 'd7' }, user: enfermeira }, isenta);
      expect(doentes.assertAcessoDoente).toHaveBeenCalledWith('enf-1', 'enfermeiro', 'd8');
      expect(doentes.assertAcessoDoente).toHaveBeenCalledTimes(1);
    });
  });

  describe('entidade clínica identificada pelo seu id (@AcessoDoentePor)', () => {
    const porMedicacao = { [ACESSO_DOENTE_POR]: { modelo: 'medicacao', parametro: 'id', campo: 'doenteId' } };

    it('resolve a medicação até ao doente e verifica-o — administrar sem atribuição (QA-01)', async () => {
      prisma.medicacao.findUnique.mockResolvedValue({ doenteId: 'd5' });
      doentes.assertAcessoDoente.mockRejectedValue(new ForbiddenException('Sem permissão'));

      await expect(
        correr({ params: { id: 'm1' }, query: {}, body: {}, user: enfermeira }, porMedicacao),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.medicacao.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' }, select: { doenteId: true } });
      expect(doentes.assertAcessoDoente).toHaveBeenCalledWith('enf-1', 'enfermeiro', 'd5');
      expect(handler.handle).not.toHaveBeenCalled();
    });

    it('segue uma relação quando o doente está noutra entidade (foto → avaliação → doente)', async () => {
      prisma.fotoFerida.findUnique.mockResolvedValue({ avaliacao: { doenteId: 'd6' } });
      const porFoto = { [ACESSO_DOENTE_POR]: { modelo: 'fotoFerida', parametro: 'fotoId', campo: 'avaliacao.doenteId' } };

      await correr({ params: { fotoId: 'f1' }, query: {}, user: enfermeira }, porFoto);

      expect(prisma.fotoFerida.findUnique).toHaveBeenCalledWith({
        where: { id: 'f1' },
        select: { avaliacao: { select: { doenteId: true } } },
      });
      expect(doentes.assertAcessoDoente).toHaveBeenCalledWith('enf-1', 'enfermeiro', 'd6');
    });

    it('entidade inexistente → 404 antes do handler', async () => {
      prisma.medicacao.findUnique.mockResolvedValue(null);

      await expect(
        correr({ params: { id: 'nao-existe' }, query: {}, user: enfermeira }, porMedicacao),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(handler.handle).not.toHaveBeenCalled();
    });

    it('rota da mesma classe sem o parâmetro não é afetada', async () => {
      await expect(correr({ params: {}, query: {}, user: enfermeira }, porMedicacao)).resolves.toBe('resposta');
      expect(prisma.medicacao.findUnique).not.toHaveBeenCalled();
    });

    it('o doente no portal só mexe em entidades suas', async () => {
      prisma.medicacao.findUnique.mockResolvedValue({ doenteId: 'd2' });

      await expect(
        correr({ params: { id: 'm1' }, query: {}, user: { sub: 'p1', doenteId: 'd1', tipo: 'portal' } }, porMedicacao),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('modelo mal escrito no decorator falha fechado', async () => {
      const errado = { [ACESSO_DOENTE_POR]: { modelo: 'naoExiste', parametro: 'id', campo: 'doenteId' } };

      await expect(
        correr({ params: { id: 'x' }, query: {}, user: enfermeira }, errado),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it('sem identidade, deixa a decisão ao guard da própria rota (quiosque)', async () => {
    await expect(
      correr({ params: { doenteId: 'd1' }, query: {}, quiosque: { servicoId: 's1' } }),
    ).resolves.toBe('resposta');
    expect(doentes.assertAcessoDoente).not.toHaveBeenCalled();
  });
});

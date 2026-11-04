import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FicheirosController } from './ficheiros.controller';

/**
 * S-02: os anexos clínicos eram servidos por `useStaticAssets`, fora do pipeline do Nest —
 * sem guard, sem auditoria, e com o nome do ficheiro (gerado por `Math.random()`) como
 * único segredo. Estes testes fixam as três regras que passaram a valer.
 */
const resposta = () => {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
  } as any;
};

const anexoDe = (remetenteId: string, destinatarioId: string) => ({
  id: 'anexo-1',
  nome: 'analise.pdf',
  url: '/v1/ficheiros/mensagens/abc123.pdf',
  mimeType: 'application/pdf',
  tamanho: 1024,
  mensagem: { remetenteId, destinatarioId },
});

describe('FicheirosController', () => {
  let prisma: { anexoMensagem: { findFirst: jest.Mock } };
  let controller: FicheirosController;

  beforeEach(() => {
    prisma = { anexoMensagem: { findFirst: jest.fn() } };
    controller = new FicheirosController(prisma as any);
  });

  it('recusa nomes que tentem sair da pasta de uploads', async () => {
    for (const nome of ['../../etc/passwd', 'a/b.pdf', '..', '.oculto']) {
      await expect(
        controller.anexoDeMensagem(nome, { user: { sub: 'u1' } }, resposta()),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.anexoMensagem.findFirst).not.toHaveBeenCalled();
  });

  it('não serve um ficheiro que não tenha registo na base de dados', async () => {
    // Um ficheiro largado em disco, sem linha correspondente, não existe para esta rota.
    prisma.anexoMensagem.findFirst.mockResolvedValue(null);

    await expect(
      controller.anexoDeMensagem('abc123.pdf', { user: { sub: 'u1' } }, resposta()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa quem não participa na mensagem', async () => {
    // O caso que interessa: com o nome do ficheiro na mão, um terceiro continuava a não
    // conseguir descarregá-lo. Antes, bastava-lhe o URL.
    prisma.anexoMensagem.findFirst.mockResolvedValue(anexoDe('enf-1', 'enf-2'));

    await expect(
      controller.anexoDeMensagem('abc123.pdf', { user: { sub: 'enf-3' } }, resposta()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deixa passar o remetente e o destinatário até à leitura do ficheiro', async () => {
    prisma.anexoMensagem.findFirst.mockResolvedValue(anexoDe('enf-1', 'enf-2'));

    for (const sub of ['enf-1', 'enf-2']) {
      // O ficheiro não existe em disco neste ambiente, por isso a verificação de acesso
      // passa e falha depois no `stat` — que é exactamente o que se quer demonstrar:
      // a barreira de autorização ficou para trás.
      await expect(
        controller.anexoDeMensagem('abc123.pdf', { user: { sub } }, resposta()),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
  });

  it('procura o anexo pelo nome do ficheiro, não pelo caminho recebido', async () => {
    prisma.anexoMensagem.findFirst.mockResolvedValue(anexoDe('enf-1', 'enf-2'));

    await controller
      .anexoDeMensagem('abc123.pdf', { user: { sub: 'enf-1' } }, resposta())
      .catch(() => undefined);

    expect(prisma.anexoMensagem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { url: { endsWith: '/abc123.pdf' } } }),
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ComunicacaoService } from './comunicacao.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  utilizador: { findUnique: jest.fn() },
  anuncio: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  mensagemInterna: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const anuncioBase = { id: 'an-1', titulo: 'Reunião', texto: 'Amanhã às 10h', servico: 'geral', ativo: true };
const mensagemBase = { id: 'msg-1', assunto: 'Teste', texto: 'Olá', remetenteId: 'u1', destinatarioId: 'u2', lida: false };

describe('ComunicacaoService', () => {
  let service: ComunicacaoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'u2', nome: 'Dest' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComunicacaoService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ComunicacaoService>(ComunicacaoService);
  });

  describe('publicarAnuncio()', () => {
    it('cria anúncio', async () => {
      mockPrisma.anuncio.create.mockResolvedValue(anuncioBase);

      const resultado = await service.publicarAnuncio({ titulo: 'Reunião', texto: 'Amanhã' }, 'u1');

      expect(resultado.titulo).toBe('Reunião');
    });
  });

  describe('listarAnuncios()', () => {
    it('devolve anúncios activos do serviço', async () => {
      mockPrisma.anuncio.findMany.mockResolvedValue([anuncioBase]);

      const resultado = await service.listarAnuncios('geral');

      expect(resultado).toHaveLength(1);
    });
  });

  describe('enviarMensagem()', () => {
    it('envia mensagem interna', async () => {
      mockPrisma.mensagemInterna.create.mockResolvedValue(mensagemBase);

      const resultado = await service.enviarMensagem({ destinatarioId: 'u2', assunto: 'Teste', texto: 'Olá' }, 'u1');

      expect(resultado.destinatarioId).toBe('u2');
    });
  });

  describe('inbox()', () => {
    it('devolve mensagens recebidas paginadas', async () => {
      mockPrisma.mensagemInterna.count.mockResolvedValue(1);
      mockPrisma.mensagemInterna.findMany.mockResolvedValue([mensagemBase]);

      const resultado = await service.inbox('u2');

      expect(resultado.total).toBe(1);
      expect(resultado.mensagens).toHaveLength(1);
    });
  });

  describe('contarNaoLidas()', () => {
    it('devolve contagem de não lidas', async () => {
      mockPrisma.mensagemInterna.count.mockResolvedValue(3);

      const resultado = await service.contarNaoLidas('u2');

      expect(resultado.naoLidas).toBe(3);
    });
  });

  describe('marcarLida()', () => {
    it('marca mensagem como lida', async () => {
      mockPrisma.mensagemInterna.updateMany.mockResolvedValue({ count: 1 });

      await service.marcarLida('msg-1', 'u2');

      expect(mockPrisma.mensagemInterna.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lida: true }) }),
      );
    });
  });
});

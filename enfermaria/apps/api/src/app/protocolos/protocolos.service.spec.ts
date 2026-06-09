import { Test, TestingModule } from '@nestjs/testing';
import { ProtocolosService } from './protocolos.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  protocoloClinico: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  itemProtocolo: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockNotificacoes = { enviarParaRole: jest.fn().mockResolvedValue(undefined) };

const protocoloBase = {
  id: 'prot-1', doenteId: 'd1', tipo: 'sepsis', estado: 'ativo',
  itens: [{ id: 'item-1', descricao: 'Hemoculturas', concluido: false }],
};

describe('ProtocolosService', () => {
  let service: ProtocolosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana' });
    mockNotificacoes.enviarParaRole.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProtocolosService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();

    service = module.get<ProtocolosService>(ProtocolosService);
  });

  describe('ativarSeNaoAtivo()', () => {
    it('cria protocolo quando não existe activo', async () => {
      mockPrisma.protocoloClinico.findFirst.mockResolvedValue(null);
      mockPrisma.protocoloClinico.create.mockResolvedValue(protocoloBase);

      const resultado = await service.ativarSeNaoAtivo('d1', 'sepsis');

      expect(resultado.tipo).toBe('sepsis');
      expect(mockPrisma.protocoloClinico.create).toHaveBeenCalledTimes(1);
    });

    it('devolve protocolo existente sem criar novo', async () => {
      mockPrisma.protocoloClinico.findFirst.mockResolvedValue(protocoloBase);

      const resultado = await service.ativarSeNaoAtivo('d1', 'sepsis');

      expect(resultado.id).toBe('prot-1');
      expect(mockPrisma.protocoloClinico.create).not.toHaveBeenCalled();
    });
  });

  describe('listarPorDoente()', () => {
    it('devolve protocolos do doente', async () => {
      mockPrisma.protocoloClinico.findMany.mockResolvedValue([protocoloBase]);

      const resultado = await service.listarPorDoente('d1');

      expect(resultado).toHaveLength(1);
    });
  });

  describe('concluirItem()', () => {
    it('marca item como concluído', async () => {
      mockPrisma.itemProtocolo.findUnique.mockResolvedValue({ id: 'item-1', protocoloId: 'prot-1' });
      mockPrisma.itemProtocolo.update.mockResolvedValue({ id: 'item-1', concluido: true });

      await service.concluirItem('item-1', 'enf-1');

      expect(mockPrisma.itemProtocolo.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ concluido: true }) }),
      );
    });
  });
});

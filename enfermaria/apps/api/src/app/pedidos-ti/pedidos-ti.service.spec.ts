import { Test, TestingModule } from '@nestjs/testing';
import { PedidosTIService } from './pedidos-ti.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  pedidoTI: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const pedidoBase = { id: 'pti-1', titulo: 'Acesso VPN', tipo: 'acesso', estado: 'aberto' };

describe('PedidosTIService', () => {
  let service: PedidosTIService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.pedidoTI.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PedidosTIService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<PedidosTIService>(PedidosTIService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('criar()', () => {
    it('cria pedido TI', async () => {
      mockPrisma.pedidoTI.create.mockResolvedValue(pedidoBase);
      const r = await service.criar({ titulo: 'Acesso VPN', descricao: 'Solicitar', tipo: 'acesso' } as any, 'u1');
      expect(r.titulo).toBe('Acesso VPN');
    });
  });

  describe('listar()', () => {
    it('devolve pedidos TI', async () => {
      mockPrisma.pedidoTI.findMany.mockResolvedValue([pedidoBase]);
      const r = await service.listar('u1', 'it_admin');
      expect(r).toHaveLength(1);
    });
  });
});

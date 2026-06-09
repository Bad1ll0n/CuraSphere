import { Test, TestingModule } from '@nestjs/testing';
import { ConsentimentosService } from './consentimentos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  consentimentoInformado: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const consentimentoBase = {
  id: 'con-1', doenteId: 'd1', tipo: 'cirurgia', descricao: 'Consentimento para cirurgia',
  estado: 'pendente', criadoEm: new Date(),
};

describe('ConsentimentosService', () => {
  let service: ConsentimentosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentimentosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConsentimentosService>(ConsentimentosService);
  });

  describe('criar()', () => {
    it('cria consentimento informado', async () => {
      mockPrisma.consentimentoInformado.create.mockResolvedValue(consentimentoBase);

      const resultado = await service.criar({
        doenteId: 'd1', tipo: 'cirurgia', descricao: 'Consentimento para cirurgia', criadoPorId: 'med-1',
      });

      expect(resultado.tipo).toBe('cirurgia');
    });
  });

  describe('listarPorDoente()', () => {
    it('devolve consentimentos do doente', async () => {
      mockPrisma.consentimentoInformado.findMany.mockResolvedValue([consentimentoBase]);

      const resultado = await service.listarPorDoente('d1');

      expect(resultado).toHaveLength(1);
    });
  });

  describe('assinar()', () => {
    it('assina consentimento', async () => {
      mockPrisma.consentimentoInformado.findUnique.mockResolvedValue(consentimentoBase);
      mockPrisma.consentimentoInformado.update.mockResolvedValue({ ...consentimentoBase, estado: 'assinado' });

      const resultado = await service.assinar('con-1');

      expect(resultado.estado).toBe('assinado');
    });
  });

  describe('recusar()', () => {
    it('recusa consentimento com motivo', async () => {
      mockPrisma.consentimentoInformado.findUnique.mockResolvedValue(consentimentoBase);
      mockPrisma.consentimentoInformado.update.mockResolvedValue({ ...consentimentoBase, estado: 'recusado' });

      const resultado = await service.recusar('con-1', 'Doente não concorda');

      expect(resultado.estado).toBe('recusado');
    });
  });
});

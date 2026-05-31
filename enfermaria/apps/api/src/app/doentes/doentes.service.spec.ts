import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DoenteService } from './doentes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockPrisma = {
  $transaction: jest.fn(),
  doente: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  cama: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  ficheiroPessoalDoente: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  atribuicaoHorarioTurno: {
    findFirst: jest.fn(),
  },
  notaTurno: { create: jest.fn() },
  tarefa: { create: jest.fn() },
};

const mockNotificacoes = {
  criarNotificacao: jest.fn(),
  notificarRoleNaEnfermaria: jest.fn(),
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
};

describe('DoenteService', () => {
  let service: DoenteService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return Promise.all(arg);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoenteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();

    service = module.get<DoenteService>(DoenteService);
  });

  // ── admitir() ────────────────────────────────────────────────────────────────

  describe('admitir()', () => {
    const dadosBase = {
      nome: 'Maria Teste',
      dataNascimento: new Date('1990-01-01'),
      diagnosticoPrincipal: 'Pneumonia',
      camaId: 'cama-1',
      administrativoAdmissaoId: 'admin-1',
    };

    it('lança NotFoundException quando a cama não existe', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue(null);

      await expect(service.admitir(dadosBase)).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando a cama está ocupada', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'ocupada' });

      await expect(service.admitir(dadosBase)).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando a cama está em limpeza', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'em_limpeza' });

      await expect(service.admitir(dadosBase)).rejects.toThrow(BadRequestException);
    });

    it('aceita cama com estado reservada', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'reservada' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'doente-1', ...data, cama: {} }),
      );
      mockPrisma.cama.update.mockResolvedValue({});

      await expect(service.admitir(dadosBase)).resolves.toBeDefined();
    });

    it('lança ConflictException quando NIF já está registado', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue({ id: 'ficha-1', nif: '123456789' });

      await expect(service.admitir({ ...dadosBase, nif: '123456789' })).rejects.toThrow(ConflictException);
    });

    it('lança ConflictException quando número SNS já está registado', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      // Sem NIF no payload — findFirst é chamado apenas uma vez (verificação de SNS)
      mockPrisma.ficheiroPessoalDoente.findFirst
        .mockResolvedValueOnce({ id: 'ficha-1', numeroSNS: '111222333444' });

      await expect(service.admitir({ ...dadosBase, numeroSNS: '111222333444' })).rejects.toThrow(ConflictException);
    });

    it('cria doente e marca cama como ocupada em caso de sucesso', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'doente-1', ...data, cama: {} }),
      );
      mockPrisma.cama.update.mockResolvedValue({});

      const resultado = await service.admitir(dadosBase);

      expect(mockPrisma.doente.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.cama.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cama-1' }, data: { estado: 'ocupada' } }),
      );
      expect(resultado).toMatchObject({ nome: 'Maria Teste' });
    });

    it('gera numeroProcesso YYYY-00000001 para o primeiro doente do ano', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'doente-1', ...data, cama: {} }),
      );
      mockPrisma.cama.update.mockResolvedValue({});

      await service.admitir(dadosBase);

      const ano = new Date().getFullYear();
      const criado = mockPrisma.doente.create.mock.calls[0][0];
      expect(criado.data.numeroProcesso).toBe(`${ano}-00000001`);
    });

    it('incrementa numeroProcesso quando já existe registo no ano corrente', async () => {
      const ano = new Date().getFullYear();
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue({ numeroProcesso: `${ano}-00000042` });
      mockPrisma.doente.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'doente-2', ...data, cama: {} }),
      );
      mockPrisma.cama.update.mockResolvedValue({});

      await service.admitir(dadosBase);

      const criado = mockPrisma.doente.create.mock.calls[0][0];
      expect(criado.data.numeroProcesso).toBe(`${ano}-00000043`);
    });

    it('cria ficheiro pessoal quando dados opcionais são fornecidos', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'livre' });
      mockPrisma.ficheiroPessoalDoente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.findFirst.mockResolvedValue(null);
      mockPrisma.doente.create.mockResolvedValue({ id: 'doente-1', cama: {} });
      mockPrisma.cama.update.mockResolvedValue({});
      mockPrisma.ficheiroPessoalDoente.create.mockResolvedValue({});

      await service.admitir({ ...dadosBase, nif: '987654321', telefone: '912345678' });

      expect(mockPrisma.ficheiroPessoalDoente.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── darAlta() ────────────────────────────────────────────────────────────────

  describe('darAlta()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.darAlta('id-inexistente', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('marca doente como inativo e cama em limpeza', async () => {
      const doente = { id: 'doente-1', nome: 'João', camaId: 'cama-1', ativo: true };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);
      mockPrisma.doente.update.mockResolvedValue({ ...doente, ativo: false });
      mockPrisma.cama.update.mockResolvedValue({ id: 'cama-1', estado: 'em_limpeza' });

      const resultado = await service.darAlta('doente-1', 'admin-1');

      expect(resultado).toMatchObject({ mensagem: 'Alta registada com sucesso' });
      expect(mockPrisma.doente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doente-1' },
          data: expect.objectContaining({ ativo: false }),
        }),
      );
      expect(mockPrisma.cama.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: 'em_limpeza' } }),
      );
    });

    it('não actualiza cama quando doente não tem cama atribuída', async () => {
      const doente = { id: 'doente-1', nome: 'João', camaId: null, ativo: true };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);
      mockPrisma.doente.update.mockResolvedValue({ ...doente, ativo: false });

      await service.darAlta('doente-1', 'admin-1');

      expect(mockPrisma.cama.update).not.toHaveBeenCalled();
    });
  });

  // ── buscarPorId() ────────────────────────────────────────────────────────────

  describe('buscarPorId()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('devolve o doente quando encontrado', async () => {
      const doente = { id: 'doente-1', nome: 'Ana' };
      mockPrisma.doente.findUnique.mockResolvedValue(doente);

      await expect(service.buscarPorId('doente-1')).resolves.toMatchObject({ id: 'doente-1' });
    });
  });
});

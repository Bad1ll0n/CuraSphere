import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TarefasService } from './tarefas.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const mockPrisma = {
  tarefa: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
};

const mockNotificacoes = {
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
  enviarParaRole: jest.fn().mockResolvedValue(undefined),
};

const tarefaBase = { id: 'tf-1', doenteId: 'd1', tipo: 'medicacao', descricao: 'Admin fármaco', estado: 'pendente', prioridade: 'normal' };

describe('TarefasService', () => {
  let service: TarefasService;

  afterEach(() => service?.onApplicationShutdown());

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.tarefa.findMany.mockResolvedValue([]);
    mockPrisma.tarefa.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TarefasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
      ],
    }).compile();
    service = module.get<TarefasService>(TarefasService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('criar()', () => {
    it('cria tarefa', async () => {
      mockPrisma.tarefa.create.mockResolvedValue(tarefaBase);
      const r = await service.criar({ doenteId: 'd1', tipo: 'medicacao' as any, descricao: 'Admin fármaco', prioridade: 'normal' as any, criadoPorId: 'enf-1' });
      expect(r.tipo).toBe('medicacao');
    });
  });

  describe('listarPorDoente()', () => {
    it('devolve tarefas do doente', async () => {
      mockPrisma.tarefa.findMany.mockResolvedValue([tarefaBase]);
      const r = await service.listarPorDoente('d1');
      expect(r).toHaveLength(1);
    });
  });

  describe('atualizarEstado()', () => {
    it('atualiza estado da tarefa', async () => {
      mockPrisma.tarefa.findUnique.mockResolvedValue(tarefaBase);
      mockPrisma.tarefa.update.mockResolvedValue({ ...tarefaBase, estado: 'concluida' });
      const r = await service.atualizarEstado('tf-1', 'concluida' as any);
      expect(r.estado).toBe('concluida');
    });

    it('lança NotFoundException quando tarefa não existe', async () => {
      mockPrisma.tarefa.findUnique.mockResolvedValue(null);
      await expect(service.atualizarEstado('x', 'concluida' as any)).rejects.toThrow(NotFoundException);
    });
  });
});

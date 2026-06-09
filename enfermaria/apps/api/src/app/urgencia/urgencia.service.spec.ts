import { Test, TestingModule } from '@nestjs/testing';
import { UrgenciaService } from './urgencia.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EventsGateway } from '../gateway/events.gateway';

const mockEmit = jest.fn();
const mockPrisma = {
  episodioUrgencia: {
    create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn(),
  },
  utilizador: { findFirst: jest.fn() },
};
const mockNotificacoes = { enviarParaRole: jest.fn().mockResolvedValue(undefined), enviarParaUtilizador: jest.fn().mockResolvedValue(undefined) };
const mockGateway = { server: { to: jest.fn().mockReturnValue({ emit: mockEmit }), emit: jest.fn() } };

const episodioBase = { id: 'ep-1', queixaPrincipal: 'dor torácica', triagem: 'vermelho', estadoEpisodio: 'sala_espera' };

describe('UrgenciaService', () => {
  let service: UrgenciaService;

  afterEach(() => service?.onModuleDestroy());

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.episodioUrgencia.findMany.mockResolvedValue([]);
    mockPrisma.episodioUrgencia.count.mockResolvedValue(0);
    mockPrisma.utilizador.findFirst.mockResolvedValue({ id: 'sistema', nome: 'Sistema' });
    mockGateway.server.to.mockReturnValue({ emit: mockEmit });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrgenciaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();
    service = module.get<UrgenciaService>(UrgenciaService);
    service.onModuleInit();
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('registarEntrada()', () => {
    it('regista episódio de urgência', async () => {
      mockPrisma.episodioUrgencia.create.mockResolvedValue(episodioBase);
      const r = await service.registarEntrada(
        { queixaPrincipal: 'dor torácica', triagem: 'vermelho' },
        'triador-1',
      );
      expect(r.triagem).toBe('vermelho');
    });
  });

  describe('eventStream()', () => {
    it('devolve observable', () => {
      const stream = service.eventStream();
      expect(stream).toBeDefined();
      expect(typeof stream.subscribe).toBe('function');
    });
  });
});

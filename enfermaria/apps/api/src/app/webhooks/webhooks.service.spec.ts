import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

// A validação SSRF (`assertUrlDestinoPublico`) resolve o hostname via DNS —
// mockamos `dns/promises` para controlar, por teste, se o URL "resolve" para
// um IP público ou para um IP privado/interno (o cenário de SSRF).
jest.mock('dns/promises', () => ({ lookup: jest.fn() }));
const { lookup } = jest.requireMock('dns/promises') as { lookup: jest.Mock };

const mockPrisma = {
  webhook: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
};

const hookPublico = {
  id: 'wh-1',
  url: 'https://exemplo-hospital-externo.com/hook',
  secret: 'segredo',
  ativo: true,
  eventos: ['doente.admitido'],
};

const hookInterno = {
  id: 'wh-2',
  url: 'http://servico-interno.rede-hospital.local/hook',
  secret: 'segredo',
  ativo: true,
  eventos: ['doente.admitido'],
};

describe('WebhooksService', () => {
  let service: WebhooksService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhooksService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<WebhooksService>(WebhooksService);
  });

  afterEach(() => fetchSpy.mockRestore());

  it('é definido', () => expect(service).toBeDefined());

  describe('dispatcharEvento() — SSRF: revalidação do destino em cada disparo', () => {
    it('despacha normalmente para um webhook cujo URL resolve para um IP público', async () => {
      lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      mockPrisma.webhook.findMany.mockResolvedValue([hookPublico]);

      await service.dispatcharEvento('doente.admitido', { doenteId: 'd1' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(hookPublico.url, expect.objectContaining({ method: 'POST' }));
    });

    it('bloqueia o disparo quando o URL resolve para um IP privado/link-local (metadata da cloud, rede interna) e NÃO chama fetch', async () => {
      lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]); // cloud metadata
      mockPrisma.webhook.findMany.mockResolvedValue([hookInterno]);

      await service.dispatcharEvento('doente.admitido', { doenteId: 'd1' });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('bloqueia o disparo quando o URL resolve para loopback (ex.: localhost:6379/Redis) e NÃO chama fetch', async () => {
      lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      mockPrisma.webhook.findMany.mockResolvedValue([hookInterno]);

      await service.dispatcharEvento('doente.admitido', { doenteId: 'd1' });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('não deixa um hook bloqueado impedir o disparo para os restantes hooks válidos', async () => {
      lookup.mockImplementation((hostname: string) => {
        if (hostname.includes('interno')) return Promise.resolve([{ address: '10.0.0.5', family: 4 }]);
        return Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
      });
      mockPrisma.webhook.findMany.mockResolvedValue([hookPublico, hookInterno]);

      await service.dispatcharEvento('doente.admitido', { doenteId: 'd1' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(hookPublico.url, expect.any(Object));
    });
  });

  describe('criar() — validação preventiva na criação', () => {
    it('rejeita a criação de um webhook cujo URL resolve para um IP privado', async () => {
      lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

      await expect(
        service.criar({ url: 'http://servico-interno/hook', eventos: ['doente.admitido'], criadoPorId: 'u1' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.webhook.create).not.toHaveBeenCalled();
    });

    it('cria o webhook quando o URL resolve para um IP público', async () => {
      lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      mockPrisma.webhook.create.mockResolvedValue({ id: 'wh-3' });

      const r = await service.criar({
        url: 'https://exemplo-externo.com/hook',
        eventos: ['doente.admitido'],
        criadoPorId: 'u1',
      });

      expect(mockPrisma.webhook.create).toHaveBeenCalled();
      expect(r.id).toBe('wh-3');
    });
  });
});

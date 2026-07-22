import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  featureFlag: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

function flag(over: Partial<any> = {}) {
  return { key: 'k', enabled: true, rolloutPercent: 100, roles: [], servicos: [], ...over };
}

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureFlagsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(FeatureFlagsService);
  });

  describe('isEnabled()', () => {
    it('chave desconhecida → false (falha em segurança)', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);
      expect(await service.isEnabled('nao-existe', { userId: 'u1' })).toBe(false);
    });

    it('flag desligada (enabled=false) → false', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([flag({ key: 'x', enabled: false })]);
      expect(await service.isEnabled('x', { userId: 'u1' })).toBe(false);
    });

    it('enabled + rollout 100 + sem allowlist → true', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([flag({ key: 'x' })]);
      expect(await service.isEnabled('x', { userId: 'u1', role: 'medico' })).toBe(true);
    });

    it('allowlist de role: nega quem não está, permite quem está', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([flag({ key: 'x', roles: ['medico'] })]);
      expect(await service.isEnabled('x', { userId: 'u1', role: 'enfermeiro' })).toBe(false);
      expect(await service.isEnabled('x', { userId: 'u1', role: 'medico' })).toBe(true);
    });

    it('allowlist de serviço: filtra por serviço', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([flag({ key: 'x', servicos: ['uci'] })]);
      expect(await service.isEnabled('x', { userId: 'u1', servico: 'enfermaria' })).toBe(false);
      expect(await service.isEnabled('x', { userId: 'u1', servico: 'uci' })).toBe(true);
    });

    it('rollout 0 → false; rollout determinístico é estável para o mesmo utilizador', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([flag({ key: 'x', rolloutPercent: 0 })]);
      expect(await service.isEnabled('x', { userId: 'u1' })).toBe(false);

      service.invalidar();
      mockPrisma.featureFlag.findMany.mockResolvedValue([flag({ key: 'x', rolloutPercent: 50 })]);
      const a = await service.isEnabled('x', { userId: 'user-fixo' });
      const b = await service.isEnabled('x', { userId: 'user-fixo' });
      expect(a).toBe(b); // determinístico
    });
  });

  describe('paraContexto()', () => {
    it('devolve mapa {key: boolean} de todas as flags', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag({ key: 'on', enabled: true }),
        flag({ key: 'off', enabled: false }),
      ]);
      const mapa = await service.paraContexto({ userId: 'u1', role: 'medico' });
      expect(mapa).toEqual({ on: true, off: false });
    });
  });

  describe('cache', () => {
    it('não relê a BD dentro do TTL, e relê após invalidar', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([flag({ key: 'x' })]);
      await service.isEnabled('x', { userId: 'u1' });
      await service.isEnabled('x', { userId: 'u1' });
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledTimes(1);
      service.invalidar();
      await service.isEnabled('x', { userId: 'u1' });
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('administração', () => {
    it('upsert cria/atualiza e invalida a cache', async () => {
      mockPrisma.featureFlag.upsert.mockResolvedValue(flag({ key: 'novo' }));
      const r = await service.upsert('novo', { enabled: true, rolloutPercent: 100 }, 'admin-1');
      expect(mockPrisma.featureFlag.upsert).toHaveBeenCalled();
      expect(r.key).toBe('novo');
    });

    it('remover elimina a flag', async () => {
      mockPrisma.featureFlag.delete.mockResolvedValue(flag());
      const r = await service.remover('x');
      expect(mockPrisma.featureFlag.delete).toHaveBeenCalledWith({ where: { key: 'x' } });
      expect(r).toEqual({ removido: 'x' });
    });
  });
});

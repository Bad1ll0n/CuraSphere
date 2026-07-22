import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { MedicacaoService } from './medicacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { RedisService } from '../redis/redis.service';
import { StewardshipService } from '../stewardship/stewardship.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { WebhooksService } from '../webhooks/webhooks.service';

const mockPrisma = {
  $transaction: jest.fn(),
  doente: { findUnique: jest.fn() },
  alergia: { findMany: jest.fn() },
  medicacao: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  registoMedicacao: { create: jest.fn(), findMany: jest.fn() },
  atribuicaoHorarioTurno: { findMany: jest.fn() },
};

const mockNotificacoes = {
  enviarParaUtilizador: jest.fn().mockResolvedValue(undefined),
  enviarParaUtilizadores: jest.fn().mockResolvedValue(undefined),
  notificarRole: jest.fn().mockResolvedValue(undefined),
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
};

const mockStewardship = {
  registarSeAntibiotico: jest.fn().mockResolvedValue(undefined),
};

describe('MedicacaoService', () => {
  let service: MedicacaoService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockStewardship.registarSeAntibiotico.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaUtilizador.mockResolvedValue(undefined);
    mockNotificacoes.enviarParaUtilizadores.mockResolvedValue(undefined);
    mockNotificacoes.notificarRole.mockResolvedValue(undefined);
    // Defaults para métodos que retornam arrays (usados com .map antes da transação)
    mockPrisma.medicacao.findMany.mockResolvedValue([]);
    mockPrisma.alergia.findMany.mockResolvedValue([]);
    mockPrisma.registoMedicacao.findMany.mockResolvedValue([]);
    mockPrisma.atribuicaoHorarioTurno.findMany.mockResolvedValue([]);
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation((arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return Promise.all(arg);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicacaoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificacoesService, useValue: mockNotificacoes },
        { provide: RedisService, useValue: mockRedis },
        { provide: StewardshipService, useValue: mockStewardship },
        { provide: TenantContextService, useValue: { tenantId: 'default', run: (_id: string, fn: () => unknown) => fn() } },
        { provide: WebhooksService, useValue: { dispatcharEvento: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<MedicacaoService>(MedicacaoService);
  });

  // ── prescrever() ─────────────────────────────────────────────────────────────

  describe('prescrever()', () => {
    const dadosBase = {
      doenteId: 'doente-1',
      nome: 'Paracetamol 1g',
      dose: '1g',
      via: 'oral',
      frequencia: '8/8h',
      prescritoPorId: 'medico-1',
    };

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.prescrever(dadosBase)).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException quando medicamento coincide com alergia registada', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([
        { alergenio: 'paracetamol', severidade: 'moderada', doenteId: 'doente-1' },
      ]);

      await expect(service.prescrever(dadosBase)).rejects.toThrow(ConflictException);
    });

    it('ignora verificação de alergia quando forcarApesarDeAlergia=true', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.medicacao.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.create.mockResolvedValue({
        id: 'med-1', nome: 'Paracetamol 1g', prescritoPor: { id: 'medico-1', nome: 'Dr. Silva' },
      });

      const resultado = await service.prescrever({ ...dadosBase, forcarApesarDeAlergia: true });

      expect(resultado.id).toBe('med-1');
      expect(mockPrisma.alergia.findMany).not.toHaveBeenCalled();
    });

    it('cria medicação e devolve avisoInteracoes vazio quando sem interações', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.create.mockResolvedValue({
        id: 'med-1', nome: 'Paracetamol 1g', prescritoPor: {},
      });

      const resultado = await service.prescrever(dadosBase);

      expect(resultado.id).toBe('med-1');
      expect(resultado.avisoInteracoes).toHaveLength(0);
    });

    it('detecta interação grave warfarina + aspirina', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      // Doente já tem Warfarina activa
      mockPrisma.medicacao.findMany.mockResolvedValue([{ nome: 'Warfarina 5mg' }]);
      mockPrisma.medicacao.create.mockResolvedValue({
        id: 'med-2', nome: 'Aspirina 100mg', prescritoPor: {},
      });

      const resultado = await service.prescrever({ ...dadosBase, nome: 'Aspirina 100mg' });

      expect(resultado.avisoInteracoes.length).toBeGreaterThan(0);
      expect(resultado.avisoInteracoes[0]).toMatchObject({ severidade: 'grave' });
    });

    it('não inclui forcarApesarDeAlergia nem justificativaOverride nos dados criados', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1', nome: 'João' });
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.findMany.mockResolvedValue([]);
      mockPrisma.medicacao.create.mockResolvedValue({ id: 'med-1', prescritoPor: {} });

      await service.prescrever({
        ...dadosBase,
        forcarApesarDeAlergia: true,
        justificativaOverride: 'Benefício supera risco',
      });

      const chamada = mockPrisma.medicacao.create.mock.calls[0][0];
      expect(chamada.data).not.toHaveProperty('forcarApesarDeAlergia');
      expect(chamada.data).not.toHaveProperty('justificativaOverride');
    });
  });

  // ── registarAdministracao() ──────────────────────────────────────────────────

  describe('registarAdministracao()', () => {
    it('lança NotFoundException quando medicação não existe', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(null);

      await expect(
        service.registarAdministracao({ medicacaoId: 'med-x', administradoPorId: 'enf-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando medicação está descontinuada', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue({ id: 'med-1', ativo: false, doenteId: 'doente-1' });

      await expect(
        service.registarAdministracao({ medicacaoId: 'med-1', administradoPorId: 'enf-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria registo de administração para medicação ativa', async () => {
      const med = { id: 'med-1', ativo: true, doenteId: 'doente-1', frequencia: 'SOS', registos: [] };
      mockPrisma.medicacao.findUnique.mockResolvedValue(med);
      const registo = { id: 'reg-1', administradoPor: { id: 'enf-1', nome: 'Enf. Ana' }, medicacao: {} };
      mockPrisma.registoMedicacao.create.mockResolvedValue(registo);

      const resultado = await service.registarAdministracao({
        medicacaoId: 'med-1',
        administradoPorId: 'enf-1',
        verificacao5Certas: true,
      });

      expect(resultado.id).toBe('reg-1');
      expect(mockPrisma.registoMedicacao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verificacao5Certas: true }),
        }),
      );
    });
  });

  // ── descontinuar() ───────────────────────────────────────────────────────────

  describe('descontinuar()', () => {
    it('lança NotFoundException quando medicação não existe', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(null);

      await expect(service.descontinuar('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('marca medicação como inativa com terminadoEm preenchido', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue({ id: 'med-1', nome: 'Metformina', ativo: true });
      mockPrisma.medicacao.update.mockResolvedValue({ id: 'med-1', ativo: false, terminadoEm: new Date() });

      const resultado = await service.descontinuar('med-1');

      expect(resultado.ativo).toBe(false);
      expect(mockPrisma.medicacao.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'med-1' },
          data: expect.objectContaining({ ativo: false }),
        }),
      );
    });
  });

  // ── verificarInteracoes() ────────────────────────────────────────────────────

  describe('verificarInteracoes()', () => {
    it('devolve array vazio quando não há medicações ativas', async () => {
      mockPrisma.medicacao.findMany.mockResolvedValue([]);

      const resultado = await service.verificarInteracoes('doente-1', 'Aspirina 100mg');

      expect(resultado).toHaveLength(0);
    });

    it('detecta interação tramadol + sertralina (síndrome serotonérgica)', async () => {
      mockPrisma.medicacao.findMany.mockResolvedValue([{ nome: 'Sertralina 50mg' }]);

      const resultado = await service.verificarInteracoes('doente-1', 'Tramadol 50mg');

      expect(resultado.length).toBeGreaterThan(0);
      expect(resultado[0]).toMatchObject({ severidade: 'grave' });
    });
  });

  // ── verificar5Certos() ────────────────────────────────────────────────────────

  describe('verificar5Certos()', () => {
    const medAtiva = {
      id: 'med-1', nome: 'Paracetamol 1g', dose: '1g', via: 'oral',
      frequencia: '8/8h', ativo: true,
      registos: [],
    };

    const buildPayload = (overrides: object = {}) =>
      JSON.stringify({ medicacaoId: 'med-1', doenteId: 'doente-1', nome: 'Paracetamol', dose: '1g', via: 'oral', ...overrides });

    it('devolve valido=true quando todos os certos passam', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r = await service.verificar5Certos(buildPayload(), 'doente-1');

      expect(r.valido).toBe(true);
      expect(r.falhas).toHaveLength(0);
      expect(r.medicacao.nome).toBe('Paracetamol 1g');
    });

    it('falha no Certo 1 quando doenteId do QR não corresponde ao esperado', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(medAtiva);

      const r = await service.verificar5Certos(buildPayload(), 'doente-OUTRO');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.certo === 'Doente')).toBe(true);
    });

    it('falha no Certo 2 quando medicação está inactiva', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue({ ...medAtiva, ativo: false });

      const r = await service.verificar5Certos(buildPayload(), 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.certo === 'Medicamento')).toBe(true);
    });

    it('falha no Certo 5 quando administração é prematura', async () => {
      const ultimaAdm = new Date(Date.now() - 2 * 3_600_000); // há 2h (muito cedo para 8/8h com 1h tolerância)
      mockPrisma.medicacao.findUnique.mockResolvedValue({
        ...medAtiva,
        registos: [{ administradoEm: ultimaAdm }],
      });

      const r = await service.verificar5Certos(buildPayload(), 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.certo === 'Hora')).toBe(true);
    });

    it('devolve valido=false e medicacao=null quando QR é JSON inválido', async () => {
      const r = await service.verificar5Certos('não é json', 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.medicacao).toBeNull();
    });

    it('devolve valido=false quando medicação não existe na BD', async () => {
      mockPrisma.medicacao.findUnique.mockResolvedValue(null);

      const r = await service.verificar5Certos(buildPayload(), 'doente-1');

      expect(r.valido).toBe(false);
      expect(r.falhas.some(f => f.certo === 'Medicamento')).toBe(true);
    });
  });
});

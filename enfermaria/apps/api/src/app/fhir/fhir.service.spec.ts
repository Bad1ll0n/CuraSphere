import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { FhirService } from './fhir.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const mockPrisma = {
  dispositivoFhir: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  doente: { findUnique: jest.fn() },
  sinalVital: { create: jest.fn() },
  utilizador: { findFirst: jest.fn() },
};

const dispositivoBase = { id: 'dev-1', apiKey: 'key-abc', ativo: true, doenteId: 'd1', nome: 'Monitor' };

describe('FhirService', () => {
  let service: FhirService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.dispositivoFhir.findUnique.mockResolvedValue(dispositivoBase);
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
    mockPrisma.utilizador.findFirst.mockResolvedValue({ id: 'sistema' });
    mockPrisma.dispositivoFhir.update.mockResolvedValue(dispositivoBase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FhirService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();
    service = module.get<FhirService>(FhirService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('receberObservation()', () => {
    it('lança ForbiddenException quando dispositivo não autorizado', async () => {
      mockPrisma.dispositivoFhir.findUnique.mockResolvedValue(null);
      await expect(service.receberObservation({}, 'bad-key')).rejects.toThrow(ForbiddenException);
    });

    it('lança BadRequestException quando resourceType inválido', async () => {
      await expect(service.receberObservation({ resourceType: 'Patient' }, 'key-abc')).rejects.toThrow(BadRequestException);
    });

    it('processa Observation válida', async () => {
      mockPrisma.sinalVital.create.mockResolvedValue({ id: 'sv-1' });
      const obs = {
        resourceType: 'Observation',
        code: { coding: [{ code: '8867-4' }] },
        valueQuantity: { value: 72 },
      };
      await expect(service.receberObservation(obs, 'key-abc')).resolves.not.toThrow();
    });
  });
});

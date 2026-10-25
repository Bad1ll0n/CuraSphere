import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { FhirService } from './fhir.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SinaisVitaisService } from '../sinais-vitais/sinais-vitais.service';

const mockPrisma = {
  dispositivoFhir: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  doente: { findUnique: jest.fn() },
  sinalVital: { create: jest.fn() },
  utilizador: { findFirst: jest.fn() },
};

// A chave deixou de existir em claro na base: guarda-se o hash. O dispositivo continua
// associado a um doente, e é ESSE que manda — o payload não escolhe (S-04).
const dispositivoBase = { id: 'dev-1', ativo: true, doenteId: 'd1', nome: 'Monitor' };

// A ingestão passa agora pelo serviço clínico, que é quem calcula NEWS2 e dispara alertas.
const mockSinaisVitais = { ingerirDeMonitor: jest.fn().mockResolvedValue({ id: 'sv-1' }) };

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
        { provide: SinaisVitaisService, useValue: mockSinaisVitais },
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
  describe('segurança da ingestão por dispositivo', () => {
    const observacao = {
      resourceType: 'Observation',
      code: { coding: [{ code: '8867-4' }] }, // frequência cardíaca
      valueQuantity: { value: 88 },
    };

    it('procura o dispositivo pelo HASH da chave, nunca pela chave em claro', async () => {
      await service.receberObservation(observacao, 'chave-secreta').catch(() => undefined);

      const [{ where }] = mockPrisma.dispositivoFhir.findUnique.mock.calls[0];
      expect(where.apiKey).toBeUndefined();
      expect(where.apiKeyHash).toEqual(expect.any(String));
      expect(where.apiKeyHash).not.toBe('chave-secreta');
    });

    it('recusa um dispositivo sem doente associado', async () => {
      // Antes, um dispositivo sem doente aceitava o doente indicado no payload — ou seja,
      // escrevia sinais vitais em qualquer pessoa.
      mockPrisma.dispositivoFhir.findUnique.mockResolvedValue({ ...dispositivoBase, doenteId: null });

      await expect(service.receberObservation(observacao, 'k')).rejects.toThrow(
        /sem doente associado/i,
      );
    });

    it('recusa quando o payload nomeia um doente diferente do dispositivo', async () => {
      await expect(
        service.receberObservation(
          { ...observacao, subject: { reference: 'Patient/OUTRO-DOENTE' } },
          'k',
        ),
      ).rejects.toThrow(/doente diferente/i);

      expect(mockSinaisVitais.ingerirDeMonitor).not.toHaveBeenCalled();
    });

    it('grava pelo serviço clínico, para o NEWS2 e os alertas correrem', async () => {
      // O defeito era escrever directamente na tabela, saltando o cálculo do NEWS2, os
      // alertas de valor crítico isolado e a avaliação de sépsis: a monitorização
      // contínua era a única fonte que escapava à detecção de deterioração.
      await service.receberObservation(observacao, 'k');

      expect(mockSinaisVitais.ingerirDeMonitor).toHaveBeenCalledWith(
        'd1',
        'sistema',
        expect.objectContaining({ pulso: 88 }),
      );
      expect(mockPrisma.sinalVital.create).not.toHaveBeenCalled();
    });

    it('procura o utilizador de sistema por um papel que existe mesmo', async () => {
      // `it_admin` é um SUB-papel e `admin` não existe: a procura antiga devolvia sempre
      // nada e a ingestão rebentava antes de chegar ao registo.
      await service.receberObservation(observacao, 'k');

      const papeis = mockPrisma.utilizador.findFirst.mock.calls.map((c) => c[0].where.role);
      expect(papeis).not.toContain('it_admin');
      expect(papeis).not.toContain('admin');
      expect(papeis[0]).toBe('ti');
    });
  });
});

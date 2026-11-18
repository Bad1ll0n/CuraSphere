import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { FhirService } from './fhir.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SinaisVitaisService } from '../sinais-vitais/sinais-vitais.service';
import { AlertasService } from '../alertas/alertas.service';
import { LeiturasMonitorService } from '../monitorizacao/leituras-monitor.service';

const mockPrisma = {
  dispositivoFhir: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  doente: { findUnique: jest.fn(), findFirst: jest.fn() },
  sinalVital: { create: jest.fn() },
  leituraMonitor: { create: jest.fn() },
};

// A chave deixou de existir em claro na base: guarda-se o hash. O dispositivo continua
// associado a um doente, e é ESSE que manda — o payload não escolhe (S-04).
const dispositivoBase = { id: 'dev-1', ativo: true, doenteId: 'd1', nome: 'Monitor' };

// PROD-15: a ingestão passa pelas leituras pendentes (o mesmo serviço de /monitorizacao/ingerir);
// só depois de validada por um enfermeiro chega ao serviço clínico.
const mockSinaisVitais = { ingerirDeMonitor: jest.fn().mockResolvedValue({ id: 'sv-1' }) };
const mockAlertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };

describe('FhirService', () => {
  let service: FhirService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.dispositivoFhir.findUnique.mockResolvedValue(dispositivoBase);
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
    mockPrisma.leituraMonitor.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'lm-1', ...data }));
    mockPrisma.dispositivoFhir.update.mockResolvedValue(dispositivoBase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FhirService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: SinaisVitaisService, useValue: mockSinaisVitais },
        { provide: AlertasService, useValue: mockAlertas },
        LeiturasMonitorService,
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
        /sem cama nem doente associado/i,
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

    it('PROD-15: a leitura fica pendente de validação — não entra direto nos sinais vitais', async () => {
      const r = await service.receberObservation({ ...observacao, effectiveDateTime: new Date().toISOString() }, 'k');

      expect(r).toEqual(expect.objectContaining({ status: 'pendente_validacao', leituraId: 'lm-1' }));
      const { data } = mockPrisma.leituraMonitor.create.mock.calls[0][0];
      expect(data).toEqual(expect.objectContaining({ doenteId: 'd1', dispositivoId: 'dev-1', canal: 'fhir', valores: { pulso: 88 } }));
      expect(mockSinaisVitais.ingerirDeMonitor).not.toHaveBeenCalled();
      expect(mockPrisma.sinalVital.create).not.toHaveBeenCalled();
    });

    it('PROD-15: com cama associada, o doente é quem a ocupa', async () => {
      mockPrisma.dispositivoFhir.findUnique.mockResolvedValue({ ...dispositivoBase, doenteId: null, camaId: 'c1' });
      mockPrisma.doente.findFirst.mockResolvedValue({ id: 'ocupante' });
      await service.receberObservation(observacao, 'k');
      expect(mockPrisma.leituraMonitor.create.mock.calls[0][0].data.doenteId).toBe('ocupante');
    });

    it('PROD-15: valor crítico alerta logo, a pedir confirmação à cabeceira', async () => {
      await service.receberObservation({ ...observacao, code: { coding: [{ code: '59408-5' }] }, valueQuantity: { value: 82 } }, 'k');
      expect(mockAlertas.criarAlerta).toHaveBeenCalledWith('d1', 'leitura_monitor_critica', expect.stringMatching(/por validar.*SpO/), 3);
    });
  });
});

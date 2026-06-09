import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Hl7Service } from './hl7.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  sinalVital: { create: jest.fn() },
  internamento: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  hl7Mensagem: { create: jest.fn().mockResolvedValue({ id: 'h-1' }), findMany: jest.fn().mockResolvedValue([]) },
  resultadoAnalise: { create: jest.fn().mockResolvedValue({ id: 'ra-1' }) },
};

// service uses field(msh, 9) → index 9; triple pipes push msg type to index 9
const MSH_ORU = 'MSH|^~\\&|LAB|HOSP|RIS|HOSP|202601010000|||ORU^R01|001|P|2.5\rPID|1||d1^^^||Joao^Silva||19800101|M\rOBX|1|NM|8867-4^Heart rate||72|/min|60-100||||F';
const MSH_ADT_A01 = 'MSH|^~\\&|ADT|HOSP|APP|HOSP|202601010000|||ADT^A01|002|P|2.5\rPID|1||d1^^^||Joao^Silva||19800101|M';
const MSH_INVALIDO = 'PID|1||d1';

describe('Hl7Service', () => {
  let service: Hl7Service;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findFirst.mockResolvedValue({ id: 'd1', nome: 'Joao', numeroProcesso: 'd1', ativo: true });
    mockPrisma.sinalVital.create.mockResolvedValue({ id: 'sv-1' });
    mockPrisma.internamento.findFirst.mockResolvedValue(null);
    mockPrisma.internamento.create.mockResolvedValue({ id: 'int-1' });
    mockPrisma.hl7Mensagem.create.mockResolvedValue({ id: 'h-1' });
    mockPrisma.resultadoAnalise.create.mockResolvedValue({ id: 'ra-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [Hl7Service, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<Hl7Service>(Hl7Service);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('receberMensagem()', () => {
    it('lança BadRequestException quando MSH ausente', async () => {
      await expect(service.receberMensagem(MSH_INVALIDO)).rejects.toThrow(BadRequestException);
    });

    it('processa ORU^R01 com sinais vitais', async () => {
      const r = await service.receberMensagem(MSH_ORU);
      expect(r.processado).toBe(true);
      expect(r.tipo).toBe('ORU^R01');
    });

    it('processa ADT^A01 (admissão)', async () => {
      const r = await service.receberMensagem(MSH_ADT_A01);
      expect(r.processado).toBe(true);
    });
  });
});

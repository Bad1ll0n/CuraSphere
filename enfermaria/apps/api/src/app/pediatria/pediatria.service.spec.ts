import { BadRequestException } from '@nestjs/common';
import { PediatriaService } from './pediatria.service';

// QA-21 — módulo sem spec: dose pediátrica por peso (apoio à decisão).
describe('PediatriaService', () => {
  let prisma: any, svc: PediatriaService;
  beforeEach(() => {
    prisma = { sinalVital: { findFirst: jest.fn(), findMany: jest.fn() }, doente: { findUnique: jest.fn().mockResolvedValue(null) } };
    svc = new PediatriaService(prisma);
  });

  it('com peso fornecido: mg/kg × kg, com dose diária', async () => {
    const r = await svc.calcularDose({ mgPorKg: 15, pesoKg: 20, frequenciaDia: 3 } as any);
    expect(r).toMatchObject({ doseMg: 300, doseDiariaMg: 900, pesoKg: 20, fontePeso: 'fornecido' });
    expect(prisma.sinalVital.findFirst).not.toHaveBeenCalled();
  });

  it('sem peso: usa o último peso registado do doente e diz de quando é', async () => {
    prisma.sinalVital.findFirst.mockResolvedValue({ peso: 12, data: new Date('2026-11-01T10:00:00Z') });
    const r = await svc.calcularDose({ mgPorKg: 10, doenteId: 'd1' } as any);
    expect(r).toMatchObject({ doseMg: 120, pesoKg: 12, fontePeso: 'último registo (2026-11-01)' });
  });

  it('sem peso: usa o peso de referência do doente antes do último registo (PROD-22)', async () => {
    prisma.doente.findUnique.mockResolvedValue({ pesoReferenciaKg: 14, pesoReferenciaEm: new Date('2026-11-02T00:00:00Z'), pesoReferenciaFonte: 'medido' });
    const r = await svc.calcularDose({ mgPorKg: 10, doenteId: 'd1' } as any);
    expect(r).toMatchObject({ doseMg: 140, pesoKg: 14, fontePeso: 'peso de referência (medido, 2026-11-02)' });
  });

  it('sem peso e sem registo: recusa (nunca inventa um peso)', async () => {
    prisma.sinalVital.findFirst.mockResolvedValue(null);
    await expect(svc.calcularDose({ mgPorKg: 10, doenteId: 'd1' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.calcularDose({ mgPorKg: 10 } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('respeita a dose máxima', async () => {
    const r: any = await svc.calcularDose({ mgPorKg: 50, pesoKg: 40, doseMaximaMg: 1000 } as any);
    expect(r.doseMg).toBeLessThanOrEqual(1000);
  });
});

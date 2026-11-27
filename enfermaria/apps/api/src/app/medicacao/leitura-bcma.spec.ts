import { Test } from '@nestjs/testing';
import { conteudoPulseira, lerGs1, lerPulseira, variantesGtin } from './leitura-bcma';
import { MedicacaoService } from './medicacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { StewardshipService } from '../stewardship/stewardship.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AlertasService } from '../alertas/alertas.service';
import { CatalogoService } from '../catalogo/catalogo.service';

describe('UX-08 — leitura de códigos (BCMA)', () => {
  it('pulseira: formato CuraSphere e n.º de processo simples', () => {
    expect(conteudoPulseira('2026-00000001', new Date('1950-03-04T00:00:00Z'))).toBe('CSP1|2026-00000001|19500304');
    expect(lerPulseira('CSP1|2026-00000001|19500304')).toEqual({ processo: '2026-00000001', nascimento: '1950-03-04' });
    expect(lerPulseira('2026-00000001')).toEqual({ processo: '2026-00000001', nascimento: null });
    expect(lerPulseira('não é uma pulseira!')).toBeNull();
  });

  it('GS1 legível e em bruto (FNC1), com validade dia 00 = fim do mês', () => {
    expect(lerGs1('(01)05601234567890(17)271231(10)LOTE42')).toMatchObject({ gtin: '05601234567890', lote: 'LOTE42' });
    const bruto = lerGs1(']d2010560123456789017270600' + '10ABC12\u001d21SERIE9');
    expect(bruto).toMatchObject({ gtin: '05601234567890', lote: 'ABC12', serie: 'SERIE9' });
    expect(bruto!.validade!.toISOString().slice(0, 10)).toBe('2027-06-30');
    expect(lerGs1('XYZ')).toBeNull();
    expect(variantesGtin('05601234567890')).toEqual(['05601234567890', '5601234567890']);
  });

  describe('verificarLeitura (serviço)', () => {
    let svc: MedicacaoService;
    const prisma: any = {
      medicacao: { findUnique: jest.fn() },
      doente: { findUnique: jest.fn(), findFirst: jest.fn() },
      catalogoMedicamento: { findFirst: jest.fn() },
    };
    beforeEach(async () => {
      jest.clearAllMocks();
      process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'segredo-teste';
      prisma.medicacao.findUnique.mockResolvedValue({ id: 'm1', doenteId: 'd1', nome: 'Paracetamol 1 g', dci: 'Paracetamol', dose: '1 g', via: 'oral', catalogoId: null });
      prisma.doente.findUnique.mockResolvedValue({ numeroProcesso: 'P-1', dataNascimento: new Date('1950-03-04T00:00:00Z') });
      const m = await Test.createTestingModule({
        providers: [
          MedicacaoService,
          { provide: PrismaService, useValue: prisma },
          { provide: NotificacoesService, useValue: {} },
          { provide: StewardshipService, useValue: {} },
          { provide: TenantContextService, useValue: { tenantId: 'default' } },
          { provide: WebhooksService, useValue: {} },
          { provide: AlertasService, useValue: {} },
          { provide: CatalogoService, useValue: { dcis: jest.fn().mockResolvedValue(['Paracetamol', 'Ibuprofeno']) } },
        ],
      }).compile();
      svc = m.get(MedicacaoService);
    });

    it('pulseira do doente certo / de outro doente / nascimento que não confere', async () => {
      expect((await svc.verificarLeitura('m1', 'd1', { pulseira: 'CSP1|P-1|19500304' })).pulseira).toMatchObject({ ok: true });
      prisma.doente.findFirst.mockResolvedValueOnce({ id: 'd2' });
      expect((await svc.verificarLeitura('m1', 'd1', { pulseira: 'CSP1|P-2|19600101' })).pulseira).toMatchObject({ ok: false, motivo: expect.stringMatching(/OUTRO DOENTE/) });
      expect((await svc.verificarLeitura('m1', 'd1', { pulseira: 'CSP1|P-1|19500305' })).pulseira).toMatchObject({ ok: false, motivo: expect.stringMatching(/nascimento/) });
    });

    it('embalagem GS1: mesma substância confere; outra substância ou fora de validade recusa', async () => {
      prisma.catalogoMedicamento.findFirst.mockResolvedValueOnce({ id: 'c1', dci: 'Paracetamol', concentracao: '1000 mg' });
      expect((await svc.verificarLeitura('m1', 'd1', { medicamento: '(01)05601234567890(17)301231(10)L1' })).medicamento)
        .toMatchObject({ ok: true, lote: 'L1' });
      prisma.catalogoMedicamento.findFirst.mockResolvedValueOnce({ id: 'c2', dci: 'Ibuprofeno', concentracao: '400 mg' });
      expect((await svc.verificarLeitura('m1', 'd1', { medicamento: '(01)05601234567891' })).medicamento)
        .toMatchObject({ ok: false, motivo: expect.stringMatching(/MEDICAMENTO ERRADO/) });
      prisma.catalogoMedicamento.findFirst.mockResolvedValueOnce({ id: 'c1', dci: 'Paracetamol' });
      expect((await svc.verificarLeitura('m1', 'd1', { medicamento: '(01)05601234567890(17)200101' })).medicamento)
        .toMatchObject({ ok: false, motivo: expect.stringMatching(/FORA DE VALIDADE/) });
    });

    it('etiqueta de unidose assinada: a desta prescrição confere; de outra, não', async () => {
      prisma.medicacao.findUnique.mockResolvedValueOnce({ id: 'm1', doenteId: 'd1', nome: 'Paracetamol 1 g', dose: '1 g', via: 'oral' });
      const { qrPayload } = await svc.gerarPayloadQR('m1');
      expect((await svc.verificarLeitura('m1', 'd1', { medicamento: qrPayload })).medicamento).toMatchObject({ ok: true, origem: 'etiqueta' });
      prisma.medicacao.findUnique.mockResolvedValueOnce({ id: 'm9', doenteId: 'd1', nome: 'X', dose: '1 g', via: 'oral' });
      const outra = (await svc.gerarPayloadQR('m9')).qrPayload;
      expect((await svc.verificarLeitura('m1', 'd1', { medicamento: outra })).medicamento).toMatchObject({ ok: false, motivo: expect.stringMatching(/OUTRA prescrição/) });
    });
  });
});

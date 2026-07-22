import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransfusaoService } from './transfusao.service';

/**
 * Segurança transfusional ABO/Rh — testa a função pura de compatibilidade (a barreira que
 * impede administrar sangue incompatível). Determinístico, sem BD.
 */
describe('TransfusaoService.verificarCompatibilidade', () => {
  // A função não usa dependências — instanciamos com nulls.
  const svc = new TransfusaoService(null as any, null as any);
  const compat = (comp: string, dABO: string | null, dRh: string | null, bABO: string, bRh: string) =>
    svc.verificarCompatibilidade(comp, dABO, dRh, bABO, bRh).compativel;

  describe('eritrócitos (concentrado_eritrocitos)', () => {
    const C = 'concentrado_eritrocitos';

    it('O- é dador universal — compatível com qualquer recetor', () => {
      for (const abo of ['A', 'B', 'AB', 'O']) {
        for (const rh of ['positivo', 'negativo']) {
          expect(compat(C, abo, rh, 'O', 'negativo')).toBe(true);
        }
      }
    });

    it('AB+ recebe de qualquer grupo ABO (recetor universal de eritrócitos)', () => {
      for (const abo of ['A', 'B', 'AB', 'O']) {
        expect(compat(C, 'AB', 'positivo', abo, 'positivo')).toBe(true);
      }
    });

    it('doente O NÃO pode receber A/B/AB (incompatibilidade ABO)', () => {
      expect(compat(C, 'O', 'positivo', 'A', 'positivo')).toBe(false);
      expect(compat(C, 'O', 'positivo', 'B', 'positivo')).toBe(false);
      expect(compat(C, 'O', 'positivo', 'AB', 'positivo')).toBe(false);
    });

    it('doente Rh- NÃO pode receber Rh+', () => {
      expect(compat(C, 'O', 'negativo', 'O', 'positivo')).toBe(false);
      expect(compat(C, 'A', 'negativo', 'A', 'positivo')).toBe(false);
    });

    it('doente Rh+ pode receber Rh- e Rh+ do mesmo ABO', () => {
      expect(compat(C, 'A', 'positivo', 'A', 'negativo')).toBe(true);
      expect(compat(C, 'A', 'positivo', 'A', 'positivo')).toBe(true);
    });

    it('grupo do doente por determinar → só dador universal O Rh-', () => {
      expect(compat(C, null, null, 'O', 'negativo')).toBe(true);
      expect(compat(C, null, null, 'O', 'positivo')).toBe(false);
      expect(compat(C, null, null, 'A', 'negativo')).toBe(false);
    });
  });

  describe('plasma (plasma_fresco_congelado) — compatibilidade ABO invertida', () => {
    const P = 'plasma_fresco_congelado';

    it('AB é dador universal de plasma', () => {
      for (const abo of ['A', 'B', 'AB', 'O']) {
        expect(compat(P, abo, 'positivo', 'AB', 'positivo')).toBe(true);
      }
    });

    it('doente O é recetor universal de plasma (recebe de qualquer grupo ABO)', () => {
      for (const abo of ['A', 'B', 'AB', 'O']) {
        expect(compat(P, 'O', 'positivo', abo, 'positivo')).toBe(true);
      }
    });

    it('doente AB só recebe plasma AB', () => {
      expect(compat(P, 'AB', 'positivo', 'AB', 'positivo')).toBe(true);
      expect(compat(P, 'AB', 'positivo', 'A', 'positivo')).toBe(false);
      expect(compat(P, 'AB', 'positivo', 'O', 'positivo')).toBe(false);
    });

    it('grupo por determinar → plasma só AB', () => {
      expect(compat(P, null, null, 'AB', 'positivo')).toBe(true);
      expect(compat(P, null, null, 'O', 'positivo')).toBe(false);
    });
  });
});

describe('TransfusaoService — métodos com BD (mock)', () => {
  const prisma: any = {
    doente: { findUnique: jest.fn() },
    pedidoTransfusao: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    bolsaSangue: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  };
  const alertas: any = { criarAlerta: jest.fn().mockResolvedValue(undefined) };
  let svc: TransfusaoService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new TransfusaoService(prisma, alertas);
  });

  describe('criarPedido()', () => {
    it('lança NotFoundException quando o doente não existe', async () => {
      prisma.doente.findUnique.mockResolvedValue(null);
      await expect(
        svc.criarPedido('d1', { componente: 'concentrado_eritrocitos', numeroUnidades: 1, indicacao: 'x' } as any, 'med-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cria o pedido com urgência rotina por omissão', async () => {
      prisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.pedidoTransfusao.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data }));
      const r: any = await svc.criarPedido('d1', { componente: 'concentrado_eritrocitos', numeroUnidades: 2, indicacao: 'anemia' } as any, 'med-1');
      expect(r.urgencia).toBe('rotina');
      expect(r.numeroUnidades).toBe(2);
    });
  });

  describe('adicionarBolsa()', () => {
    it('rejeita número de unidade duplicado', async () => {
      prisma.bolsaSangue.findUnique.mockResolvedValue({ id: 'b1' });
      await expect(
        svc.adicionarBolsa({ numeroUnidade: 'U1', componente: 'concentrado_eritrocitos', grupoABO: 'O', rhD: 'negativo', dataValidade: '2027-01-01' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('bolsasCompativeis()', () => {
    it('devolve só as bolsas ABO/Rh compatíveis (doente O- → só O-)', async () => {
      prisma.pedidoTransfusao.findUnique.mockResolvedValue({
        id: 'p1', componente: 'concentrado_eritrocitos', grupoABO: 'O', rhD: 'negativo', doente: { grupoSanguineo: 'O-' },
      });
      prisma.bolsaSangue.findMany.mockResolvedValue([
        { id: 'o-neg', grupoABO: 'O', rhD: 'negativo' },
        { id: 'ab-pos', grupoABO: 'AB', rhD: 'positivo' },
        { id: 'o-pos', grupoABO: 'O', rhD: 'positivo' },
      ]);
      const r = await svc.bolsasCompativeis('p1');
      expect(r.map((b: any) => b.id)).toEqual(['o-neg']);
    });

    it('lança NotFoundException quando o pedido não existe', async () => {
      prisma.pedidoTransfusao.findUnique.mockResolvedValue(null);
      await expect(svc.bolsasCompativeis('nao-existe')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('administrar()', () => {
    it('rejeita quando a tripla-verificação está incompleta', async () => {
      await expect(
        svc.administrar('p1', { bolsaId: 'b1', verificacaoABO: true, verificacaoUnidade: false, verificacaoValidade: true } as any, 'enf-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

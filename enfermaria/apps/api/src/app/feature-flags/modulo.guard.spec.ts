import { NotFoundException } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { MODULOS_OPCIONAIS, flagDoModulo, moduloDaRotaApi, moduloDaRotaWeb, modulosDesligados } from '@org/shared';
import { ModuloGuard } from './modulo.guard';
import { FeatureFlagsService } from './feature-flags.service';

const ctx = (path: string) => ({
  getType: () => 'http',
  switchToHttp: () => ({ getRequest: () => ({ path }) }),
}) as any;

function servico(flags: { key: string; enabled: boolean }[]) {
  const prisma = { featureFlag: { findMany: jest.fn().mockResolvedValue(flags.map((f) => ({ roles: [], servicos: [], rolloutPercent: 0, ...f }))) } };
  return new FeatureFlagsService(prisma as any);
}

// PROD-20: módulos opcionais desligáveis por instalação.
describe('PROD-20 — módulos opcionais', () => {
  it('as rotas da API e da web mapeiam para o módulo certo', () => {
    expect(moduloDaRotaApi('/v1/faturacao/episodios')?.id).toBe('faturacao');
    expect(moduloDaRotaApi('/v1/atos-clinicos')?.id).toBe('faturacao');
    expect(moduloDaRotaApi('/v1/rh/avaliacoes/1')?.id).toBe('rh');
    expect(moduloDaRotaApi('/v1/rh/ausencias')).toBeUndefined(); // ausências afetam a escala: núcleo
    expect(moduloDaRotaApi('/v1/doentes/1')).toBeUndefined();
    expect(moduloDaRotaApi('/v1/faturacaoXYZ')).toBeUndefined(); // prefixo inteiro, não substring
    expect(moduloDaRotaWeb('/tabela-atos')?.id).toBe('faturacao');
    expect(moduloDaRotaWeb('/mar')).toBeUndefined();
  });

  it('sem flag o módulo está ligado; só a flag a false o desliga', async () => {
    expect(await servico([]).moduloLigado('faturacao')).toBe(true);
    expect(await servico([{ key: 'modulo.faturacao', enabled: true }]).moduloLigado('faturacao')).toBe(true);
    expect(await servico([{ key: 'modulo.faturacao', enabled: false }]).moduloLigado('faturacao')).toBe(false);
    expect(modulosDesligados({ 'modulo.faturacao': false, 'modulo.rh': true, outra: false })).toEqual(new Set(['faturacao']));
  });

  it('a guarda devolve 404 só nas rotas do módulo desligado', async () => {
    const guarda = new ModuloGuard(servico([{ key: flagDoModulo('faturacao'), enabled: false }]));
    await expect(guarda.canActivate(ctx('/v1/faturacao/episodios'))).rejects.toThrow(NotFoundException);
    await expect(guarda.canActivate(ctx('/v1/atos-clinicos'))).rejects.toThrow(NotFoundException);
    await expect(guarda.canActivate(ctx('/v1/fornecedores'))).resolves.toBe(true);
    await expect(guarda.canActivate(ctx('/v1/doentes'))).resolves.toBe(true);
  });

  it('o mapa enviado à web reflete o estado do módulo, sem rollout por utilizador', async () => {
    const s = servico([{ key: 'modulo.ti', enabled: true }, { key: 'modulo.rh', enabled: false }]);
    expect(await s.paraContexto({ userId: 'u1', role: 'enfermeiro' })).toMatchObject({ 'modulo.ti': true, 'modulo.rh': false });
  });

  it('cada módulo opcional aponta para controllers que existem', () => {
    const app = join(__dirname, '..');
    const prefixos = new Set<string>();
    const percorrer = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) percorrer(p);
        else if (e.name.endsWith('.controller.ts')) {
          const m = /@Controller\(['"]([^'"]+)['"]/.exec(readFileSync(p, 'utf8'));
          if (m) prefixos.add(m[1]);
        }
      }
    };
    percorrer(app);
    const semController = MODULOS_OPCIONAIS.flatMap((m) => m.api).filter((p) => ![...prefixos].some((c) => p === c || p.startsWith(`${c}/`)));
    expect(semController).toEqual([]);
  });
});

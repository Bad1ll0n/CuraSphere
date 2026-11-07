import { BadRequestException } from '@nestjs/common';
import { SsoService } from './sso.service';

// QA-21 — SSO (0 % de cobertura). A defesa em profundidade que importa: nenhuma claim do IdP
// auto-provisiona uma conta com privilégios de administração.
describe('SsoService', () => {
  let prisma: any, auth: any, svc: SsoService;
  beforeEach(() => {
    prisma = {
      utilizador: { findFirst: jest.fn(), create: jest.fn(async ({ data }) => ({ id: 'novo', ...data })), update: jest.fn() },
      ssoProvider: { findUnique: jest.fn() },
    };
    auth = { emitirSessaoExterna: jest.fn(() => ({ accessToken: 't' })) };
    svc = new SsoService(prisma, auth);
  });

  it.each([
    ['admin', 'administrativo'], ['it', 'administrativo'], ['director', 'administrativo'],
    ['ti', 'administrativo'], ['direcao', 'administrativo'], [undefined, 'administrativo'],
    ['doctor', 'medico'], ['Nurse', 'enfermeiro'], ['pharmacist', 'farmaceutico'],
  ])('claim "%s" provisiona como %s (nunca ti/direcao)', async (claim, esperado) => {
    prisma.utilizador.findFirst.mockResolvedValue(null);
    const u = await svc.provisionarUtilizador({ id: 'idp-1', nome: 'Ana', role: claim as string | undefined });
    expect(u.role).toBe(esperado);
  });

  it('conta nova: identificador ligado ao IdP, password aleatória (inutilizável) e sem MFA herdado', async () => {
    prisma.utilizador.findFirst.mockResolvedValue(null);
    const u = await svc.provisionarUtilizador({ id: 'idp-9', email: 'a@h.pt', role: 'nurse' });
    expect(u.numeroFuncionario).toBe('sso:idp-9');
    expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(u.nome).toBe('a@h.pt');
  });

  it('conta existente: só actualiza o nome — nunca o papel, venha a claim que vier', async () => {
    prisma.utilizador.findFirst.mockResolvedValue({ id: 'u1', nome: 'Antigo', role: 'enfermeiro' });
    await svc.provisionarUtilizador({ id: 'idp-1', nome: 'Novo', role: 'director' });
    expect(prisma.utilizador.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { nome: 'Novo' } });
    expect(prisma.utilizador.create).not.toHaveBeenCalled();
  });

  it('a sessão sai pelo mesmo mecanismo do login (revogável, recusa contas inactivas)', () => {
    svc.emitirTokens({ id: 'u1' });
    expect(auth.emitirSessaoExterna).toHaveBeenCalledWith({ id: 'u1' });
  });

  it('fornecedor inexistente → 400', async () => {
    prisma.ssoProvider.findUnique.mockResolvedValue(null);
    await expect(svc.getProvider('x')).rejects.toBeInstanceOf(BadRequestException);
  });
});

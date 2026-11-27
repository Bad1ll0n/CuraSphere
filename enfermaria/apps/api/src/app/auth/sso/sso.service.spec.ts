import { BadRequestException } from '@nestjs/common';
import { SsoService, mfaNoOidc, mfaNoSaml } from './sso.service';

// QA-21 — SSO (0 % de cobertura). A defesa em profundidade que importa: nenhuma claim do IdP
// auto-provisiona uma conta com privilégios de administração.
describe('SsoService', () => {
  let prisma: any, auth: any, svc: SsoService;
  beforeEach(() => {
    prisma = {
      utilizador: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({ id: 'novo', ...data })),
        update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
      },
      ssoProvider: { findUnique: jest.fn() },
    };
    auth = { emitirSessaoExterna: jest.fn(async () => ({ accessToken: 't', refreshToken: 'r' })), criarDesafioMfa: jest.fn(async () => 'desafio') };
    svc = new SsoService(prisma, auth);
  });

  it.each([
    ['admin', 'administrativo'], ['it', 'administrativo'], ['director', 'administrativo'],
    ['ti', 'administrativo'], ['direcao', 'administrativo'], [undefined, 'administrativo'],
    ['doctor', 'medico'], ['Nurse', 'enfermeiro'], ['pharmacist', 'farmaceutico'],
  ])('claim "%s" provisiona como %s (nunca ti/direcao)', async (claim, esperado) => {
    const u = await svc.provisionarUtilizador('prov-1', { id: 'idp-1', nome: 'Ana', role: claim as string | undefined });
    expect(u.role).toBe(esperado);
  });

  it('conta nova: ligada ao PAR (fornecedor, subject), password aleatória (inutilizável) e sem MFA herdado', async () => {
    const u = await svc.provisionarUtilizador('prov-abcdef123', { id: 'idp-9', email: 'a@h.pt', role: 'nurse' });
    expect(u).toMatchObject({ ssoProviderId: 'prov-abcdef123', ssoSubject: 'idp-9', numeroFuncionario: 'sso:prov-abc:idp-9', nome: 'a@h.pt', mfaAtivo: false });
    expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('SEC-05: o mesmo subject noutro fornecedor NÃO abre a conta existente', async () => {
    await svc.provisionarUtilizador('prov-2', { id: 'idp-1' });
    expect(prisma.utilizador.findUnique).toHaveBeenCalledWith({ where: { ssoProviderId_ssoSubject: { ssoProviderId: 'prov-2', ssoSubject: 'idp-1' } } });
    // A conta legada procurada é só a ainda SEM fornecedor.
    expect(prisma.utilizador.findFirst).toHaveBeenCalledWith({ where: { numeroFuncionario: 'sso:idp-1', ssoProviderId: null } });
    expect(prisma.utilizador.create).toHaveBeenCalled();
  });

  it('conta legada (sso:<sub>) liga-se ao fornecedor no primeiro login', async () => {
    prisma.utilizador.findFirst.mockResolvedValue({ id: 'u-legado', nome: 'Ana', role: 'enfermeiro' });
    const u = await svc.provisionarUtilizador('prov-1', { id: 'idp-1' });
    expect(prisma.utilizador.update).toHaveBeenCalledWith({ where: { id: 'u-legado' }, data: { ssoProviderId: 'prov-1', ssoSubject: 'idp-1' } });
    expect(u.id).toBe('u-legado');
  });

  it('conta existente: só actualiza o nome — nunca o papel, venha a claim que vier', async () => {
    prisma.utilizador.findUnique.mockResolvedValue({ id: 'u1', nome: 'Antigo', role: 'enfermeiro' });
    await svc.provisionarUtilizador('prov-1', { id: 'idp-1', nome: 'Novo', role: 'director' });
    expect(prisma.utilizador.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { nome: 'Novo' } });
    expect(prisma.utilizador.create).not.toHaveBeenCalled();
  });

  it('sem subject → 400', async () => {
    await expect(svc.provisionarUtilizador('prov-1', { id: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('SEC-05 — o SSO não salta o 2.º fator', () => {
    const conta = (mfaAtivo: boolean, ativo = true) => ({ id: 'u1', mfaAtivo, ativo });
    it('MFA no fornecedor → sessão', async () => {
      expect(await svc.concluirLogin(conta(false), true, {})).toEqual({ tipo: 'sessao', accessToken: 't', refreshToken: 'r' });
    });
    it('sem MFA no fornecedor e com MFA na conta → desafio TOTP, não sessão', async () => {
      expect(await svc.concluirLogin(conta(true), false, {})).toEqual({ tipo: 'mfa', mfaChallengeToken: 'desafio' });
      expect(auth.emitirSessaoExterna).not.toHaveBeenCalled();
    });
    it('sem MFA em lado nenhum → recusado, salvo configuração explícita do fornecedor', async () => {
      await expect(svc.concluirLogin(conta(false), false, {})).rejects.toThrow(/SSO_SEM_MFA/);
      expect((await svc.concluirLogin(conta(false), false, { permitirSemMfa: 'true' })).tipo).toBe('sessao');
    });
    it('conta inativa → recusada', async () => {
      await expect(svc.concluirLogin(conta(false, false), true, {})).rejects.toThrow(/inativo/);
    });
    it('deteção de MFA: OIDC amr/acr e SAML AuthnContext', () => {
      expect(mfaNoOidc({ amr: ['pwd', 'mfa'] }, {})).toBe(true);
      expect(mfaNoOidc({ amr: ['pwd'] }, {})).toBe(false);
      expect(mfaNoOidc({ acr: 'urn:hosp:mfa' }, { acrMfa: 'urn:hosp:mfa' })).toBe(true);
      expect(mfaNoSaml({ authnContextClassRef: 'urn:oasis:names:tc:SAML:2.0:ac:classes:MultiFactor' }, {})).toBe(true);
      expect(mfaNoSaml({ authnContextClassRef: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport' }, {})).toBe(false);
    });
  });

  it('a sessão sai pelo mesmo mecanismo do login (revogável, recusa contas inactivas)', async () => {
    await svc.emitirTokens({ id: 'u1' });
    expect(auth.emitirSessaoExterna).toHaveBeenCalledWith({ id: 'u1' });
  });

  it('fornecedor inexistente → 400', async () => {
    prisma.ssoProvider.findUnique.mockResolvedValue(null);
    await expect(svc.getProvider('x')).rejects.toBeInstanceOf(BadRequestException);
  });
});

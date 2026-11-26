import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { hashPassword } from '../../common/seguranca/password';
import * as crypto from 'crypto';

export interface SsoProfile {
  id: string;
  email?: string;
  nome?: string;
  role?: string;
  subRole?: string;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listarProviders() {
    return this.prisma.ssoProvider.findMany({
      where: { ativo: true },
      select: { id: true, tipo: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async criarProvider(data: { tipo: string; nome: string; config: object }) {
    return this.prisma.ssoProvider.create({ data });
  }

  async actualizarProvider(id: string, data: { nome?: string; config?: object; ativo?: boolean }) {
    return this.prisma.ssoProvider.update({ where: { id }, data });
  }

  async eliminarProvider(id: string) {
    return this.prisma.ssoProvider.delete({ where: { id } });
  }

  async getProvider(id: string) {
    const provider = await this.prisma.ssoProvider.findUnique({ where: { id } });
    if (!provider) throw new BadRequestException('Provider SSO não encontrado');
    return provider;
  }

  /**
   * Provisiona ou actualiza um utilizador a partir de um perfil SSO.
   *
   * SEC-05: a identidade é do PAR (fornecedor, subject). Antes procurava-se só `sso:<sub>`, pelo
   * que outro fornecedor configurado (ou um IdP de teste) com o mesmo `sub` entrava na mesma
   * conta. Contas criadas antes desta versão (`sso:<sub>`, sem fornecedor) ligam-se ao fornecedor
   * no primeiro login — e a partir daí só esse as abre.
   */
  async provisionarUtilizador(providerId: string, profile: SsoProfile): Promise<any> {
    if (!profile.id) throw new BadRequestException('O fornecedor de identidade não enviou o identificador (sub/nameID)');
    let utilizador = await this.prisma.utilizador.findUnique({
      where: { ssoProviderId_ssoSubject: { ssoProviderId: providerId, ssoSubject: profile.id } },
    });

    if (!utilizador) {
      const legado = await this.prisma.utilizador.findFirst({ where: { numeroFuncionario: `sso:${profile.id}`, ssoProviderId: null } });
      if (legado) {
        utilizador = await this.prisma.utilizador.update({ where: { id: legado.id }, data: { ssoProviderId: providerId, ssoSubject: profile.id } });
        this.logger.warn(`SSO: conta legada ${legado.id} ligada ao fornecedor ${providerId}`);
      }
    }

    if (!utilizador) {
      const nome = profile.nome ?? profile.email ?? 'Utilizador SSO';
      const role = this.deduzirRole(profile.role);
      utilizador = await this.prisma.utilizador.create({
        data: {
          numeroFuncionario: `sso:${providerId.slice(0, 8)}:${profile.id}`.slice(0, 190),
          nome,
          passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex'), 12),
          role,
          subRole: profile.subRole ?? null,
          mfaAtivo: false,
          ssoProviderId: providerId,
          ssoSubject: profile.id,
        },
      });
      this.logger.log(`SSO: utilizador provisionado — id=${utilizador.id}, role=${role}`);
    } else if (profile.nome && utilizador.nome !== profile.nome) {
      await this.prisma.utilizador.update({
        where: { id: utilizador.id },
        data: { nome: profile.nome },
      });
    }

    return utilizador;
  }

  /**
   * SEC-05 — o SSO não salta o 2.º factor. Três casos:
   *  - o fornecedor afirma que houve MFA (OIDC `amr`/`acr`, SAML AuthnContext) → sessão;
   *  - a conta tem MFA ativo no CuraSphere → desafio TOTP (o mesmo do login por password);
   *  - nem uma coisa nem outra → recusado, salvo se o fornecedor estiver configurado com
   *    `permitirSemMfa: "true"` (decisão explícita de quem administra o SSO).
   * Conta desativada ou bloqueada nunca recebe sessão (`emitirSessaoExterna` lê-o da BD).
   */
  async concluirLogin(utilizador: { id: string; mfaAtivo: boolean; ativo: boolean }, mfaNoFornecedor: boolean, config: Record<string, unknown>):
    Promise<{ tipo: 'sessao'; accessToken: string; refreshToken: string } | { tipo: 'mfa'; mfaChallengeToken: string }> {
    if (!utilizador.ativo) throw new BadRequestException('Utilizador inativo');
    if (!mfaNoFornecedor && utilizador.mfaAtivo) {
      return { tipo: 'mfa', mfaChallengeToken: await this.authService.criarDesafioMfa(utilizador.id) };
    }
    if (!mfaNoFornecedor && config['permitirSemMfa'] !== 'true' && config['permitirSemMfa'] !== true) {
      throw new BadRequestException('SSO_SEM_MFA: o fornecedor de identidade não confirmou o 2.º fator e a conta não tem MFA ativo.');
    }
    const { accessToken, refreshToken } = await this.emitirTokens(utilizador);
    return { tipo: 'sessao', accessToken, refreshToken };
  }

  /**
   * Emite a sessão pelo mesmo mecanismo do login por password (access token JWT +
   * refresh token opaco persistido em BD, revogável) — evita duplicar lógica de
   * emissão de tokens e contornar a infraestrutura de revogação de sessões.
   */
  emitirTokens(utilizador: { id: string }) {
    return this.authService.emitirSessaoExterna(utilizador);
  }

  /**
   * SEGURANÇA: mesmo com a Response/Assertion SAML (@node-saml/node-saml) e o
   * id_token OIDC (JWKS + nonce) agora verificados criptograficamente em
   * sso.controller.ts, mantemos esta camada de defesa em profundidade: claims que
   * mapeariam para roles administrativas ('ti', 'direcao') continuam deliberadamente
   * rebaixadas para 'administrativo'. Um IdP mal configurado (ou um atacante com
   * acesso legítimo mas limitado ao IdP) não deve conseguir auto-provisionar uma
   * conta com privilégios de administrador só por controlar um valor de claim —
   * promoção a 'ti'/'direcao' deve continuar a ser um acto manual de um admin
   * existente após a criação da conta.
   */
  private deduzirRole(claimRole?: string): string {
    if (!claimRole) return 'administrativo';
    const mapa: Record<string, string> = {
      doctor: 'medico', physician: 'medico', medico: 'medico',
      nurse: 'enfermeiro', enfermeiro: 'enfermeiro',
      pharmacist: 'farmaceutico', farmaceutico: 'farmaceutico',
      // 'admin'/'it'/'management'/'director' NÃO mapeiam para 'ti'/'direcao' — ver nota acima.
    };
    return mapa[claimRole.toLowerCase()] ?? 'administrativo';
  }
}

/** OIDC: o IdP afirma MFA em `amr` (RFC 8176) ou num `acr` configurado como multifator. */
export function mfaNoOidc(payload: Record<string, any>, config: Record<string, unknown>): boolean {
  const amr: string[] = Array.isArray(payload['amr']) ? payload['amr'].map(String) : [];
  if (amr.some((m) => ['mfa', 'otp', 'hwk', 'swk', 'sms', 'fpt', 'face', 'iris', 'pin', 'sc'].includes(m.toLowerCase()))) return true;
  const acrMfa = typeof config['acrMfa'] === 'string' ? (config['acrMfa'] as string) : null;
  return !!acrMfa && payload['acr'] === acrMfa;
}

/** SAML: AuthnContextClassRef multifator (padrões comuns ou o configurado). */
export function mfaNoSaml(profile: Record<string, any>, config: Record<string, unknown>): boolean {
  const classe = String(profile['authnContextClassRef'] ?? '');
  const configurada = typeof config['samlMfaContext'] === 'string' ? (config['samlMfaContext'] as string) : null;
  return /MultiFactor|TimeSyncToken|Smartcard/i.test(classe) || (!!configurada && classe === configurada);
}

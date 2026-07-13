import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnomalyDetectionService } from '../common/anomaly-detection.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { authenticator } = require('otplib') as any;
import { toDataURL } from 'qrcode';

// Hash bcrypt fixo (cost 12) usado para equalizar o tempo de resposta
// quando o utilizador não existe. Evita user-enumeration timing attack.
const DUMMY_BCRYPT_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8L1z/Bm5wQq6zP2N5p8m7rUcD3xK2C';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly anomaly: AnomalyDetectionService,
  ) {}

  /**
   * Marca um código TOTP como já-utilizado em Redis com TTL > janela de validade.
   * Devolve `true` se o código pode prosseguir (primeira vez), `false` se já foi usado.
   *
   * Se Redis estiver indisponível, devolvemos `false` (fail-closed) para operações
   * críticas — preferimos negar do que permitir um replay silencioso.
   */
  private async consumirTotpUmaVez(scope: string, secret: string, code: string): Promise<boolean> {
    // Hash do secret + code para nunca persistir o secret cleartext em Redis
    const hash = crypto.createHash('sha256').update(`${secret}:${code}`).digest('hex');
    const key = `totp:used:${scope}:${hash}`;
    // TTL = 90 s cobre a janela do otplib (default 30 s + 1 step de tolerância)
    const ok = await this.redis.setIfNotExists(key, '1', 90);
    if (ok === null) {
      this.logger.warn(`Redis indisponível — anti-replay TOTP fail-closed (scope=${scope})`);
      return false;
    }
    return ok;
  }

  async login(numeroFuncionario: string, password: string, ip?: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { numeroFuncionario },
    });

    // Equalizar tempo de resposta — corre bcrypt mesmo quando o utilizador não existe
    if (!utilizador || !utilizador.ativo) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH).catch(() => false);
      this.logger.warn(`Tentativa de login falhada para funcionário: ${numeroFuncionario}`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const lockKey = `login:lock:${utilizador.id}`;
    const failKey = `login:fail:${utilizador.id}`;
    const lockAtivo = await this.redis.get<string>(lockKey);
    if (lockAtivo) {
      throw new UnauthorizedException('Conta temporariamente bloqueada. Tente novamente em 15 minutos.');
    }

    const passwordValida = await bcrypt.compare(password, utilizador.passwordHash);
    if (!passwordValida) {
      const falhas = (await this.redis.get<number>(failKey) ?? 0) + 1;
      if (falhas >= 5) {
        await this.redis.set(lockKey, '1', 900);
        await this.redis.del(failKey);
        this.logger.warn(`Conta bloqueada por excesso de falhas: ${utilizador.numeroFuncionario}`);
        throw new UnauthorizedException('Conta temporariamente bloqueada. Tente novamente em 15 minutos.');
      }
      await this.redis.set(failKey, falhas, 900);
      this.logger.warn(`Password incorreta para funcionário: ${utilizador.numeroFuncionario} (${falhas}/5)`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.redis.del(failKey);

    this.anomaly.verificarIpLogin(utilizador.id, ip);

    if (utilizador.mfaAtivo) {
      const mfaChallengeToken = this.jwtService.sign(
        { sub: utilizador.id, mfaChallenge: true },
        { expiresIn: '5m' },
      );
      return { mfaPendente: true as const, mfaChallengeToken };
    }

    const rolesClinicos = ['medico', 'enfermeiro', 'farmaceutico', 'tecnico_saude', 'auxiliar'];
    if (rolesClinicos.includes(utilizador.role) && !utilizador.mfaAtivo) {
      const mfaSetupToken = this.jwtService.sign(
        { sub: utilizador.id, mfaSetup: true },
        { expiresIn: '30m' },
      );
      return { mfaPendente: false as const, mfaSetupObrigatorio: true as const, mfaSetupToken };
    }

    if (utilizador.passwordExpiresAt && utilizador.passwordExpiresAt < new Date()) {
      const passwordExpiredToken = this.jwtService.sign(
        { sub: utilizador.id, passwordExpired: true },
        { expiresIn: '15m' },
      );
      return { mfaPendente: false as const, passwordExpirada: true as const, passwordExpiredToken };
    }

    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const refreshToken = await this.criarRefreshToken(utilizador.id);
    const diasRestantes = utilizador.passwordExpiresAt
      ? Math.ceil((utilizador.passwordExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    const passwordExpiradoAviso = diasRestantes !== null && diasRestantes <= 10;
    return { mfaPendente: false as const, accessToken, refreshToken, utilizador: this.buildUtilizadorDto(utilizador), passwordExpiradoAviso, diasRestantesSenha: diasRestantes };
  }

  async verificarMfaLogin(mfaChallengeToken: string, code: string) {
    let payload: { sub: string; mfaChallenge: boolean };
    try {
      payload = this.jwtService.verify(mfaChallengeToken);
    } catch {
      throw new UnauthorizedException('Desafio MFA expirado ou inválido. Faça login novamente.');
    }
    if (!payload.mfaChallenge) throw new UnauthorizedException('Token inválido');

    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: payload.sub } });
    if (!utilizador || !utilizador.mfaAtivo || !utilizador.mfaSecret) {
      throw new UnauthorizedException('MFA não configurado para este utilizador');
    }

    const isValid = authenticator.verify({ token: code, secret: utilizador.mfaSecret });
    if (!isValid) throw new UnauthorizedException('Código MFA inválido');

    // Anti-replay: cada código TOTP só pode ser usado uma vez na janela de 90 s
    const primeiraVez = await this.consumirTotpUmaVez(`mfa:${utilizador.id}`, utilizador.mfaSecret, code);
    if (!primeiraVez) {
      this.logger.warn(`Replay de código TOTP detectado para utilizador ${utilizador.id}`);
      throw new UnauthorizedException('Código MFA já utilizado. Aguarde o próximo código.');
    }

    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const refreshToken = await this.criarRefreshToken(utilizador.id);
    return { accessToken, refreshToken, utilizador: this.buildUtilizadorDto(utilizador) };
  }

  async setupMfa(utilizadorId: string, setupToken?: string) {
    // If a setupToken is provided, check if it has already been used to prevent replay
    if (setupToken) {
      const jaUsado = await this.redis.get<string>(`mfaSetup:used:${utilizadorId}`);
      if (jaUsado) {
        throw new BadRequestException('MFA setup já utilizado. Faça login novamente.');
      }
    }

    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
      select: { numeroFuncionario: true, mfaAtivo: true },
    });
    if (!utilizador) throw new UnauthorizedException('Utilizador não encontrado');
    if (utilizador.mfaAtivo) throw new BadRequestException('MFA já está ativo. Desative primeiro.');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(utilizador.numeroFuncionario, 'CuraSphere', secret);
    const qrCodeDataUrl = await toDataURL(otpAuthUrl);
    return { secret, qrCodeDataUrl };
  }

  async ativarMfa(utilizadorId: string, secret: string, code: string, setupToken?: string) {
    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) throw new BadRequestException('Código inválido. Verifique a aplicação autenticadora.');

    const primeiraVez = await this.consumirTotpUmaVez(`mfa-ativar:${utilizadorId}`, secret, code);
    if (!primeiraVez) {
      throw new BadRequestException('Código já utilizado. Aguarde o próximo código.');
    }

    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: { mfaSecret: secret, mfaAtivo: true },
    });

    // Invalidate the mfaSetupToken so it cannot be replayed to trigger another setup
    if (setupToken) {
      await this.redis.set(`mfaSetup:used:${utilizadorId}`, '1', 1800);
    }

    return { mensagem: 'Autenticação em 2 passos ativada com sucesso' };
  }

  async desativarMfa(utilizadorId: string, code: string) {
    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: utilizadorId } });
    if (!utilizador?.mfaAtivo || !utilizador?.mfaSecret) {
      throw new BadRequestException('MFA não está ativo');
    }
    const isValid = authenticator.verify({ token: code, secret: utilizador.mfaSecret });
    if (!isValid) throw new BadRequestException('Código inválido');

    const primeiraVez = await this.consumirTotpUmaVez(`mfa-desativar:${utilizadorId}`, utilizador.mfaSecret, code);
    if (!primeiraVez) {
      throw new BadRequestException('Código já utilizado. Aguarde o próximo código.');
    }

    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: { mfaSecret: null, mfaAtivo: false },
    });
    return { mensagem: 'Autenticação em 2 passos desativada' };
  }

  async refresh(token: string) {
    const registro = await this.prisma.refreshToken.findUnique({ where: { token } });

    // Token inexistente OU expirado → recusa normal
    if (!registro || registro.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Reuse-detection: um refresh-token já revogado a ser reapresentado significa que
    // alguém o capturou. Revogamos TODAS as sessões do utilizador (token theft).
    if (registro.revogado) {
      this.logger.warn(`Refresh-token reuse detectado para utilizador ${registro.utilizadorId} — revogando todas as sessões`);
      await this.prisma.refreshToken.updateMany({
        where: { utilizadorId: registro.utilizadorId, revogado: false },
        data: { revogado: true },
      });
      throw new UnauthorizedException('Sessão comprometida. Faça login novamente.');
    }

    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: registro.utilizadorId } });
    if (!utilizador || !utilizador.ativo) throw new UnauthorizedException('Utilizador inativo');

    await this.prisma.refreshToken.update({ where: { token }, data: { revogado: true } });

    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const novoRefreshToken = await this.criarRefreshToken(utilizador.id);
    return { accessToken, refreshToken: novoRefreshToken, utilizador: this.buildUtilizadorDto(utilizador) };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token, revogado: false },
      data: { revogado: true },
    });
    return { mensagem: 'Sessão terminada' };
  }

  async getMe(id: string) {
    return this.prisma.utilizador.findUnique({
      where: { id },
      select: { id: true, nome: true, numeroFuncionario: true, role: true, subRole: true, servico: true, mfaAtivo: true },
    });
  }

  async alterarPassword(utilizadorId: string, passwordAtual: string, novaPassword: string) {
    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: utilizadorId } });
    if (!utilizador) throw new UnauthorizedException('Utilizador não encontrado');

    const passwordValida = await bcrypt.compare(passwordAtual, utilizador.passwordHash);
    if (!passwordValida) throw new UnauthorizedException('Password atual incorreta');

    const novaPasswordHash = await bcrypt.hash(novaPassword, 12);
    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: {
        passwordHash: novaPasswordHash,
        passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { utilizadorId, revogado: false },
      data: { revogado: true },
    });
    return { mensagem: 'Password alterada com sucesso' };
  }

  async passwordStatus(userId: string) {
    const u = await this.prisma.utilizador.findUnique({ where: { id: userId }, select: { passwordExpiresAt: true } });
    if (!u?.passwordExpiresAt) return { expira: false, diasRestantes: null };
    const dias = Math.ceil((u.passwordExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { expira: dias <= 0, diasRestantes: dias, aviso: dias <= 10 };
  }

  private buildPayload(u: { id: string; nome: string; numeroFuncionario: string; role: string; subRole?: string | null; servico: string; tenantId?: string | null }) {
    return { sub: u.id, nome: u.nome, numeroFuncionario: u.numeroFuncionario, role: u.role, subRole: u.subRole ?? undefined, servico: u.servico, tenantId: u.tenantId ?? 'default' };
  }

  /**
   * Emite uma sessão (access + refresh token) usando exactamente o mesmo mecanismo
   * do login por password: access token JWT curto + refresh token opaco persistido
   * em BD (revogável, com reuse-detection). Deve ser usado por QUALQUER via de
   * autenticação alternativa (WebAuthn, SSO, etc.) para não contornar a
   * infraestrutura de revogação/expiração de sessões.
   */
  async emitirSessaoExterna(utilizador: {
    id: string; nome: string; numeroFuncionario: string; role: string;
    subRole?: string | null; servico: string; tenantId?: string | null;
  }) {
    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const refreshToken = await this.criarRefreshToken(utilizador.id);
    return { accessToken, refreshToken, utilizador: this.buildUtilizadorDto(utilizador) };
  }

  private buildUtilizadorDto(u: { id: string; nome: string; numeroFuncionario: string; role: string; subRole?: string | null; servico: string; tenantId?: string | null }) {
    return { id: u.id, nome: u.nome, numeroFuncionario: u.numeroFuncionario, role: u.role, subRole: u.subRole ?? undefined, servico: u.servico, tenantId: u.tenantId ?? 'default' };
  }

  private async criarRefreshToken(utilizadorId: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const dias = parseInt(raw) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dias);
    await this.prisma.refreshToken.create({ data: { token, utilizadorId, expiresAt } });
    return token;
  }
}

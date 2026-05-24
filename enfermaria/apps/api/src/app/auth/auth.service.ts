import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(numeroFuncionario: string, password: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { numeroFuncionario },
    });

    if (!utilizador || !utilizador.ativo) {
      this.logger.warn(`Tentativa de login falhada para funcionário: ${numeroFuncionario}`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValida = await bcrypt.compare(password, utilizador.passwordHash);
    if (!passwordValida) {
      this.logger.warn(`Password incorreta para funcionário: ${numeroFuncionario}`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (utilizador.mfaAtivo) {
      const mfaChallengeToken = this.jwtService.sign(
        { sub: utilizador.id, mfaChallenge: true },
        { expiresIn: '5m' },
      );
      return { mfaPendente: true as const, mfaChallengeToken };
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

    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const refreshToken = await this.criarRefreshToken(utilizador.id);
    return { accessToken, refreshToken, utilizador: this.buildUtilizadorDto(utilizador) };
  }

  async setupMfa(utilizadorId: string) {
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

  async ativarMfa(utilizadorId: string, secret: string, code: string) {
    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) throw new BadRequestException('Código inválido. Verifique a aplicação autenticadora.');

    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: { mfaSecret: secret, mfaAtivo: true },
    });
    return { mensagem: 'Autenticação em 2 passos ativada com sucesso' };
  }

  async desativarMfa(utilizadorId: string, code: string) {
    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: utilizadorId } });
    if (!utilizador?.mfaAtivo || !utilizador?.mfaSecret) {
      throw new BadRequestException('MFA não está ativo');
    }
    const isValid = authenticator.verify({ token: code, secret: utilizador.mfaSecret });
    if (!isValid) throw new BadRequestException('Código inválido');

    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: { mfaSecret: null, mfaAtivo: false },
    });
    return { mensagem: 'Autenticação em 2 passos desativada' };
  }

  async refresh(token: string) {
    const registro = await this.prisma.refreshToken.findUnique({ where: { token } });
    if (!registro || registro.revogado || registro.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
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

  private buildPayload(u: { id: string; nome: string; numeroFuncionario: string; role: string; subRole?: string | null; servico: string }) {
    return { sub: u.id, nome: u.nome, numeroFuncionario: u.numeroFuncionario, role: u.role, subRole: u.subRole ?? undefined, servico: u.servico };
  }

  private buildUtilizadorDto(u: { id: string; nome: string; numeroFuncionario: string; role: string; subRole?: string | null; servico: string }) {
    return { id: u.id, nome: u.nome, numeroFuncionario: u.numeroFuncionario, role: u.role, subRole: u.subRole ?? undefined, servico: u.servico };
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

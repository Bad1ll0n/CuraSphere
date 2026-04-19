import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

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

    const payload = {
      sub: utilizador.id,
      numeroFuncionario: utilizador.numeroFuncionario,
      role: utilizador.role,
      subRole: utilizador.subRole ?? undefined,
      servico: utilizador.servico,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.criarRefreshToken(utilizador.id);

    return {
      accessToken,
      refreshToken,
      utilizador: {
        id: utilizador.id,
        nome: utilizador.nome,
        numeroFuncionario: utilizador.numeroFuncionario,
        role: utilizador.role,
        subRole: utilizador.subRole ?? undefined,
        servico: utilizador.servico,
      },
    };
  }

  async refresh(token: string) {
    const registro = await this.prisma.refreshToken.findUnique({ where: { token } });

    if (!registro || registro.revogado || registro.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: registro.utilizadorId },
    });

    if (!utilizador || !utilizador.ativo) {
      throw new UnauthorizedException('Utilizador inativo');
    }

    // Revogar o token antigo (rotação)
    await this.prisma.refreshToken.update({ where: { token }, data: { revogado: true } });

    const payload = {
      sub: utilizador.id,
      numeroFuncionario: utilizador.numeroFuncionario,
      role: utilizador.role,
      subRole: utilizador.subRole ?? undefined,
      servico: utilizador.servico,
    };

    const accessToken = this.jwtService.sign(payload);
    const novoRefreshToken = await this.criarRefreshToken(utilizador.id);

    return { accessToken, refreshToken: novoRefreshToken };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token, revogado: false },
      data: { revogado: true },
    });
    return { mensagem: 'Sessão terminada' };
  }

  async alterarPassword(utilizadorId: string, passwordAtual: string, novaPassword: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
    });

    if (!utilizador) {
      throw new UnauthorizedException('Utilizador não encontrado');
    }

    const passwordValida = await bcrypt.compare(passwordAtual, utilizador.passwordHash);
    if (!passwordValida) {
      throw new UnauthorizedException('Password atual incorreta');
    }

    const novaPasswordHash = await bcrypt.hash(novaPassword, 12);
    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: { passwordHash: novaPasswordHash },
    });

    // Revogar todos os refresh tokens do utilizador após mudança de password
    await this.prisma.refreshToken.updateMany({
      where: { utilizadorId, revogado: false },
      data: { revogado: true },
    });

    return { mensagem: 'Password alterada com sucesso' };
  }

  private async criarRefreshToken(utilizadorId: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const dias = parseInt(raw) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dias);

    await this.prisma.refreshToken.create({
      data: { token, utilizadorId, expiresAt },
    });

    return token;
  }
}

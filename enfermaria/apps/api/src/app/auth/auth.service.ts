import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(numeroFuncionario: string, password: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { numeroFuncionario },
    });

    if (!utilizador || !utilizador.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValida = await bcrypt.compare(password, utilizador.passwordHash);
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = {
      sub: utilizador.id,
      numeroFuncionario: utilizador.numeroFuncionario,
      role: utilizador.role,
      subRole: utilizador.subRole ?? undefined,
      servico: utilizador.servico,
    };

    return {
      accessToken: this.jwtService.sign(payload),
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

    const novaPasswordHash = await bcrypt.hash(novaPassword, 10);
    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: { passwordHash: novaPasswordHash },
    });

    return { mensagem: 'Password alterada com sucesso' };
  }
}

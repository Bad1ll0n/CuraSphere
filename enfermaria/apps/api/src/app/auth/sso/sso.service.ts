import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
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
    private readonly jwtService: JwtService,
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
   * Se não existir, cria com role deduzida das claims.
   */
  async provisionarUtilizador(profile: SsoProfile): Promise<any> {
    const ssoId = `sso:${profile.id}`;

    let utilizador = await this.prisma.utilizador.findFirst({
      where: { numeroFuncionario: ssoId },
    });

    if (!utilizador) {
      const nome = profile.nome ?? profile.email ?? 'Utilizador SSO';
      const role = this.deduzirRole(profile.role);
      utilizador = await this.prisma.utilizador.create({
        data: {
          numeroFuncionario: ssoId,
          nome,
          passwordHash: await import('bcryptjs').then(b => b.hash(crypto.randomBytes(32).toString('hex'), 12)),
          role,
          subRole: profile.subRole ?? null,
          mfaAtivo: false,
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

  emitirTokens(utilizador: any) {
    const payload = { sub: utilizador.id, role: utilizador.role, subRole: utilizador.subRole };
    const accessToken  = this.jwtService.sign(payload, { expiresIn: '1h' as any });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' as any });
    return { accessToken, refreshToken, utilizador };
  }

  private deduzirRole(claimRole?: string): string {
    if (!claimRole) return 'administrativo';
    const mapa: Record<string, string> = {
      doctor: 'medico', physician: 'medico', medico: 'medico',
      nurse: 'enfermeiro', enfermeiro: 'enfermeiro',
      pharmacist: 'farmaceutico', farmaceutico: 'farmaceutico',
      admin: 'ti', it: 'ti', ti: 'ti',
      management: 'direcao', director: 'direcao', direcao: 'direcao',
    };
    return mapa[claimRole.toLowerCase()] ?? 'administrativo';
  }
}

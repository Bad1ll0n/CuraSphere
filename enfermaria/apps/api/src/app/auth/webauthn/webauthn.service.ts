import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);
  private readonly rpName = 'CuraSphere';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private get rpId(): string {
    const apiUrl = this.config.get<string>('NEXT_PUBLIC_API_URL', 'http://localhost:3333');
    try {
      return new URL(apiUrl).hostname;
    } catch {
      return 'localhost';
    }
  }

  private get origin(): string {
    const webUrl = this.config.get<string>('NEXT_PUBLIC_WEB_URL', 'http://localhost:4200');
    return webUrl;
  }

  async generateRegistrationOptions(utilizadorId: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
      select: { id: true, nome: true, numeroFuncionario: true, webAuthnCredentials: { select: { credentialId: true } } },
    });
    if (!utilizador) throw new BadRequestException('Utilizador não encontrado');

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userID: new TextEncoder().encode(utilizador.id) as Uint8Array<ArrayBuffer>,
      userName: utilizador.numeroFuncionario,
      userDisplayName: utilizador.nome,
      attestationType: 'none',
      excludeCredentials: utilizador.webAuthnCredentials.map((c) => ({
        id: c.credentialId,
        type: 'public-key' as const,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Guardar challenge em Redis (TTL 60s)
    await this.redis.set(`webauthn:reg:${utilizadorId}`, options.challenge, 60);
    return options;
  }

  async verifyRegistration(
    utilizadorId: string,
    response: RegistrationResponseJSON,
    nome: string,
  ) {
    const expectedChallenge = await this.redis.get<string>(`webauthn:reg:${utilizadorId}`);
    if (!expectedChallenge) throw new BadRequestException('Challenge expirado ou inválido');

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
      });
    } catch (err) {
      this.logger.warn(`WebAuthn registration verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Verificação de passkey falhou');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey inválida');
    }

    const { credential } = verification.registrationInfo;

    await this.prisma.webAuthnCredential.create({
      data: {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        transports: (response.response.transports as string[]) ?? [],
        nome: nome || 'Passkey',
        utilizadorId,
      },
    });

    await this.redis.del(`webauthn:reg:${utilizadorId}`);
    return { verified: true };
  }

  async generateAuthenticationOptions(credentialId?: string) {
    const allowCredentials = credentialId
      ? [{ id: credentialId, type: 'public-key' as const }]
      : [];

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
      allowCredentials,
    });

    await this.redis.set(`webauthn:auth:${options.challenge}`, options.challenge, 60);
    return options;
  }

  async verifyAuthentication(response: AuthenticationResponseJSON) {
    // Buscar credencial pelo credentialId
    const cred = await this.prisma.webAuthnCredential.findUnique({
      where: { credentialId: response.id },
      include: { utilizador: true },
    });
    if (!cred) throw new UnauthorizedException('Passkey não reconhecida');

    // Re-buscar o challenge correcto
    const challengeKey = `webauthn:auth:challenge:${cred.utilizadorId}`;
    const challenge = await this.redis.get<string>(challengeKey);
    if (!challenge) throw new UnauthorizedException('Challenge expirado');

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
        credential: {
          id: cred.credentialId,
          publicKey: new Uint8Array(cred.publicKey),
          counter: Number(cred.counter),
          transports: cred.transports as AuthenticatorTransportFuture[],
        },
      });
    } catch (err) {
      this.logger.warn(`WebAuthn auth verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Autenticação com passkey falhou');
    }

    if (!verification.verified) throw new UnauthorizedException('Passkey inválida');

    // Actualizar counter (previne replay)
    await this.prisma.webAuthnCredential.update({
      where: { credentialId: response.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        ultimoUsoEm: new Date(),
      },
    });

    await this.redis.del(challengeKey);
    return cred.utilizador;
  }

  async generateAuthChallengeForUser(numeroFuncionario: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { numeroFuncionario },
      select: { id: true, webAuthnCredentials: { select: { credentialId: true, transports: true } } },
    });
    if (!utilizador || utilizador.webAuthnCredentials.length === 0) {
      throw new BadRequestException('Sem passkeys registadas');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
      allowCredentials: utilizador.webAuthnCredentials.map((c) => ({
        id: c.credentialId,
        type: 'public-key' as const,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    await this.redis.set(`webauthn:auth:challenge:${utilizador.id}`, options.challenge, 60);
    return options;
  }

  async listarCredenciais(utilizadorId: string) {
    return this.prisma.webAuthnCredential.findMany({
      where: { utilizadorId },
      select: { id: true, nome: true, deviceType: true, backedUp: true, criadoEm: true, ultimoUsoEm: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async removerCredencial(id: string, utilizadorId: string) {
    const cred = await this.prisma.webAuthnCredential.findFirst({
      where: { id, utilizadorId },
    });
    if (!cred) throw new BadRequestException('Credencial não encontrada');
    await this.prisma.webAuthnCredential.delete({ where: { id } });
    return { removida: true };
  }
}

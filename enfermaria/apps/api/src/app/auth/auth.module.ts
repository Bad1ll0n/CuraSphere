import { Module } from '@nestjs/common';
import { opcoesModuloJwt } from './chaves-jwt';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { WebAuthnService } from './webauthn/webauthn.service';
import { WebAuthnController } from './webauthn/webauthn.controller';
import { SsoService } from './sso/sso.service';
import { SsoController } from './sso/sso.controller';

import { SessaoCacheSincronizacao } from './sessao-cache.sync';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // SEC-11: ES256 (chave privada só na API) em produção; HS256 com JWT_SECRET fora dela.
      useFactory: (config: ConfigService) => opcoesModuloJwt(config.get<string>('JWT_EXPIRES_IN', '15m')),
    }),
  ],
  controllers: [AuthController, WebAuthnController, SsoController],
  providers: [AuthService, JwtStrategy, WebAuthnService, SsoService, SessaoCacheSincronizacao],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as any,
          algorithm: 'HS256',
          issuer: 'curasphere-api',
          audience: 'curasphere',
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: 'curasphere-api',
          audience: 'curasphere',
        },
      }),
    }),
  ],
  controllers: [AuthController, WebAuthnController, SsoController],
  providers: [AuthService, JwtStrategy, WebAuthnService, SsoService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

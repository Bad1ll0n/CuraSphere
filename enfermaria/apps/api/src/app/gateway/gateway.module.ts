import { Module } from '@nestjs/common';
import { opcoesModuloJwt } from '../auth/chaves-jwt';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // SEC-11: as mesmas chaves da API (o gateway só verifica bilhetes de socket).
      useFactory: (config: ConfigService) => opcoesModuloJwt(config.get<string>('JWT_EXPIRES_IN', '15m')),
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}

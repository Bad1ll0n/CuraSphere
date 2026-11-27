import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { BarramentoService } from './barramento.service';

@Global()
@Module({
  providers: [RedisService, BarramentoService],
  exports: [RedisService, BarramentoService],
})
export class RedisModule {}

import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisHealthIndicator } from './redis.health';

@Global()
@Module({
  providers: [RedisService, RedisHealthIndicator],
  exports: [RedisService, RedisHealthIndicator],
})
export class RedisModule {}

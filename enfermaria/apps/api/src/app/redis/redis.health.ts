import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from './redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.set('__health__', '1', 5);
      const val = await this.redis.get<string>('__health__');
      const ok = val === '1';
      const result = this.getStatus(key, ok);
      if (!ok) throw new HealthCheckError('Redis check failed', result);
      return result;
    } catch (err) {
      const result = this.getStatus(key, false);
      throw new HealthCheckError('Redis check failed', result);
    }
  }
}

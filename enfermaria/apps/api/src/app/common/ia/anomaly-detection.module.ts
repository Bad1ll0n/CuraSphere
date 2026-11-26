import { Global, Module } from '@nestjs/common';
import { AnomalyDetectionService } from './anomaly-detection.service';

@Global()
@Module({
  providers: [AnomalyDetectionService],
  exports: [AnomalyDetectionService],
})
export class AnomalyDetectionModule {}

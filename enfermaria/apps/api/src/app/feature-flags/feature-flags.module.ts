import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureGuard } from './require-feature.decorator';

/**
 * @Global para que o FeatureGuard/FeatureFlagsService fiquem injetáveis em qualquer módulo
 * que queira gate por feature (sem reimportar).
 */
@Global()
@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureGuard],
  exports: [FeatureFlagsService, FeatureGuard],
})
export class FeatureFlagsModule {}

import { Module } from '@nestjs/common';
import { FeridasService } from './feridas.service';
import { FeridasController } from './feridas.controller';
import { DoenteModule } from '../doentes/doentes.module';
import { StorageModule } from '../common/storage.module';

@Module({
  imports: [DoenteModule, StorageModule],
  controllers: [FeridasController],
  providers: [FeridasService],
  exports: [FeridasService],
})
export class FeridasModule {}

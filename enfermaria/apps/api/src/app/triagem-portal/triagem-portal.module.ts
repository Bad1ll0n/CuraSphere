import { Module } from '@nestjs/common';
import { TriagemPortalService } from './triagem-portal.service';
import { TriagemPortalController } from './triagem-portal.controller';

@Module({
  controllers: [TriagemPortalController],
  providers: [TriagemPortalService],
})
export class TriagemPortalModule {}

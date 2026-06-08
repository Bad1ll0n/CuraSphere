import { Module } from '@nestjs/common';
import { GuidelinesService } from './guidelines.service';
import { GuidelinesController } from './guidelines.controller';

@Module({
  controllers: [GuidelinesController],
  providers: [GuidelinesService],
  exports: [GuidelinesService],
})
export class GuidelinesModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StewardshipService } from './stewardship.service';
import { StewardshipController } from './stewardship.controller';

@Module({
  imports: [PrismaModule],
  providers: [StewardshipService],
  controllers: [StewardshipController],
  exports: [StewardshipService],
})
export class StewardshipModule {}

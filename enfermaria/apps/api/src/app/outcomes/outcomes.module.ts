import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OutcomesService } from './outcomes.service';
import { OutcomesController } from './outcomes.controller';

@Module({
  imports: [PrismaModule],
  controllers: [OutcomesController],
  providers: [OutcomesService],
  exports: [OutcomesService],
})
export class OutcomesModule {}

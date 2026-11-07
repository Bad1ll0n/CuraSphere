import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CamasModule } from '../camas/camas.module';
import { EpisodiosController } from './episodios.controller';
import { EpisodiosService } from './episodios.service';

@Module({
  imports: [PrismaModule, CamasModule],
  controllers: [EpisodiosController],
  providers: [EpisodiosService],
  exports: [EpisodiosService],
})
export class EpisodiosModule {}

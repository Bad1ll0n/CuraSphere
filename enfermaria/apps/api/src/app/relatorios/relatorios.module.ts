import { Module } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosController } from './relatorios.controller';
import { ExcelService } from '../common/excel.service';

@Module({
  controllers: [RelatoriosController],
  providers: [RelatoriosService, ExcelService],
  exports: [RelatoriosService],
})
export class RelatoriosModule {}

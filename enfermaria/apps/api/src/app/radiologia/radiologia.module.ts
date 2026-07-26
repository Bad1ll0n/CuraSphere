import { Module } from '@nestjs/common';
import { RadiologiaController } from './radiologia.controller';
import { RadiologiaService } from './radiologia.service';
import { AlertasModule } from '../alertas/alertas.module';

// Módulo Radiologia (RIS): laudo estruturado (técnica/achados/conclusão) sobre exames de imagem,
// com assinatura que alimenta o resultado do exame e alerta em laudos urgentes.
@Module({
  imports: [AlertasModule],
  controllers: [RadiologiaController],
  providers: [RadiologiaService],
})
export class RadiologiaModule {}

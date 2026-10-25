import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RadiologiaService } from './radiologia.service';
import { GuardarLaudoDto } from './dto/guardar-laudo.dto';

// Reporting radiológico (RIS): sobre o fluxo de Exame existente. Role-gated (radiologista=médico),
// sem assertAcessoDoente — os radiologistas reportam exames de doentes a que não estão atribuídos,
// tal como a worklist e o registo de resultado do módulo exames.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('radiologia')
export class RadiologiaController {
  constructor(private readonly service: RadiologiaService) {}

  @Get('worklist')
  @Roles('medico', 'enfermeiro')
  worklist() {
    return this.service.worklist();
  }

  @Get('exame/:exameId/laudo')
  @Roles('medico', 'enfermeiro')
  laudo(@Param('exameId') exameId: string) {
    return this.service.laudoDoExame(exameId);
  }

  @Post('exame/:exameId/laudo')
  @Roles('medico')
  guardar(@Param('exameId') exameId: string, @Body() dto: GuardarLaudoDto, @Request() req: any) {
    return this.service.guardarLaudo(exameId, dto, req.user.sub);
  }

  @Post('laudo/:laudoId/assinar')
  @Roles('medico')
  assinar(@Param('laudoId') laudoId: string, @Request() req: any) {
    return this.service.assinarLaudo(laudoId, req.user.sub);
  }
}

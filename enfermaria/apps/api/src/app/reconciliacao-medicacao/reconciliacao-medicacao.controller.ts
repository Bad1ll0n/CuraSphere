import { Controller, Get, Post, Patch, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReconciliacaoMedicacaoService, CriarReconciliacaoDto } from './reconciliacao-medicacao.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reconciliacao-medicacao')
export class ReconciliacaoMedicacaoController {
  constructor(private readonly service: ReconciliacaoMedicacaoService) {}

  @Post(':doenteId')
  @Roles('farmaceutico', 'medico')
  criar(@Param('doenteId') doenteId: string, @Body() dto: CriarReconciliacaoDto, @Request() req: any) {
    return this.service.criar(doenteId, dto, req.user.sub);
  }

  @Patch(':id/aprovar')
  @Roles('medico')
  aprovar(@Param('id') id: string, @Request() req: any) {
    return this.service.aprovar(id, req.user.sub);
  }

  @Get(':doenteId')
  @Roles('medico', 'farmaceutico', 'enfermeiro', 'chefe_enfermeiros')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Get('pendentes/aprovacao')
  @Roles('medico', 'farmaceutico')
  listarPendentes() {
    return this.service.listarPendenteAprovacao();
  }
}

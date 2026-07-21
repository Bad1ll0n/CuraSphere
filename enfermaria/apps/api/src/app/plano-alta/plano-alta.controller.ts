import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlanoAltaService, AtualizarPlanoAltaDto } from './plano-alta.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('plano-alta')
export class PlanoAltaController {
  constructor(private readonly service: PlanoAltaService) {}

  @Get(':doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  buscar(@Param('doenteId') doenteId: string) {
    return this.service.buscar(doenteId);
  }

  @Patch(':doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  atualizar(@Param('doenteId') doenteId: string, @Body() dto: AtualizarPlanoAltaDto) {
    return this.service.atualizar(doenteId, dto);
  }
}

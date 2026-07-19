import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BaselinesService } from './baselines.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('baselines')
export class BaselinesController {
  constructor(private readonly service: BaselinesService) {}

  @Get('risco-turno')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  riscoTurno(@Query('servico') servico: string) {
    return this.service.calcularRiscoTurno(servico ?? '');
  }

  @Get(':doenteId/risco')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  risco(@Param('doenteId') doenteId: string) {
    return this.service.calcularRisco(doenteId);
  }

  @Get(':doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  buscar(@Param('doenteId') doenteId: string) {
    return this.service.buscar(doenteId);
  }
}

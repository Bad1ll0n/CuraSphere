import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VigilanciaService } from './vigilancia.service';

/** PROD-10 — vigilância programada: o que está em atraso e o que vem a seguir. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vigilancia')
export class VigilanciaController {
  constructor(private readonly service: VigilanciaService) {}

  /** Observações em atraso: dos doentes atribuídos no turno, ou do serviço inteiro (chefias). */
  @Get('em-atraso')
  @Roles('enfermeiro', 'medico', 'chefe_enfermeiros', 'chefe_turno', 'chefe_medicos', 'direcao', 'qualidade')
  emAtraso(@Request() req: any, @Query('servico') servico?: string) {
    return this.service.doServico(req.user, servico, true);
  }

  /** Próximas observações devidas de um doente (atrasadas ou não). */
  @Get('doente/:doenteId')
  @Roles('enfermeiro', 'medico', 'chefe_enfermeiros', 'chefe_turno', 'chefe_medicos', 'direcao', 'qualidade')
  doDoente(@Param('doenteId') doenteId: string) {
    return this.service.doDoente(doenteId);
  }
}

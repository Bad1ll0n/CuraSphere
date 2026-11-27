import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConsentimentosTratamentoService } from './consentimentos-tratamento.service';
import { RegistarConsentimentoTratamentoDto } from './consentimentos-tratamento.dto';

/**
 * SEC-19 — registo presencial das decisões do doente (o doente também as gere no portal).
 * Todas as rotas levam `:doenteId`, por isso passam pela verificação global de acesso ao doente.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consentimentos-tratamento')
export class ConsentimentosTratamentoController {
  constructor(private readonly service: ConsentimentosTratamentoService) {}

  @Get('doente/:doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'administrativo', 'direcao')
  estado(@Param('doenteId') doenteId: string) {
    return this.service.estado(doenteId);
  }

  @Post('doente/:doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'administrativo')
  registar(@Param('doenteId') doenteId: string, @Body() dto: RegistarConsentimentoTratamentoDto, @Request() req: any) {
    return this.service.registar(doenteId, dto, 'presencial', req.user.sub);
  }

  @Post('doente/:doenteId/revogar/:finalidade')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'administrativo')
  revogar(@Param('doenteId') doenteId: string, @Param('finalidade') finalidade: string, @Request() req: any) {
    return this.service.revogar(doenteId, finalidade, 'presencial', req.user.sub);
  }
}

import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DietasService } from './dietas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dietas')
export class DietasController {
  constructor(private readonly service: DietasService) {}

  @Roles('medico', 'enfermeiro')
  @Post()
  prescrever(
    @Body() body: { doenteId: string; tipo: string; restricoes?: string[]; observacoes?: string },
    @Request() req: any,
  ) {
    return this.service.prescrever({ ...body, criadaPorId: req.user.sub });
  }

  @Get('doente/:doenteId')
  dietaAtual(@Param('doenteId') doenteId: string) {
    return this.service.dietaAtual(doenteId);
  }

  @Get('doente/:doenteId/historico')
  historico(@Param('doenteId') doenteId: string) {
    return this.service.historico(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'auxiliar', 'administrativo')
  @Get('hoje')
  dietasHoje() {
    return this.service.dietasHoje();
  }
}

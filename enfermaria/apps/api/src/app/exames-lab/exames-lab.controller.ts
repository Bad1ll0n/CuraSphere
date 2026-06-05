import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ExamesLabService } from './exames-lab.service';
import { CriarResultadoDto } from './dto/criar-resultado.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exames-lab')
export class ExamesLabController {
  constructor(private readonly service: ExamesLabService) {}

  @Get('doente/:doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico', 'chefe_turno')
  listar(
    @Param('doenteId') doenteId: string,
    @Query('painel') painel?: string,
  ) {
    return this.service.listarPorDoente(doenteId, painel);
  }

  @Get('doente/:doenteId/resumo')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico', 'chefe_turno')
  resumo(@Param('doenteId') doenteId: string) {
    return this.service.obterResumo(doenteId);
  }

  @Post()
  @Roles('medico', 'enfermeiro', 'farmaceutico')
  criar(@Body() dto: CriarResultadoDto, @Request() req: any) {
    return this.service.criar(dto, req.user.userId);
  }

  @Post('lote')
  @Roles('medico', 'enfermeiro', 'farmaceutico')
  criarLote(@Body() body: { resultados: CriarResultadoDto[] }, @Request() req: any) {
    return this.service.criarLote(body.resultados, req.user.userId);
  }
}

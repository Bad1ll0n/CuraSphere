import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SinaisVitaisService } from './sinais-vitais.service';
import { CriarSinalVitalDto } from './dto/criar-sinal-vital.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sinais-vitais')
export class SinaisVitaisController {
  constructor(private readonly service: SinaisVitaisService) {}

  @Roles('medico', 'enfermeiro', 'auxiliar', 'tecnico_saude')
  @Post(':doenteId')
  criar(@Param('doenteId') doenteId: string, @Body() dto: CriarSinalVitalDto, @Request() req: any) {
    return this.service.criar(doenteId, req.user.sub, req.user.role, dto);
  }

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Get(':doenteId/ultimo')
  ultimo(@Param('doenteId') doenteId: string) {
    return this.service.ultimo(doenteId);
  }

  @Get(':doenteId/tendencia')
  analisarTendencia(@Param('doenteId') doenteId: string) {
    return this.service.analisarTendencia(doenteId);
  }
}

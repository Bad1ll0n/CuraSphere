import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { EscalasClinicasService } from './escalas-clinicas.service';
import { CriarEscalaClinicaDto } from './dto/criar-escala-clinica.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('escalas-clinicas')
export class EscalasClinicasController {
  constructor(private readonly service: EscalasClinicasService) {}

  @Post(':doenteId')
  registar(@Param('doenteId') doenteId: string, @Body() dto: CriarEscalaClinicaDto, @Request() req: any) {
    return this.service.registar(doenteId, dto, req.user.sub);
  }

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string, @Query('tipo') tipo?: string) {
    return this.service.listar(doenteId, tipo);
  }

  @Get(':doenteId/recentes')
  listarRecentes(@Param('doenteId') doenteId: string) {
    return this.service.listarRecentes(doenteId);
  }
}

import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { CamasService } from './camas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EstadoCama } from '../common/enums';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('camas')
export class CamasController {
  constructor(private readonly camasService: CamasService) {}

  @Get()
  listar() {
    return this.camasService.listar();
  }

  @Get('ocupacao')
  ocupacao() {
    return this.camasService.ocupacao();
  }

  @Roles('enfermeiro', 'administrativo')
  @Post()
  criar(@Body() body: { numero: string; quarto: string }) {
    return this.camasService.criar(body);
  }

  @Roles('administrativo', 'enfermeiro')
  @Patch(':id/estado')
  atualizarEstado(@Param('id') id: string, @Body() body: { estado: EstadoCama }) {
    return this.camasService.atualizarEstado(id, body.estado);
  }
}

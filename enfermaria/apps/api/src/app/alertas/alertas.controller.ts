import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertasService } from './alertas.service';

@UseGuards(JwtAuthGuard)
@Controller('alertas')
export class AlertasController {
  constructor(private readonly service: AlertasService) {}

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listarNaoLidos(doenteId);
  }

  @Patch(':id/ler')
  marcarLido(@Param('id') id: string) {
    return this.service.marcarLido(id);
  }

  @Patch(':doenteId/ler-todos')
  marcarTodosLidos(@Param('doenteId') doenteId: string) {
    return this.service.marcarTodosLidos(doenteId);
  }
}

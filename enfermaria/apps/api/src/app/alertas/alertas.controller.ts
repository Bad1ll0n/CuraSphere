import { Controller, Get, Post, Patch, Param, UseGuards, Request } from '@nestjs/common';
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

  @Post(':doenteId/sos')
  acionarSOS(@Param('doenteId') doenteId: string, @Request() req: any) {
    return this.service.acionarSOS(doenteId, req.user.sub);
  }

  @Patch(':id/acusar')
  acusar(@Param('id') id: string, @Request() req: any) {
    return this.service.acusar(id, req.user.sub);
  }
}

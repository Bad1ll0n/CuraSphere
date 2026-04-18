import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DispositivosInvasivosService } from './dispositivos-invasivos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dispositivos-invasivos')
export class DispositivosInvasivosController {
  constructor(private readonly dispositivosInvasivosService: DispositivosInvasivosService) {}

  @Get('doente/:doenteId')
  listar(
    @Param('doenteId') doenteId: string,
    @Query('todos') todos?: string,
  ) {
    return this.dispositivosInvasivosService.listar(doenteId, todos !== 'true');
  }

  @Post('doente/:doenteId')
  registar(
    @Param('doenteId') doenteId: string,
    @Body() body: { tipo: string; localizacao?: string; observacoes?: string },
    @Request() req: any,
  ) {
    return this.dispositivosInvasivosService.registar(doenteId, req.user.sub, body);
  }

  @Patch(':id/remover')
  remover(@Param('id') id: string) {
    return this.dispositivosInvasivosService.remover(id);
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TrocasService } from './trocas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('trocas')
export class TrocasController {
  constructor(private readonly service: TrocasService) {}

  @Get()
  listar(@Request() req: any) {
    return this.service.listar(req.user.sub);
  }

  @Get('colegas')
  colegas(@Request() req: any, @Query('turnoId') turnoId: string) {
    return this.service.colegasDisponiveis(req.user.sub, turnoId);
  }

  @Post()
  criar(@Request() req: any, @Body() body: { turnoId: string; destinatarioId: string }) {
    return this.service.criar(req.user.sub, body.turnoId, body.destinatarioId);
  }

  @Patch(':id/responder')
  responder(@Param('id') id: string, @Request() req: any, @Body() body: { aceitar: boolean }) {
    return this.service.responderDestinatario(id, req.user.sub, body.aceitar);
  }

  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string, @Request() req: any, @Body() body: { aprovar: boolean }) {
    return this.service.aprovarChefe(id, req.user.sub, body.aprovar);
  }

  @Delete(':id')
  cancelar(@Param('id') id: string, @Request() req: any) {
    return this.service.cancelar(id, req.user.sub);
  }
}

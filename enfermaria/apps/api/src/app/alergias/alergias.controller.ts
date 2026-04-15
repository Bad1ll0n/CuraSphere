import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlergiasService } from './alergias.service';

@UseGuards(JwtAuthGuard)
@Controller('alergias')
export class AlergiasController {
  constructor(private readonly service: AlergiasService) {}

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Post(':doenteId')
  criar(@Param('doenteId') doenteId: string, @Body() body: Record<string, any>, @Request() req: any) {
    return this.service.criar(doenteId, req.user.role, body);
  }

  @Delete(':id')
  remover(@Param('id') id: string, @Request() req: any) {
    return this.service.remover(id, req.user.role);
  }
}

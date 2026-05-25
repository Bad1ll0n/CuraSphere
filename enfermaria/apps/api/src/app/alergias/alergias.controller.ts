import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AlergiasService } from './alergias.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alergias')
export class AlergiasController {
  constructor(private readonly service: AlergiasService) {}

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Roles('medico', 'enfermeiro')
  @Post(':doenteId')
  criar(@Param('doenteId') doenteId: string, @Body() body: Record<string, any>, @Request() req: any) {
    return this.service.criar(doenteId, req.user.role, body);
  }

  @Roles('medico', 'enfermeiro')
  @Delete(':id')
  remover(@Param('id') id: string, @Request() req: any) {
    return this.service.remover(id, req.user.role);
  }
}

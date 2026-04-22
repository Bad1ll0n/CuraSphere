import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { NotasClinicasService } from './notas-clinicas.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notas-clinicas')
export class NotasClinicasController {
  constructor(private readonly service: NotasClinicasService) {}

  @Post(':doenteId')
  @Roles('medico', 'enfermeiro')
  criar(@Param('doenteId') doenteId: string, @Body() dto: any, @Request() req: any) {
    return this.service.criar(doenteId, dto, req.user.sub);
  }

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Patch(':id')
  @Roles('medico', 'enfermeiro')
  atualizar(@Param('id') id: string, @Body() dto: any) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @Roles('medico')
  apagar(@Param('id') id: string) {
    return this.service.apagar(id);
  }
}

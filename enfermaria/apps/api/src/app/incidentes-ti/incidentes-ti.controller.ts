import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';
import { IncidentesTIService } from './incidentes-ti.service';
import { CriarIncidenteDto } from './dto/criar-incidente.dto';
import { AtualizarIncidenteDto } from './dto/atualizar-incidente.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidentes-ti')
export class IncidentesTIController {
  constructor(private readonly service: IncidentesTIService) {}

  @Post()
  criar(@Body() dto: CriarIncidenteDto, @Request() req: any) {
    return this.service.criar(dto, req.user.id);
  }

  @Get()
  listar(@Request() req: any) {
    return this.service.listar(req.user.id, req.user.role);
  }

  @Get(':id')
  detalhe(@Param('id') id: string) {
    return this.service.detalhe(id);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarIncidenteDto, @Request() req: any) {
    return this.service.atualizar(id, dto, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.it_admin)
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(id);
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { AtosClinicosService } from './atos-clinicos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CriarAtoClinicoDto } from './dto/criar-ato-clinico.dto';
import { AtualizarAtoClinicoDto } from './dto/atualizar-ato-clinico.dto';

@Controller('atos-clinicos')
@UseGuards(JwtAuthGuard)
export class AtosClinicosController {
  constructor(private service: AtosClinicosService) {}

  @Get()
  listar(@Query('todos') todos?: string) {
    return todos === 'true' ? this.service.listarTodos() : this.service.listar();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('administrativo', 'direcao')
  criar(@Body() dto: CriarAtoClinicoDto) {
    return this.service.criar(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('administrativo', 'direcao')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarAtoClinicoDto) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('administrativo', 'direcao')
  desativar(@Param('id') id: string) {
    return this.service.desativar(id);
  }
}

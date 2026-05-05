import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { AtosClinicosService } from './atos-clinicos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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
  criar(@Body() body: {
    codigo: string;
    descricao: string;
    categoria: string;
    precoBase: number;
    especialidade?: string;
    ativo?: boolean;
  }) {
    return this.service.criar(body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('administrativo', 'direcao')
  atualizar(@Param('id') id: string, @Body() body: {
    codigo?: string;
    descricao?: string;
    categoria?: string;
    precoBase?: number;
    especialidade?: string;
    ativo?: boolean;
  }) {
    return this.service.atualizar(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('administrativo', 'direcao')
  desativar(@Param('id') id: string) {
    return this.service.desativar(id);
  }
}

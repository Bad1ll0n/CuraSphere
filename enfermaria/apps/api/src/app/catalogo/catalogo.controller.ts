import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  @Get()
  listar(@Query('search') search?: string) {
    return this.catalogoService.listar(search);
  }

  @Roles('farmaceutico', 'administrativo')
  @Post()
  criar(@Body() body: {
    dci: string;
    nomeMarca?: string;
    formaFarmaceutica: string;
    classeTerap: string;
    unidade: string;
    concentracao?: string;
    codigoATC?: string;
  }) {
    return this.catalogoService.criar(body);
  }

  @Roles('farmaceutico', 'administrativo')
  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() body: Partial<{
    dci: string;
    nomeMarca: string;
    formaFarmaceutica: string;
    classeTerap: string;
    unidade: string;
    concentracao: string;
    codigoATC: string;
  }>) {
    return this.catalogoService.atualizar(id, body);
  }

  @Roles('farmaceutico', 'administrativo')
  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.catalogoService.desativar(id);
  }
}

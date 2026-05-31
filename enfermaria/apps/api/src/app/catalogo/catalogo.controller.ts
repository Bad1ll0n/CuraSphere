import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CriarCatalogoItemDto } from './dto/criar-catalogo-item.dto';
import { AtualizarCatalogoItemDto } from './dto/atualizar-catalogo-item.dto';

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
  criar(@Body() dto: CriarCatalogoItemDto) {
    return this.catalogoService.criar(dto);
  }

  @Roles('farmaceutico', 'administrativo')
  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarCatalogoItemDto) {
    return this.catalogoService.atualizar(id, dto);
  }

  @Roles('farmaceutico', 'administrativo')
  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.catalogoService.desativar(id);
  }
}

import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ListaEsperaService } from './lista-espera.service';
import { AdicionarListaEsperaDto, AtualizarListaEsperaDto } from './dto/lista-espera.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lista-espera')
export class ListaEsperaController {
  constructor(private readonly service: ListaEsperaService) {}

  @Get()
  @Roles('administrativo', 'direcao', 'medico', 'enfermeiro', 'chefe_enfermeiros')
  listar(@Query('especialidade') especialidade?: string, @Query('estado') estado?: string) {
    return this.service.listar(especialidade, estado);
  }

  @Post()
  @Roles('administrativo', 'direcao', 'medico', 'enfermeiro')
  adicionar(@Body() dto: AdicionarListaEsperaDto) {
    return this.service.adicionar(dto);
  }

  @Patch(':id')
  @Roles('administrativo', 'direcao', 'medico')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarListaEsperaDto) {
    return this.service.atualizarEstado(id, dto.estado);
  }

  @Get('proximo/:especialidade')
  @Roles('administrativo', 'direcao', 'medico')
  proximo(@Param('especialidade') especialidade: string) {
    return this.service.proximoParaVaga(especialidade);
  }
}

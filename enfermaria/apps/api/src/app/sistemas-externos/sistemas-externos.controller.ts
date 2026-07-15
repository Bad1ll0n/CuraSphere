import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SistemasExternosService } from './sistemas-externos.service';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

class CriarSistemaDto {
  @IsString() @MaxLength(200) nome: string;
  @IsString() @MaxLength(50) tipo: string;
  @IsOptional() @IsString() @MaxLength(500) endpoint?: string;
  @IsOptional() @IsString() @MaxLength(50) authTipo?: string;
  @IsOptional() @IsString() @MaxLength(2000) authConfig?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

class IdentificadorDto {
  @IsString() @MaxLength(36) sistemaId: string;
  @IsString() @MaxLength(200) valorId: string;
  @IsString() @MaxLength(50) tipo: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sistemas-externos')
export class SistemasExternosController {
  constructor(private readonly service: SistemasExternosService) {}

  @Get()
  @Roles('ti', 'direcao', 'medico', 'chefe_enfermeiros')
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  @Roles('ti', 'direcao')
  obter(@Param('id') id: string) {
    return this.service.obter(id);
  }

  @Post()
  @Roles('ti', 'direcao')
  criar(@Body() dto: CriarSistemaDto) {
    return this.service.criar(dto);
  }

  @Patch(':id')
  @Roles('ti', 'direcao')
  atualizar(@Param('id') id: string, @Body() dto: Partial<CriarSistemaDto>) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @Roles('ti', 'direcao')
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }

  @Post(':id/testar')
  @Roles('ti', 'direcao', 'medico')
  testar(@Param('id') id: string) {
    return this.service.testarConectividade(id);
  }

  @Get('doente/:doenteId/identificadores')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'ti')
  listarIdentificadores(@Param('doenteId') doenteId: string) {
    return this.service.listarIdentificadoresDoente(doenteId);
  }

  @Post('doente/:doenteId/identificadores')
  @Roles('medico', 'chefe_enfermeiros', 'ti')
  adicionarIdentificador(
    @Param('doenteId') doenteId: string,
    @Body() dto: IdentificadorDto,
  ) {
    return this.service.adicionarIdentificadorDoente(doenteId, dto.sistemaId, dto.valorId, dto.tipo);
  }
}

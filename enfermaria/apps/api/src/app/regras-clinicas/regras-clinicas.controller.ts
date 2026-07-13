import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsObject, IsArray, IsBoolean, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RegrasCliniciasService } from './regras-clinicas.service';

class CriarRegraClinicaDto {
  @IsString() @IsNotEmpty() @MaxLength(200) nome!: string;
  @IsObject() condicao!: Record<string, any>;
  @IsArray() acoes!: Array<Record<string, any>>;
  @IsOptional() @IsString() servicoId?: string;
}

class AtualizarRegraClinicaDto {
  @IsOptional() @IsString() @MaxLength(200) nome?: string;
  @IsOptional() @IsObject() condicao?: Record<string, any>;
  @IsOptional() @IsArray() acoes?: Array<Record<string, any>>;
  @IsOptional() @IsBoolean() ativa?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('regras-clinicas')
export class RegrasCliniciasController {
  constructor(private readonly service: RegrasCliniciasService) {}

  @Get()
  @Roles('medico', 'chefe_enfermeiros', 'ti', 'direcao')
  listar(@Query('ativa') ativa?: string) {
    const ativaFilter = ativa !== undefined ? ativa === 'true' : undefined;
    return this.service.listar(ativaFilter);
  }

  @Post()
  @Roles('ti', 'direcao', 'chefe_enfermeiros')
  criar(
    @Body() dto: CriarRegraClinicaDto,
    @Request() req: any,
  ) {
    return this.service.criar(req.user.sub, dto);
  }

  @Patch(':id')
  @Roles('ti', 'direcao')
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarRegraClinicaDto,
  ) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @Roles('ti', 'direcao')
  apagar(@Param('id') id: string) {
    return this.service.apagar(id);
  }
}

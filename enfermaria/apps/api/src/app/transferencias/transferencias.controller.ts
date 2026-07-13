import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TransferenciasService } from './transferencias.service';
import { DoenteService } from '../doentes/doentes.service';

class CriarTransferenciaDto {
  @IsString() @IsNotEmpty() doenteId!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) hospitalDestino!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) servicoDestino!: string;
  @IsString() @IsNotEmpty() motivoTransfer!: string;
  @IsOptional() @IsString() notas?: string;
}

class AtualizarEstadoTransferenciaDto {
  @IsString() @IsIn(['pendente', 'aceite_destino', 'em_transito', 'concluida', 'cancelada'])
  estado!: string;
  @IsOptional() @IsString() notas?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transferencias')
export class TransferenciasController {
  constructor(
    private readonly service: TransferenciasService,
    private readonly doenteService: DoenteService,
  ) {}

  @Post()
  @Roles('medico', 'chefe_enfermeiros')
  async criar(@Body() dto: CriarTransferenciaDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, dto.doenteId);
    return this.service.criar(req.user.sub, dto);
  }

  @Get()
  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  async obter(@Param('id') id: string, @Request() req: any) {
    const transferencia = await this.service.obter(id);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, transferencia.doenteId);
    return transferencia;
  }

  @Patch(':id/estado')
  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  async atualizarEstado(
    @Param('id') id: string,
    @Body() dto: AtualizarEstadoTransferenciaDto,
    @Request() req: any,
  ) {
    const transferencia = await this.service.obter(id);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, transferencia.doenteId);
    return this.service.atualizarEstado(id, req.user.sub, dto);
  }
}

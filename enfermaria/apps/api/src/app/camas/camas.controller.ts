import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, Sse } from '@nestjs/common';
import { map } from 'rxjs';
import { CamasService } from './camas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EstadoCama } from '../common/enums';
import { CriarCamaDto } from './dto/criar-cama.dto';
import { AtualizarEstadoCamaDto } from './dto/atualizar-estado-cama.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('camas')
export class CamasController {
  constructor(private readonly camasService: CamasService) {}

  @Get()
  listar() {
    return this.camasService.listar();
  }

  @Get('ocupacao')
  ocupacao() {
    return this.camasService.ocupacao();
  }

  @Sse('eventos')
  eventos() {
    return this.camasService.eventStream().pipe(
      map((evento) => ({ type: evento.type, data: evento.data })),
    );
  }

  @Roles('enfermeiro', 'administrativo')
  @Post()
  criar(@Body() dto: CriarCamaDto) {
    return this.camasService.criar(dto);
  }

  @Roles('administrativo', 'enfermeiro')
  @Patch(':id/estado')
  atualizarEstado(@Param('id') id: string, @Body() dto: AtualizarEstadoCamaDto) {
    return this.camasService.atualizarEstado(id, dto.estado as EstadoCama);
  }

  @Roles('auxiliar', 'enfermeiro', 'administrativo')
  @Patch(':id/confirmar-limpeza')
  confirmarLimpeza(@Param('id') id: string) {
    return this.camasService.confirmarLimpeza(id);
  }
}

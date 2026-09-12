import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EspecialidadesService } from './especialidades.service';
import { CriarSessaoEspecialidadeDto } from './dto/criar-sessao-especialidade.dto';
import { RealizarEspecialidadeDto } from './dto/realizar-especialidade.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tecnico_saude')
@Controller('especialidades')
export class EspecialidadesController {
  constructor(private readonly service: EspecialidadesService) {}

  @Get()
  listar(@Request() req: any) {
    return this.service.listar(req.user.sub, req.user.subRole);
  }

  // S-01: o doente chamava-se `:id`, e a rota escapava à verificação global de acesso
  // (o AcessoDoenteInterceptor procura `doenteId`). O URL é o mesmo.
  @Get('doente/:doenteId')
  porDoente(@Param('doenteId') doenteId: string, @Request() req: any) {
    return this.service.porDoente(doenteId, req.user.subRole);
  }

  @Post()
  criar(@Body() dto: CriarSessaoEspecialidadeDto, @Request() req: any) {
    return this.service.criar(req.user.sub, req.user.subRole, dto);
  }

  @Patch(':id/realizar')
  realizar(@Param('id') id: string, @Body() dto: RealizarEspecialidadeDto) {
    return this.service.realizar(id, dto);
  }

  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }
}

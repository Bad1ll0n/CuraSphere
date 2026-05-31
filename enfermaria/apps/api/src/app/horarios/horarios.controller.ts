import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { HorariosService } from './horarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TipoTurno } from '../common/enums';
import { CriarEscalaDto } from './dto/criar-escala.dto';
import { AdicionarTurnoDto } from './dto/adicionar-turno.dto';
import { EditarTurnoDto } from './dto/editar-turno.dto';
import { GerarAutomaticoDto } from './dto/gerar-automatico.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('horarios')
export class HorariosController {
  constructor(private readonly horariosService: HorariosService) {}

  @Get()
  listar() {
    return this.horariosService.listar();
  }

  @Get('ausencias')
  ausenciasMes(@Query('mes') mes: string, @Query('ano') ano: string) {
    const agora = new Date();
    return this.horariosService.ausenciasAprovadas(
      Number(mes) || agora.getMonth() + 1,
      Number(ano) || agora.getFullYear(),
    );
  }

  @Get('mes')
  buscarPorMes(@Query('mes') mes: string, @Query('ano') ano: string) {
    return this.horariosService.buscarPorMes(Number(mes), Number(ano));
  }

  @Get('meu')
  meuHorario(@Request() req: any, @Query('mes') mes: string, @Query('ano') ano: string) {
    const agora = new Date();
    return this.horariosService.horarioUtilizador(
      req.user.sub,
      Number(mes) || agora.getMonth() + 1,
      Number(ano) || agora.getFullYear(),
    );
  }

  @Roles('enfermeiro', 'administrativo')
  @Post()
  criar(@Body() dto: CriarEscalaDto, @Request() req: any) {
    return this.horariosService.criar({ ...dto, criadaPorId: req.user.sub });
  }

  @Roles('enfermeiro', 'administrativo')
  @Post(':escalId/turno')
  adicionarTurno(
    @Param('escalId') escalId: string,
    @Body() dto: AdicionarTurnoDto,
  ) {
    return this.horariosService.adicionarTurno({ ...dto, escalId });
  }

  @Roles('enfermeiro', 'administrativo')
  @Patch('turno/:turnoId')
  editarTurno(
    @Param('turnoId') turnoId: string,
    @Body() dto: EditarTurnoDto,
  ) {
    return this.horariosService.editarTurno(turnoId, dto);
  }

  @Roles('enfermeiro', 'administrativo')
  @Delete('turno/:turnoId')
  apagarTurno(@Param('turnoId') turnoId: string) {
    return this.horariosService.apagarTurno(turnoId);
  }

  @Roles('enfermeiro', 'administrativo')
  @Post('gerar-automatico')
  gerarAutomatico(
    @Body() dto: GerarAutomaticoDto,
    @Request() req: any,
  ) {
    return this.horariosService.gerarEscalaAutomatica(dto.mes, dto.ano, req.user.sub, dto.servico);
  }
}

import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EventosAdversosService } from './eventos-adversos.service';
import { CriarEventoAdversoDto } from './dto/criar-evento-adverso.dto';
import { AtualizarEventoAdversoDto } from './dto/atualizar-evento-adverso.dto';
import { AcessoDoenteIsento } from '../doentes/acesso-doente.decorator';
import type { PedidoAutenticado } from '../auth/pedido-autenticado';

@UseGuards(JwtAuthGuard)
@Controller('eventos-adversos')
export class EventosAdversosController {
  constructor(private readonly service: EventosAdversosService) {}

  @AcessoDoenteIsento('notificação de incidente: qualquer profissional tem de poder notificar, mesmo sem atribuição')
  @Post()
  criar(@Body() dto: CriarEventoAdversoDto, @Request() req: PedidoAutenticado) {
    return this.service.criar(dto, req.user.sub);
  }

  // A lista tem os incidentes de todos os doentes (com o nome): é para quem gere o risco, não
  // para qualquer profissional autenticado. Notificar (POST) continua aberto a todos.
  @UseGuards(RolesGuard)
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros', 'chefe_medicos', 'chefe_turno')
  @Get()
  listar(
    @Query('tipo') tipo?: string,
    @Query('gravidade') gravidade?: string,
    @Query('estado') estado?: string,
    @Query('servicoId') servicoId?: string,
  ) {
    return this.service.listar({ tipo, gravidade, estado, servicoId });
  }

  /** PROD-18 — exportação anónima para o NOTIFICA (classe ICPS e grau de dano). */
  @UseGuards(RolesGuard)
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros')
  @Get('exportar-notifica')
  preverNotifica(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Query('soNovos') soNovos?: string) {
    return this.service.exportarNotifica({ inicio, fim, soNovos: soNovos === 'true' });
  }

  /** Exporta e marca os incidentes como exportados (o pedido seguinte com soNovos não os repete). */
  @UseGuards(RolesGuard)
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros')
  @Post('exportar-notifica')
  exportarNotifica(@Query('inicio') inicio?: string, @Query('fim') fim?: string, @Query('soNovos') soNovos?: string) {
    return this.service.exportarNotifica({ inicio, fim, soNovos: soNovos === 'true', marcar: true });
  }

  @UseGuards(RolesGuard)
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros', 'chefe_medicos', 'chefe_turno')
  @Get('indicadores')
  indicadores() {
    return this.service.indicadores();
  }

  @UseGuards(RolesGuard)
  @Roles('direcao', 'qualidade', 'chefe_enfermeiros', 'chefe_medicos', 'chefe_turno')
  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarEventoAdversoDto) {
    return this.service.atualizar(id, dto);
  }
}

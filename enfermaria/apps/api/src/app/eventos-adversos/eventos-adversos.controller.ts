import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventosAdversosService } from './eventos-adversos.service';
import { CriarEventoAdversoDto } from './dto/criar-evento-adverso.dto';
import { AtualizarEventoAdversoDto } from './dto/atualizar-evento-adverso.dto';

@UseGuards(JwtAuthGuard)
@Controller('eventos-adversos')
export class EventosAdversosController {
  constructor(private readonly service: EventosAdversosService) {}

  @Post()
  criar(@Body() dto: CriarEventoAdversoDto, @Request() req: any) {
    return this.service.criar(dto, req.user.sub);
  }

  @Get()
  listar(
    @Query('tipo') tipo?: string,
    @Query('gravidade') gravidade?: string,
    @Query('estado') estado?: string,
    @Query('servicoId') servicoId?: string,
  ) {
    return this.service.listar({ tipo, gravidade, estado, servicoId });
  }

  @Get('indicadores')
  indicadores() {
    return this.service.indicadores();
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarEventoAdversoDto) {
    return this.service.atualizar(id, dto);
  }
}

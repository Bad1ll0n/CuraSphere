import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { DoenteService } from '../doentes/doentes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CriarEscalaDto } from './dto/criar-escala.dto';

@UseGuards(JwtAuthGuard)
@Controller('escalas')
export class EscalasController {
  constructor(
    private readonly escalasService: EscalasService,
    private readonly doenteService: DoenteService,
  ) {}

  @Get(':doenteId')
  async listarUltimas(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.escalasService.listarUltimas(doenteId);
  }

  @Get(':doenteId/historico')
  async historico(
    @Param('doenteId') doenteId: string,
    @Request() req: any,
    @Query('tipo') tipo?: string,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.escalasService.historico(doenteId, tipo);
  }

  @Post(':doenteId')
  criar(
    @Param('doenteId') doenteId: string,
    @Body() dto: CriarEscalaDto,
    @Request() req: any,
  ) {
    return this.escalasService.criar(
      doenteId,
      req.user.sub,
      req.user.role,
      dto.tipo,
      dto.itens,
    );
  }
}

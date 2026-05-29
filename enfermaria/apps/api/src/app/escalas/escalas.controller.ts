import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CriarEscalaDto } from './dto/criar-escala.dto';

@UseGuards(JwtAuthGuard)
@Controller('escalas')
export class EscalasController {
  constructor(private readonly escalasService: EscalasService) {}

  @Get(':doenteId')
  listarUltimas(@Param('doenteId') doenteId: string) {
    return this.escalasService.listarUltimas(doenteId);
  }

  @Get(':doenteId/historico')
  historico(
    @Param('doenteId') doenteId: string,
    @Query('tipo') tipo?: string,
  ) {
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

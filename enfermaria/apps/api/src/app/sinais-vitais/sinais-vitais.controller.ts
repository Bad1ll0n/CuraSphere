import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SinaisVitaisService } from './sinais-vitais.service';

@UseGuards(JwtAuthGuard)
@Controller('sinais-vitais')
export class SinaisVitaisController {
  constructor(private readonly service: SinaisVitaisService) {}

  @Post(':doenteId')
  criar(@Param('doenteId') doenteId: string, @Body() dto: Record<string, any>, @Request() req: any) {
    return this.service.criar(doenteId, req.user.sub, req.user.role, dto);
  }

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Get(':doenteId/ultimo')
  ultimo(@Param('doenteId') doenteId: string) {
    return this.service.ultimo(doenteId);
  }
}

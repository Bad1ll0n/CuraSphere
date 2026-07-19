import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from '../doentes/doentes.service';
import { SnsPemService } from './sns-pem.service';
import { EmitirReceitaDto } from './dto/emitir-receita.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sns-pem')
export class SnsPemController {
  constructor(
    private readonly service: SnsPemService,
    private readonly doenteService: DoenteService,
  ) {}

  @Post('receita/doente/:doenteId')
  @Roles('medico')
  async emitir(@Param('doenteId') doenteId: string, @Body() dto: EmitirReceitaDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.emitir(doenteId, req.user.sub, dto);
  }

  @Get('receita/doente/:doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'farmaceutico')
  async listar(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listarPorDoente(doenteId);
  }
}

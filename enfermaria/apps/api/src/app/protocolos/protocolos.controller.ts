import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ProtocolosService } from './protocolos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CriarProtocoloDto } from './dto/criar-protocolo.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('protocolos')
export class ProtocolosController {
  constructor(private readonly service: ProtocolosService) {}

  @Roles('medico', 'enfermeiro')
  @Post()
  criar(@Body() dto: CriarProtocoloDto, @Request() req: any) {
    return this.service.criar(dto.doenteId, dto.tipo, req.user.sub);
  }

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.service.listarPorDoente(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'auxiliar')
  @Patch('item/:itemId/concluir')
  concluirItem(@Param('itemId') itemId: string, @Request() req: any) {
    return this.service.concluirItem(itemId, req.user.sub);
  }

  @Roles('medico')
  @Patch(':id/concluir')
  concluir(@Param('id') id: string) {
    return this.service.concluir(id);
  }

  @Roles('medico')
  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }
}

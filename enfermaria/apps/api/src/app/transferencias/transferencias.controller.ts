import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TransferenciasService } from './transferencias.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transferencias')
export class TransferenciasController {
  constructor(private readonly service: TransferenciasService) {}

  @Post()
  @Roles('medico', 'chefe_enfermeiros')
  criar(
    @Body() dto: {
      doenteId: string;
      hospitalDestino: string;
      servicoDestino: string;
      motivoTransfer: string;
      notas?: string;
    },
    @Request() req: any,
  ) {
    return this.service.criar(req.user.sub, dto);
  }

  @Get()
  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  obter(@Param('id') id: string) {
    return this.service.obter(id);
  }

  @Patch(':id/estado')
  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  atualizarEstado(
    @Param('id') id: string,
    @Body() dto: { estado: string; notas?: string },
    @Request() req: any,
  ) {
    return this.service.atualizarEstado(id, req.user.sub, dto);
  }
}

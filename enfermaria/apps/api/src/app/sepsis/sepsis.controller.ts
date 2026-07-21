import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SepsisService } from './sepsis.service';
import { AtualizarBundleDto } from './dto/atualizar-bundle.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sepsis')
export class SepsisController {
  constructor(private readonly service: SepsisService) {}

  @Get(':doenteId')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  listarAtivos(@Param('doenteId') doenteId: string) {
    return this.service.listarAtivos(doenteId);
  }

  @Patch(':id/bundle')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  atualizarBundle(@Param('id') id: string, @Body() dto: AtualizarBundleDto) {
    return this.service.atualizarBundle(id, dto.campo);
  }

  @Patch(':id/resolver')
  @Roles('medico', 'chefe_enfermeiros')
  resolver(@Param('id') id: string) {
    return this.service.resolver(id);
  }
}

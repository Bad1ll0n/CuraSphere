import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IacsService } from './iacs.service';
import { RegistarCulturaDto } from './dto/registar-cultura.dto';
import { AtualizarCulturaDto } from './dto/atualizar-cultura.dto';
import { RegistarSurtoDto } from './dto/registar-surto.dto';
import { AtualizarSurtoDto } from './dto/atualizar-surto.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('iacs')
export class IacsController {
  constructor(private readonly service: IacsService) {}

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Post('cultura')
  @Roles('medico', 'enfermeiro', 'tecnico_saude')
  registarCultura(@Body() dto: RegistarCulturaDto, @Request() req: any) {
    return this.service.registarCultura(dto, req.user.sub);
  }

  @Get('culturas')
  listarCulturas(
    @Query('doenteId') doenteId?: string,
    @Query('agente') agente?: string,
    @Query('resultado') resultado?: string,
  ) {
    return this.service.listarCulturas({ doenteId, agente, resultado });
  }

  @Patch('cultura/:id')
  @Roles('medico', 'enfermeiro', 'tecnico_saude')
  atualizarCultura(@Param('id') id: string, @Body() dto: AtualizarCulturaDto) {
    return this.service.atualizarCultura(id, dto);
  }

  @Post('surto')
  @Roles('medico', 'enfermeiro', 'qualidade')
  registarSurto(@Body() dto: RegistarSurtoDto, @Request() req: any) {
    return this.service.registarSurto(dto, req.user.sub);
  }

  @Get('surtos')
  listarSurtos(@Query('estado') estado?: string) {
    return this.service.listarSurtos({ estado });
  }

  @Patch('surto/:id')
  @Roles('medico', 'enfermeiro', 'qualidade')
  atualizarSurto(@Param('id') id: string, @Body() dto: AtualizarSurtoDto) {
    return this.service.atualizarSurto(id, dto);
  }
}

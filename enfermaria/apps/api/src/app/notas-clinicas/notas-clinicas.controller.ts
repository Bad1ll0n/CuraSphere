import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { NotasClinicasService } from './notas-clinicas.service';
import { CriarNotaClinicaDto } from './dto/criar-nota-clinica.dto';
import { AtualizarNotaClinicaDto } from './dto/atualizar-nota-clinica.dto';
import { TotpCodeDto } from './dto/totp-code.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notas-clinicas')
export class NotasClinicasController {
  constructor(private readonly service: NotasClinicasService) {}

  @Post(':doenteId')
  @Roles('medico', 'enfermeiro')
  criar(@Param('doenteId') doenteId: string, @Body() dto: CriarNotaClinicaDto, @Request() req: any) {
    return this.service.criar(doenteId, dto, req.user.sub);
  }

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Patch(':id')
  @Roles('medico', 'enfermeiro')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarNotaClinicaDto) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @Roles('medico')
  apagar(@Param('id') id: string) {
    return this.service.apagar(id);
  }

  @Post(':id/assinar')
  @Roles('medico', 'enfermeiro')
  assinar(@Param('id') id: string, @Body() dto: TotpCodeDto, @Request() req: any) {
    return this.service.assinar(id, req.user.sub, dto.totpCode);
  }
}

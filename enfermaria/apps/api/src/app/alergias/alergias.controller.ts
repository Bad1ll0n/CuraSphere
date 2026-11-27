import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AlergiasService } from './alergias.service';
import { CriarAlergiaDto, AvaliacaoAlergiasDto } from './dto/criar-alergia.dto';
import { RemoverAlergiaDto } from './dto/remover-alergia.dto';
import { AcessoDoentePor } from '../doentes/acesso-doente.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@AcessoDoentePor('alergia')
@Controller('alergias')
export class AlergiasController {
  constructor(private readonly service: AlergiasService) {}

  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Get(':doenteId/avaliacao')
  avaliacao(@Param('doenteId') doenteId: string) {
    return this.service.avaliacao(doenteId);
  }

  // PROD-06: "perguntámos e o doente não tem alergias conhecidas".
  @Roles('medico', 'enfermeiro')
  @Post(':doenteId/avaliacao')
  registarAvaliacao(@Param('doenteId') doenteId: string, @Body() _dto: AvaliacaoAlergiasDto, @Request() req: any) {
    return this.service.registarSemAlergias(doenteId, req.user.sub, req.user.role);
  }

  @Roles('medico', 'enfermeiro')
  @Post(':doenteId')
  criar(@Param('doenteId') doenteId: string, @Body() dto: CriarAlergiaDto, @Request() req: any) {
    return this.service.criar(doenteId, req.user.role, dto, req.user.sub);
  }

  // Retirar uma alergia é uma decisão médica (QA-02): faz desaparecer a barreira contra uma
  // reação grave em todas as prescrições seguintes.
  @Roles('medico')
  @Delete(':id')
  remover(@Param('id') id: string, @Body() dto: RemoverAlergiaDto, @Request() req: any) {
    return this.service.remover(id, req.user.sub, req.user.role, dto.motivo);
  }
}

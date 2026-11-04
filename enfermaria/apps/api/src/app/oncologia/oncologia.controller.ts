import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from '../doentes/doentes.service';
import { OncologiaService } from './oncologia.service';
import { CriarPlanoDto } from './dto/criar-plano.dto';
import { AgendarCicloDto } from './dto/agendar-ciclo.dto';
import { AdministrarCicloDto } from './dto/administrar-ciclo.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('oncologia')
export class OncologiaController {
  constructor(
    private readonly service: OncologiaService,
    private readonly doenteService: DoenteService,
  ) {}

  @Get('doente/:doenteId/plano')
  @Roles('medico', 'enfermeiro', 'farmaceutico')
  async planoAtivo(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.planoAtivo(doenteId);
  }

  @Post('doente/:doenteId/plano')
  @Roles('medico', 'farmaceutico')
  async criarPlano(@Param('doenteId') doenteId: string, @Body() dto: CriarPlanoDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.criarPlano(doenteId, dto, req.user.sub);
  }

  @Get('plano/:planoId/doses')
  @Roles('medico', 'enfermeiro', 'farmaceutico')
  async doses(@Param('planoId') planoId: string, @Request() req: any) {
    const doenteId = await this.service.doenteIdDoPlano(planoId);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.doses(planoId);
  }

  @Post('plano/:planoId/ciclo')
  @Roles('medico', 'enfermeiro', 'farmaceutico')
  async agendarCiclo(@Param('planoId') planoId: string, @Body() dto: AgendarCicloDto, @Request() req: any) {
    const doenteId = await this.service.doenteIdDoPlano(planoId);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.agendarCiclo(planoId, dto);
  }

  @Post('ciclo/:cicloId/administrar')
  @Roles('medico', 'enfermeiro')
  async administrar(@Param('cicloId') cicloId: string, @Body() dto: AdministrarCicloDto, @Request() req: any) {
    const doenteId = await this.service.doenteIdDoCiclo(cicloId);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.administrarCiclo(cicloId, dto, req.user.sub);
  }
}

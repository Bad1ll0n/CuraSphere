import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoenteService } from '../doentes/doentes.service';
import { MaternidadeService } from './maternidade.service';
import { CriarGravidezDto } from './dto/criar-gravidez.dto';
import { RegistoPartogramaDto } from './dto/registo-partograma.dto';
import { RegistarPartoDto } from './dto/registar-parto.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maternidade')
export class MaternidadeController {
  constructor(
    private readonly service: MaternidadeService,
    private readonly doenteService: DoenteService,
  ) {}

  @Get('doente/:doenteId/gravidez')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  async gravidezAtiva(@Param('doenteId') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.gravidezAtiva(doenteId);
  }

  @Post('doente/:doenteId/gravidez')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  async criarGravidez(@Param('doenteId') doenteId: string, @Body() dto: CriarGravidezDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.criarGravidez(doenteId, dto, req.user.sub);
  }

  @Get('gravidez/:gravidezId/partograma')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  async listarPartograma(@Param('gravidezId') gravidezId: string, @Request() req: any) {
    const doenteId = await this.service.doenteIdDaGravidez(gravidezId);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.listarPartograma(gravidezId);
  }

  @Post('gravidez/:gravidezId/partograma')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  async adicionarPartograma(@Param('gravidezId') gravidezId: string, @Body() dto: RegistoPartogramaDto, @Request() req: any) {
    const doenteId = await this.service.doenteIdDaGravidez(gravidezId);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.adicionarPartograma(gravidezId, dto, req.user.sub);
  }

  @Post('gravidez/:gravidezId/parto')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  async registarParto(@Param('gravidezId') gravidezId: string, @Body() dto: RegistarPartoDto, @Request() req: any) {
    const doenteId = await this.service.doenteIdDaGravidez(gravidezId);
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.service.registarParto(gravidezId, dto, req.user.sub);
  }
}

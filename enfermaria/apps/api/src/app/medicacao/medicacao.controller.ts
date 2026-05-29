import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { MedicacaoService } from './medicacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrescreverMedicacaoDto } from './dto/prescrever-medicacao.dto';
import { ProporMedicacaoDto } from './dto/propor-medicacao.dto';
import { RejeitarMedicacaoDto } from './dto/rejeitar-medicacao.dto';
import { AdministrarMedicacaoDto } from './dto/administrar-medicacao.dto';
import { NaoAdministrarDto } from './dto/nao-administrar.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medicacao')
export class MedicacaoController {
  constructor(private readonly medicacaoService: MedicacaoService) {}

  @Get('doente/:doenteId')
  listarPorDoente(@Param('doenteId') doenteId: string) {
    return this.medicacaoService.listarPorDoente(doenteId);
  }

  @Get('doente/:doenteId/historico')
  historicoAdministracao(@Param('doenteId') doenteId: string) {
    return this.medicacaoService.historicoAdministracao(doenteId);
  }

  @Roles('medico')
  @Post('prescrever')
  prescrever(@Body() dto: PrescreverMedicacaoDto, @Request() req: any) {
    return this.medicacaoService.prescrever({ ...dto, prescritoPorId: req.user.sub });
  }

  @Roles('enfermeiro')
  @Post('propor')
  proporPrescricao(@Body() dto: ProporMedicacaoDto, @Request() req: any) {
    return this.medicacaoService.proporPrescricao({ ...dto, prescritoPorId: req.user.sub });
  }

  @Roles('medico', 'direcao')
  @Get('pendentes-aprovacao-medico')
  pendentesAprovacaoMedico(@Query('servico') servico?: string) {
    return this.medicacaoService.pendentesAprovacaoMedico(servico);
  }

  @Roles('medico', 'direcao')
  @Patch(':id/aprovar-medico')
  aprovarPrescricaoMedico(@Param('id') id: string, @Request() req: any) {
    return this.medicacaoService.aprovarPrescricaoMedico(id, req.user.sub);
  }

  @Roles('medico', 'direcao')
  @Patch(':id/rejeitar-medico')
  rejeitarPrescricaoMedico(
    @Param('id') id: string,
    @Body() dto: RejeitarMedicacaoDto,
    @Request() req: any,
  ) {
    return this.medicacaoService.rejeitarPrescricaoMedico(id, req.user.sub, dto.motivoRejeicao);
  }

  @Roles('enfermeiro')
  @Post(':id/administrar')
  registarAdministracao(
    @Param('id') id: string,
    @Body() dto: AdministrarMedicacaoDto,
    @Request() req: any,
  ) {
    return this.medicacaoService.registarAdministracao({
      medicacaoId: id,
      administradoPorId: req.user.sub,
      observacoes: dto.observacoes,
      verificacao5Certas: dto.verificacao5Certas,
    });
  }

  @Roles('enfermeiro')
  @Post(':id/nao-administrar')
  naoAdministrar(
    @Param('id') id: string,
    @Body() dto: NaoAdministrarDto,
    @Request() req: any,
  ) {
    return this.medicacaoService.naoAdministrar({
      medicacaoId: id,
      registadoPorId: req.user.sub,
      motivo: dto.motivo,
    });
  }

  @Roles('medico', 'enfermeiro')
  @Patch(':id/descontinuar')
  descontinuar(@Param('id') id: string) {
    return this.medicacaoService.descontinuar(id);
  }

  @Get('mar')
  mar(@Request() req: any) {
    return this.medicacaoService.mar(req.user.sub);
  }

  @Roles('farmaceutico')
  @Get('pendentes-validacao')
  pendentesValidacao() {
    return this.medicacaoService.pendentesValidacao();
  }

  @Roles('farmaceutico')
  @Patch(':id/validar')
  validar(@Param('id') id: string, @Request() req: any) {
    return this.medicacaoService.validarPrescricao(id, req.user.sub);
  }

  @Roles('farmaceutico')
  @Patch(':id/rejeitar')
  rejeitar(@Param('id') id: string, @Body() dto: RejeitarMedicacaoDto, @Request() req: any) {
    return this.medicacaoService.rejeitarPrescricao(id, req.user.sub, dto.motivoRejeicao);
  }

  @Roles('medico', 'enfermeiro')
  @Post(':id/assinar')
  assinar(@Param('id') id: string, @Body() body: { totpCode: string }, @Request() req: any) {
    return this.medicacaoService.assinar(id, req.user.sub, body.totpCode);
  }

  @Get('interacoes')
  verificarInteracoes(@Query('doenteId') doenteId: string, @Query('nome') nome: string) {
    return this.medicacaoService.verificarInteracoes(doenteId, nome);
  }
}

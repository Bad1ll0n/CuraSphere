import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { MedicacaoService } from './medicacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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
  prescrever(@Body() body: {
    doenteId: string;
    nome: string;
    dose: string;
    via: string;
    frequencia: string;
  }, @Request() req: any) {
    return this.medicacaoService.prescrever({ ...body, prescritoPorId: req.user.sub });
  }

  @Roles('enfermeiro')
  @Post('propor')
  proporPrescricao(@Body() body: {
    doenteId: string;
    nome: string;
    dose: string;
    via: string;
    frequencia: string;
    observacoes?: string;
  }, @Request() req: any) {
    return this.medicacaoService.proporPrescricao({ ...body, prescritoPorId: req.user.sub });
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
    @Body() body: { motivoRejeicao: string },
    @Request() req: any,
  ) {
    return this.medicacaoService.rejeitarPrescricaoMedico(id, req.user.sub, body.motivoRejeicao);
  }

  @Roles('enfermeiro')
  @Post(':id/administrar')
  registarAdministracao(
    @Param('id') id: string,
    @Body() body: { observacoes?: string; verificacao5Certas?: boolean },
    @Request() req: any,
  ) {
    return this.medicacaoService.registarAdministracao({
      medicacaoId: id,
      administradoPorId: req.user.sub,
      observacoes: body.observacoes,
      verificacao5Certas: body.verificacao5Certas,
    });
  }

  @Roles('enfermeiro')
  @Post(':id/nao-administrar')
  naoAdministrar(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Request() req: any,
  ) {
    return this.medicacaoService.naoAdministrar({
      medicacaoId: id,
      registadoPorId: req.user.sub,
      motivo: body.motivo,
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
  rejeitar(@Param('id') id: string, @Body() body: { motivoRejeicao: string }, @Request() req: any) {
    return this.medicacaoService.rejeitarPrescricao(id, req.user.sub, body.motivoRejeicao);
  }

  @Get('interacoes')
  verificarInteracoes(@Query('doenteId') doenteId: string, @Query('nome') nome: string) {
    return this.medicacaoService.verificarInteracoes(doenteId, nome);
  }
}
